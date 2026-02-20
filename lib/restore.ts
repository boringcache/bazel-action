import * as core from '@actions/core';
import {
  parseBoolean,
  getWorkspace,
  getCacheTagPrefix,
  ensureBoringCache,
  startRegistryProxy,
  waitForProxy,
  findAvailablePort,
  writeBazelrc,
} from './utils';

async function run(): Promise<void> {
  try {
    const cliVersion = core.getInput('cli-version') || '';
    const workspace = getWorkspace(core.getInput('workspace') || '');
    const cacheTag = getCacheTagPrefix(core.getInput('cache-tag') || '', 'bazel');
    const proxyPort = parseInt(core.getInput('proxy-port') || '0', 10) || await findAvailablePort();
    const readOnly = parseBoolean(core.getInput('read-only'), false);
    const proxyNoGit = parseBoolean(core.getInput('proxy-no-git'), false);
    const proxyNoPlatform = parseBoolean(core.getInput('proxy-no-platform'), false);
    const verbose = parseBoolean(core.getInput('verbose'), false);

    core.saveState('workspace', workspace);
    core.saveState('cacheTag', cacheTag);
    core.saveState('verbose', verbose.toString());

    if (cliVersion.toLowerCase() !== 'skip') {
      await ensureBoringCache({ version: cliVersion || 'v1.3.0' });
    }

    const proxy = await startRegistryProxy({
      command: 'cache-registry',
      workspace,
      tag: cacheTag,
      host: '127.0.0.1',
      port: proxyPort,
      noGit: proxyNoGit,
      noPlatform: proxyNoPlatform,
      verbose,
    });
    await waitForProxy(proxy.port, 20000, proxy.pid);
    core.saveState('proxyPid', String(proxy.pid));

    writeBazelrc(proxy.port, readOnly);

    core.setOutput('cache-tag', cacheTag);
    core.setOutput('proxy-port', String(proxy.port));
    core.setOutput('workspace', workspace);

    core.info(`Bazel remote cache configured at http://127.0.0.1:${proxy.port}`);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

run();
