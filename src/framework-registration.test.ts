import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSessionStore } from '@openmrs/esm-api';
import { resetConfigSystem } from '@openmrs/esm-config';
import { getAssignedExtensions, registerExtensionSlot, reset } from '@openmrs/esm-extensions';
import { registerApp } from '@openmrs/esm-routes';
import routes from './routes.json';
import appPackage from '../package.json';

/**
 * This app's routes.json registered as the app shell registers it, through the framework's own
 * route, config and extension stores rather than the mock the other tests use, with the slot
 * registered by the omnibar. How the omnibar's own providers share the slot is the omnibar's to test.
 */
const slot = 'omnibar-providers-slot';

const signInAs = (privileges: Array<string>) =>
  getSessionStore().setState({
    loaded: true,
    session: {
      authenticated: true,
      sessionId: 'session',
      user: { uuid: 'user', privileges: privileges.map((display) => ({ uuid: display, display })), roles: [] },
    },
  } as never);

const providersShown = async () => {
  // The extension store re-derives slots after the write that changed them, not inside it.
  await new Promise((resolve) => setTimeout(resolve));
  return getAssignedExtensions(slot).map(({ name, moduleName }) => `${moduleName} ${name}`);
};

describe("the query store app's provider, through the framework", () => {
  // The real session store asks the server for the session on first use; there is no server here.
  beforeEach(() => {
    vi.stubGlobal('fetch', () => new Promise(() => {}));
    reset();
    resetConfigSystem();
    registerApp(appPackage.name, routes);
    registerExtensionSlot('@openmrs/esm-omnibar-app', slot);
  });

  it('is in the omnibar slot for a user with Get Observations', async () => {
    signInAs(['Get Patients', 'Get Observations']);
    expect(await providersShown()).toEqual(['@openmrs/esm-querystore-app omnibar-querystore-chart-provider']);
  });

  it('is not in the slot for a user without Get Observations', async () => {
    signInAs(['Get Patients']);
    expect(await providersShown()).toEqual([]);
  });
});
