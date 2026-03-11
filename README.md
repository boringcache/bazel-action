# boringcache/bazel-action

**Cache once. Reuse everywhere.**

Bazel remote cache backed by BoringCache. This action starts a local HTTP cache proxy that Bazel talks to natively via `--remote_cache`. No bulk save/restore steps needed.

## Quick start

```yaml
- uses: boringcache/bazel-action@v1
  with:
    workspace: my-org/my-project
  env:
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}

- run: bazel build //...
```

The action configures `~/.bazelrc` with `--remote_cache` pointing at the local proxy. Bazel reads and writes cache entries through the proxy transparently.
It also sets `--remote_max_connections=64` by default (override with `BORINGCACHE_BAZEL_REMOTE_MAX_CONNECTIONS`).

## How it works

1. **Main step**: Installs the BoringCache CLI, starts a local HTTP cache proxy, and appends remote cache settings to `~/.bazelrc`.
2. **Build**: Bazel reads/writes cache entries via the proxy using its native HTTP cache protocol.
3. **Post step**: Stops the proxy (flushes any pending uploads).

No explicit save or restore is needed. The proxy handles cache reads and writes as Bazel requests them.

## Read-only mode

For pull request builds, set `read-only: true` and provide only a restore-capable token. Trusted branch/tag jobs can add `BORINGCACHE_SAVE_TOKEN` when writes are allowed:

```yaml
- uses: boringcache/bazel-action@v1
  with:
    workspace: my-org/my-project
    read-only: ${{ github.event_name == 'pull_request' }}
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `cli-version` | `v1.12.1` | BoringCache CLI version. Set to `skip` to disable automatic setup. |
| `workspace` | | BoringCache workspace (e.g., `my-org/my-project`). |
| `cache-tag` | repo name | Cache tag prefix. |
| `proxy-port` | `5000` | Port for the cache proxy. |
| `read-only` | `false` | Don't upload build results (useful for PRs). |
| `proxy-no-git` | `false` | Pass `--no-git` to the proxy. |
| `proxy-no-platform` | `false` | Pass `--no-platform` to the proxy. |
| `verbose` | `false` | Enable verbose CLI output. |

## Outputs

| Output | Description |
|--------|-------------|
| `cache-tag` | Resolved cache tag. |
| `proxy-port` | Proxy port used. |
| `proxy-log-path` | Path to the proxy log file on the runner. |
| `workspace` | Resolved workspace. |
