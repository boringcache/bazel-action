"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAvailablePort = exports.stopRegistryProxy = exports.waitForProxy = exports.startRegistryProxy = exports.getCacheTagPrefix = exports.getWorkspace = exports.ensureBoringCache = void 0;
exports.parseBoolean = parseBoolean;
exports.writeBazelrc = writeBazelrc;
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const action_core_1 = require("@boringcache/action-core");
Object.defineProperty(exports, "ensureBoringCache", { enumerable: true, get: function () { return action_core_1.ensureBoringCache; } });
Object.defineProperty(exports, "getWorkspace", { enumerable: true, get: function () { return action_core_1.getWorkspace; } });
Object.defineProperty(exports, "getCacheTagPrefix", { enumerable: true, get: function () { return action_core_1.getCacheTagPrefix; } });
Object.defineProperty(exports, "startRegistryProxy", { enumerable: true, get: function () { return action_core_1.startRegistryProxy; } });
Object.defineProperty(exports, "waitForProxy", { enumerable: true, get: function () { return action_core_1.waitForProxy; } });
Object.defineProperty(exports, "stopRegistryProxy", { enumerable: true, get: function () { return action_core_1.stopRegistryProxy; } });
Object.defineProperty(exports, "findAvailablePort", { enumerable: true, get: function () { return action_core_1.findAvailablePort; } });
function parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === '')
        return defaultValue;
    return String(value).trim().toLowerCase() === 'true';
}
/**
 * Write Bazel remote cache configuration to ~/.bazelrc.
 * Bazel always reads ~/.bazelrc after the workspace .bazelrc.
 */
function writeBazelrc(port, readOnly) {
    const bazelrcPath = path.join(os.homedir(), '.bazelrc');
    const config = [
        '',
        '# BoringCache remote cache',
        `build --remote_cache=http://127.0.0.1:${port}`,
        `build --remote_upload_local_results=${!readOnly}`,
        'build --remote_download_minimal',
        'build --jobs=2000',
        '',
    ].join('\n');
    fs.appendFileSync(bazelrcPath, config);
    core.info(`Configured Bazel remote cache in ${bazelrcPath}`);
}
