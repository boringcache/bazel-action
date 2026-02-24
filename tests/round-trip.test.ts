import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock fs partially — preserve promises for temp dir operations
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    appendFileSync: jest.fn(),
  };
});

// Mock action-core to intercept CLI and proxy calls
jest.mock('@boringcache/action-core', () => ({
  ensureBoringCache: jest.fn().mockResolvedValue(undefined),
  getWorkspace: jest.fn((input: string) => {
    if (!input) throw new Error('Workspace required');
    if (!input.includes('/')) return `default/${input}`;
    return input;
  }),
  getCacheTagPrefix: jest.fn((input: string, fallback: string) => {
    if (input) return input;
    const repo = process.env.GITHUB_REPOSITORY || '';
    if (repo) return repo.split('/')[1] || repo;
    return fallback;
  }),
  startRegistryProxy: jest.fn().mockResolvedValue({ pid: 12345, port: 5000 }),
  waitForProxy: jest.fn().mockResolvedValue(undefined),
  stopRegistryProxy: jest.fn().mockResolvedValue(undefined),
  findAvailablePort: jest.fn().mockResolvedValue(9876),
}));

import {
  ensureBoringCache,
  startRegistryProxy,
  waitForProxy,
  stopRegistryProxy,
  findAvailablePort,
} from '@boringcache/action-core';

/**
 * End-to-end test: simulate the full restore → save round-trip.
 * Verifies that:
 * 1. restore reads inputs and calls core functions correctly
 * 2. Config files are written with the right content
 * 3. State is saved for the post phase
 * 4. save reads state and stops the proxy
 */
describe('Bazel restore/save round-trip', () => {
  const stateStore: Record<string, string> = {};
  const outputs: Record<string, string> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(stateStore).forEach(k => delete stateStore[k]);
    Object.keys(outputs).forEach(k => delete outputs[k]);

    // Re-apply action-core mock implementations (cleared by setup.ts's resetAllMocks)
    (ensureBoringCache as jest.Mock).mockResolvedValue(undefined);
    (startRegistryProxy as jest.Mock).mockResolvedValue({ pid: 12345, port: 5000 });
    (waitForProxy as jest.Mock).mockResolvedValue(undefined);
    (stopRegistryProxy as jest.Mock).mockResolvedValue(undefined);
    (findAvailablePort as jest.Mock).mockResolvedValue(9876);

    const { getWorkspace, getCacheTagPrefix } = require('@boringcache/action-core');
    (getWorkspace as jest.Mock).mockImplementation((input: string) => {
      if (!input) throw new Error('Workspace required');
      if (!input.includes('/')) return `default/${input}`;
      return input;
    });
    (getCacheTagPrefix as jest.Mock).mockImplementation((input: string, fallback: string) => {
      if (input) return input;
      const repo = process.env.GITHUB_REPOSITORY || '';
      if (repo) return repo.split('/')[1] || repo;
      return fallback;
    });

    (core.saveState as jest.Mock).mockImplementation((key: string, value: string) => {
      stateStore[key] = value;
    });
    (core.getState as jest.Mock).mockImplementation((key: string) => {
      return stateStore[key] || '';
    });
    (core.setOutput as jest.Mock).mockImplementation((key: string, value: string) => {
      outputs[key] = value;
    });

    process.env.BORINGCACHE_API_TOKEN = 'test-token';
    process.env.GITHUB_REPOSITORY = 'myorg/myrepo';
  });

  afterEach(() => {
    delete process.env.BORINGCACHE_API_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
  });

  it('full round-trip: restore starts proxy, configures bazelrc, save stops proxy', async () => {
    // Simulate inputs
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'cli-version': 'v1.7.2',
        'workspace': 'myorg/myproject',
        'cache-tag': '',
        'proxy-port': '5000',
        'read-only': 'false',
        'proxy-no-git': 'false',
        'proxy-no-platform': 'false',
        'verbose': 'false',
      };
      return inputs[name] || '';
    });

    // Run restore phase
    jest.isolateModules(() => {
      require('../lib/restore');
    });

    // Wait for async run() to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify CLI was installed
    expect(ensureBoringCache).toHaveBeenCalledWith({ version: 'v1.7.2' });

    // Verify proxy was started with correct args
    expect(startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
      command: 'cache-registry',
      workspace: 'myorg/myproject',
      tag: 'myrepo', // from GITHUB_REPOSITORY fallback
      host: '127.0.0.1',
      port: 5000,
    }));
    expect(waitForProxy).toHaveBeenCalledWith(5000, 20000, 12345);

    // Verify bazelrc was written
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      path.join(os.homedir(), '.bazelrc'),
      expect.stringContaining('--remote_cache=http://127.0.0.1:5000'),
    );
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('--remote_upload_local_results=true'),
    );

    // Verify state was saved
    expect(stateStore['proxyPid']).toBe('12345');
    expect(stateStore['workspace']).toBe('myorg/myproject');
    expect(stateStore['cacheTag']).toBe('myrepo');

    // Verify outputs were set
    expect(outputs['cache-tag']).toBe('myrepo');
    expect(outputs['proxy-port']).toBe('5000');
    expect(outputs['workspace']).toBe('myorg/myproject');

    // Now run save phase — it should read proxyPid from state and stop proxy
    jest.isolateModules(() => {
      // Re-mock core.getState to return our saved state
      const coreMock = require('@actions/core');
      coreMock.getState.mockImplementation((key: string) => stateStore[key] || '');
      require('../lib/save');
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(stopRegistryProxy).toHaveBeenCalledWith(12345);
  });

  it('read-only mode disables remote_upload_local_results', async () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'workspace': 'myorg/myproject',
        'read-only': 'true',
        'proxy-port': '5000',
      };
      return inputs[name] || '';
    });

    jest.isolateModules(() => {
      require('../lib/restore');
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(fs.appendFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('--remote_upload_local_results=false'),
    );
  });

  it('uses findAvailablePort when proxy-port is 0', async () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'workspace': 'myorg/myproject',
        'proxy-port': '0',
      };
      return inputs[name] || '';
    });

    jest.isolateModules(() => {
      require('../lib/restore');
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(findAvailablePort).toHaveBeenCalled();
    expect(startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
      port: 9876,
    }));
  });

  it('skips CLI install when cli-version is "skip"', async () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'workspace': 'myorg/myproject',
        'cli-version': 'skip',
        'proxy-port': '5000',
      };
      return inputs[name] || '';
    });

    jest.isolateModules(() => {
      require('../lib/restore');
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(ensureBoringCache).not.toHaveBeenCalled();
    // Proxy should still be started
    expect(startRegistryProxy).toHaveBeenCalled();
  });

  it('save is a no-op when proxyPid is missing from state', async () => {
    // Simulate save without prior restore
    (core.getState as jest.Mock).mockImplementation(() => '');

    jest.isolateModules(() => {
      require('../lib/save');
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(stopRegistryProxy).not.toHaveBeenCalled();
    expect(core.notice).toHaveBeenCalledWith(
      expect.stringContaining('No proxy to stop'),
    );
  });

  it('custom cache-tag is used instead of GITHUB_REPOSITORY', async () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'workspace': 'myorg/myproject',
        'cache-tag': 'my-custom-tag',
        'proxy-port': '5000',
      };
      return inputs[name] || '';
    });

    jest.isolateModules(() => {
      require('../lib/restore');
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(startRegistryProxy).toHaveBeenCalledWith(expect.objectContaining({
      tag: 'my-custom-tag',
    }));
    expect(outputs['cache-tag']).toBe('my-custom-tag');
  });
});
