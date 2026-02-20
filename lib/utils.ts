import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  ensureBoringCache,
  getWorkspace,
  getCacheTagPrefix,
  startRegistryProxy,
  waitForProxy,
  stopRegistryProxy,
  findAvailablePort,
} from '@boringcache/action-core';

export {
  ensureBoringCache,
  getWorkspace,
  getCacheTagPrefix,
  startRegistryProxy,
  waitForProxy,
  stopRegistryProxy,
  findAvailablePort,
};

export function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined || value === null || value === '') return defaultValue;
  return String(value).trim().toLowerCase() === 'true';
}

/**
 * Write Bazel remote cache configuration to ~/.bazelrc.
 * Bazel always reads ~/.bazelrc after the workspace .bazelrc.
 */
export function writeBazelrc(port: number, readOnly: boolean): void {
  const bazelrcPath = path.join(os.homedir(), '.bazelrc');

  const config = [
    '',
    '# BoringCache remote cache',
    `build --remote_cache=http://127.0.0.1:${port}`,
    `build --remote_upload_local_results=${!readOnly}`,
    '',
  ].join('\n');

  fs.appendFileSync(bazelrcPath, config);
  core.info(`Configured Bazel remote cache in ${bazelrcPath}`);
}
