import React from 'react';
import { SWRConfig } from 'swr';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type FetchResponse,
  type Session,
  getDefaultsFromConfigSchema,
  openmrsFetch,
  useConfig,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import { POLL_DELAYS_MS } from './bounded-poll';
import { configSchema, type QuerystoreConfig } from './config-schema';
import {
  OMNIBAR_CONTRACT_VERSION,
  looksLikeIdentifier,
  looksLikeQuestion,
  type OmnibarReport,
  withProviderBoundary,
} from './omnibar-contract';
import QuerystoreChartProvider from './querystore-chart.provider';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  restBaseUrl: '/ws/rest/v1',
  openmrsFetch: vi.fn(),
  interpolateUrl: (template: string, vars: Record<string, string>) =>
    template.replace(/\$\{openmrsSpaBase\}/g, '/openmrs/spa').replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? ''),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const chartPatient = '8673ee4f-e2ab-4077-ba55-4980f408773e';

const admission = {
  conceptUuid: 'admission-uuid',
  conceptName: 'Admission',
  count: 1,
  score: 0.9,
  latest: {
    resourceType: 'encounter',
    resourceUuid: 'enc-uuid',
    date: '2026-03-12',
    snippet: 'Admission: Ward 3',
    conceptName: 'Admission',
    conceptUuid: 'admission-uuid',
  },
};

const Provider = withProviderBoundary(QuerystoreChartProvider, 'omnibar-querystore-chart-provider');

/**
 * Mounts the provider as a host built only on the contract would, inside the open chart: wrapped in
 * withProviderBoundary, with the hints the contract's helpers compute and the contract version.
 */
function mountInChart(query: string, swr: object = {}) {
  const reports: Array<OmnibarReport> = [];
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, ...swr }}>
      <Provider
        query={query}
        context={{ scope: 'patient', patientUuid: chartPatient, locale: 'en' }}
        report={(report) => reports.push(report)}
        hints={{ looksLikeIdentifier: looksLikeIdentifier(query), looksLikeQuestion: looksLikeQuestion(query) }}
        contractVersion={OMNIBAR_CONTRACT_VERSION}
      />
    </SWRConfig>,
  );
  return reports;
}

const searches = () => mockOpenmrsFetch.mock.calls.filter(([url]) => url.includes('/search?'));

beforeEach(() => {
  vi.mocked(useConfig<QuerystoreConfig>).mockReturnValue(getDefaultsFromConfigSchema(configSchema) as QuerystoreConfig);
  vi.mocked(useSession).mockReturnValue({ authenticated: true, sessionId: 's', user: { uuid: 'u' } } as Session);
  vi.mocked(userHasAccess).mockReturnValue(true);
});

describe('the query store provider under a host built on the contract', () => {
  it('sends no search for a scanned wristband ID, and stays idle', () => {
    mockOpenmrsFetch.mockReturnValue(new Promise(() => {}));
    const reports = mountInChart('4273MO-2');

    expect(searches()).toEqual([]);
    expect(reports.at(-1)).toMatchObject({ query: '4273MO-2', status: 'idle' });
  });

  it('searches the open chart for a word', () => {
    mockOpenmrsFetch.mockReturnValue(new Promise(() => {}));
    mountInChart('admission');

    expect(searches().map(([url]) => url)).toEqual([expect.stringContaining(`/querystore/patient/${chartPatient}/`)]);
  });

  describe('while the chart is indexing', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('answers with an empty group in the indexing state, then the record the re-check finds, on the open chart', async () => {
      mockOpenmrsFetch
        .mockResolvedValueOnce({ data: { status: 'not_indexed', groups: [] } } as FetchResponse)
        .mockResolvedValue({ data: { status: 'indexed', groups: [admission] } } as FetchResponse);
      const reports = mountInChart('admission');
      expect(reports.at(-1)).toMatchObject({ status: 'loading' });

      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(reports.at(-1)).toMatchObject({ status: 'ready', results: [], detail: { state: 'projecting' } });

      await act(() => vi.advanceTimersByTimeAsync(POLL_DELAYS_MS[0]));
      expect(reports.at(-1)).toMatchObject({
        query: 'admission',
        title: 'In this chart (query store)',
        status: 'ready',
        results: [
          {
            title: 'Admission: Ward 3',
            target: { type: 'navigate', to: `/openmrs/spa/patient/${chartPatient}/chart/Visits` },
          },
        ],
      });
      expect(reports.at(-1).detail).toBeUndefined();
    });
  });

  it('reports the server unavailable, then the indexing state once a retry reaches it', async () => {
    mockOpenmrsFetch
      .mockRejectedValueOnce(Object.assign(new Error('Service Unavailable'), { response: { status: 503 } }))
      .mockResolvedValue({ data: { status: 'not_indexed', groups: [] } } as FetchResponse);
    const reports = mountInChart('admission', { errorRetryInterval: 50 });

    await waitFor(() => expect(reports.at(-1)).toMatchObject({ status: 'error', detail: { state: 'unavailable' } }));
    await waitFor(() =>
      expect(reports.at(-1)).toMatchObject({ status: 'ready', results: [], detail: { state: 'projecting' } }),
    );
  });
});
