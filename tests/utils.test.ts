import { parseBoolean, getWorkspace, getCacheTagPrefix } from '../lib/utils';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock fs while preserving promises (needed by @actions/io)
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    appendFileSync: jest.fn(),
  };
});

describe('Bazel Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BORINGCACHE_DEFAULT_WORKSPACE;
    delete process.env.GITHUB_REPOSITORY;
  });

  describe('parseBoolean', () => {
    it('should parse boolean strings correctly', () => {
      expect(parseBoolean('true')).toBe(true);
      expect(parseBoolean('TRUE')).toBe(true);
      expect(parseBoolean('True')).toBe(true);
      expect(parseBoolean('false')).toBe(false);
      expect(parseBoolean('')).toBe(false);
      expect(parseBoolean(undefined)).toBe(false);
    });

    it('should use default value when empty or undefined', () => {
      expect(parseBoolean(undefined, true)).toBe(true);
      expect(parseBoolean('', true)).toBe(true);
    });
  });

  describe('getWorkspace', () => {
    it('should return input workspace when provided', () => {
      expect(getWorkspace('my-org/my-project')).toBe('my-org/my-project');
    });

    it('should use BORINGCACHE_DEFAULT_WORKSPACE as fallback', () => {
      process.env.BORINGCACHE_DEFAULT_WORKSPACE = 'default-org/default-project';
      expect(getWorkspace('')).toBe('default-org/default-project');
    });

    it('should add default/ prefix when no slash present', () => {
      expect(getWorkspace('my-project')).toBe('default/my-project');
    });

    it('should fail when no workspace available', () => {
      expect(() => getWorkspace('')).toThrow('Workspace required');
      expect(core.setFailed).toHaveBeenCalled();
    });
  });

  describe('getCacheTagPrefix', () => {
    it('should return input cache tag when provided', () => {
      expect(getCacheTagPrefix('my-cache', 'bazel')).toBe('my-cache');
    });

    it('should use repository name as default', () => {
      process.env.GITHUB_REPOSITORY = 'owner/my-repo';
      expect(getCacheTagPrefix('', 'bazel')).toBe('my-repo');
    });

    it('should return bazel as final fallback', () => {
      expect(getCacheTagPrefix('', 'bazel')).toBe('bazel');
    });
  });

  describe('writeBazelrc', () => {
    // Import after mocks are set up
    let writeBazelrc: typeof import('../lib/utils').writeBazelrc;

    beforeAll(() => {
      writeBazelrc = require('../lib/utils').writeBazelrc;
    });

    it('should append remote cache config to ~/.bazelrc', () => {
      const expectedPath = path.join(os.homedir(), '.bazelrc');

      writeBazelrc(5000, false);

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        expectedPath,
        expect.stringContaining('--remote_cache=http://127.0.0.1:5000')
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        expectedPath,
        expect.stringContaining('--remote_upload_local_results=true')
      );
    });

    it('should disable uploads in read-only mode', () => {
      writeBazelrc(5000, true);

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('--remote_upload_local_results=false')
      );
    });

    it('should use the correct port', () => {
      writeBazelrc(8080, false);

      expect(fs.appendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('--remote_cache=http://127.0.0.1:8080')
      );
    });
  });
});
