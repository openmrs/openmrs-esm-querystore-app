import { describe, expect, it } from 'vitest';
import { chartPatientIdOf } from './chart-path';

const uuid = '8673ee4f-e2ab-4077-ba55-4980f408773e';
const other = '0c1d2e3f-4a5b-4c6d-8e7f-901234567890';

// Expected values are what the omnibar's chartPatientIdOf (src/omnibar/patient-path.ts at 4ab87d8)
// returns for each path, so a chart warmed here is the chart the omnibar scopes to.
describe('chartPatientIdOf', () => {
  it.each([
    [`/openmrs/spa/patient/${uuid}/chart/Patient%20Summary`, uuid],
    [`/openmrs/spa/patient/${uuid}/chart`, uuid],
    [`/openmrs/spa/patient/${uuid}/chart/`, uuid],
    [`/openmrs/spa/patient/${uuid.replace(/-/g, '%2D')}/chart/Results`, uuid],
    [`/openmrs/spa/patient/${uuid.toUpperCase()}/chart`, '8673EE4F-E2AB-4077-BA55-4980F408773E'],
    [`/openmrs/spa/patient/${uuid.replace(/-/g, '')}/chart`, '8673ee4fe2ab4077ba554980f408773e'],
    [`/openmrs/spa/patient/${uuid}x/chart`, undefined],
    [`/openmrs/spa/patient/${uuid.replace(/-/g, '%2F')}/chart`, undefined],
    [`/openmrs/spa/patient/${uuid}/edit`, undefined],
    [`/openmrs/spa/patient/${uuid}/charts`, undefined],
    [`/openmrs/spa/patient/not-a-uuid/chart/${uuid}`, undefined],
    [`/openmrs/spa/patient/${uuid}/edit/patient/${other}/chart`, other],
    ['/openmrs/spa/patient/%E0%A4%A/chart', undefined],
    ['/openmrs/spa/home', undefined],
    ['', undefined],
  ])('reads %s as the omnibar does', (path, patient) => {
    expect(chartPatientIdOf(path)).toBe(patient);
  });
});
