# boringcache/bazel-action

Run a Bazel remote cache backed by BoringCache.

The action starts a local HTTP proxy and points Bazel at it with `--remote_cache`.

## Quick start

```yaml
- uses: boringcache/bazel-action@v1
  with:
    workspace: my-org/my-project
    read-only: ${{ github.event_name == 'pull_request' }}
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name == 'pull_request' && '' || secrets.BORINGCACHE_SAVE_TOKEN }}

- run: bazel build //...
```

## What it does

- Installs the CLI.
- Starts a local cache-registry proxy.
- Configures Bazel to talk to that proxy.
- Flushes pending uploads when the job finishes.

## Key inputs

| Input | Description |
|-------|-------------|
| `workspace` | Workspace in `org/repo` form. Defaults to the repo name. |
| `cache-tag` | Cache tag prefix. Defaults to the repo name. |
| `read-only` | Disable uploads on PRs or other low-trust jobs. |
| `proxy-port` | Port for the local proxy. |
| `proxy-no-git` / `proxy-no-platform` | Adjust tag scoping for special cases. |
| `cli-version` | CLI version to install. |

## Outputs

| Output | Description |
|--------|-------------|
| `cache-tag` | Resolved cache tag. |
| `proxy-port` | Proxy port in use. |
| `proxy-log-path` | Path to the proxy log on the runner. |
| `workspace` | Resolved workspace name. |

## Docs

- [GitHub Actions docs](https://boringcache.com/docs#language-actions)
- [GitHub Actions auth and trust model](https://boringcache.com/docs#actions-auth)
- [Native proxy integrations](https://boringcache.com/docs#cli-cache-registry)
