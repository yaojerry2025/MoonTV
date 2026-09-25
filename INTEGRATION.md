# MoonTV + edgetunnel Cloudflare Workers integration

## Architecture and routes

`src/worker/pages-dispatcher.mjs` is passed to `@cloudflare/next-on-pages` as
the custom entrypoint. The generated handler is deployed as a Cloudflare Worker
with Workers Static Assets. It imports the MoonTV fetch handler and the vendored
edgetunnel module. MoonTV is the default handler.

| Request | Handler |
| --- | --- |
| `/`, `/login`, `/admin`, `/search`, `/play`, `/ranking`, `/douban`, `/api/*`, `/_next/*`, and all other normal pages | MoonTV |
| `/version` | edgetunnel; the dispatcher supplies the secret UUID internally |
| `/<UUID>` and `/sub` | edgetunnel subscription |
| `/e_login`, `/e_admin`, `/e_admin/*` | edgetunnel's renamed administrative routes |
| Non-MoonTV WebSocket upgrades, gRPC, and UUID-specific HTTP padding traffic | edgetunnel |

MoonTV's `/login`, `/admin`, and all `/api/*` routes always win, including
`/api/search/ws`; edgetunnel never receives them.

## Fixed upstream

edgetunnel is pinned to `a4330bf7664732b73788febf9e6ed9cce7defdb7`, version
`2026-09-22 20:01:17`. See `THIRD_PARTY_NOTICES.md` and
`vendor/edgetunnel/LICENSE` for provenance and licensing.

## Build and local verification

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm run worker:build
npx wrangler dev
```

`worker:build` sets `CF_PAGES=1`, runs the ordinary MoonTV
next-on-pages build, then uses the custom entrypoint to create the final
`.vercel/output/static/_worker.js` and copies the complete module directory to
the ignored `.worker/` deployment directory. Wrangler deploys those modules
with preserved filenames, while `.assetsignore` prevents the server modules
from being published as static assets. On Windows, run the build from WSL or
use Developer Mode because Vercel Build Output uses symbolic links. The deploy
target is Cloudflare Workers with static assets, not Vercel or Pages.

## Cloudflare configuration and deployment

Required secrets (never commit their values):

- `PASSWORD`: MoonTV administrator password.
- `UUID`: a UUIDv4 used by edgetunnel.

Required bindings: KV namespace binding `KV` for persistent edgetunnel
configuration and D1 binding `DB` for MoonTV. MoonTV D1 mode also needs
`NEXT_PUBLIC_STORAGE_TYPE=d1`, `USERNAME` (configured as `admin`), and
`PASSWORD`, plus the schema from `d1-init.sql`. Without KV, the dispatcher provides a per-isolate default for
subscriptions but e_admin configuration changes are not durable.

```powershell
npx wrangler secret put PASSWORD
npx wrangler secret put UUID
pnpm run deploy:worker
```

`deploy:worker` only builds and deploys Worker `tvtoolstest`; it contains no
passwords, tokens, or UUIDs. Enable gRPC in the Cloudflare zone where the
Worker route is attached before using XHTTP/gRPC.

The current production custom domain is `https://tvtoolstest.yaogame.com`.
It is attached to `tvtoolstest` through the Workers custom-domain control and
gRPC is enabled in the `yaogame.com` Network settings. Keep that zone setting
enabled when redeploying or changing the custom domain.

## Updating and rollback

For MoonTV, fetch `upstream/main`, review it, merge it into `integrated-pages`,
then rebuild and test. For edgetunnel, choose a new explicit commit, replace
the files under `vendor/edgetunnel/`, update the notices and test routes before
deployment. Roll back by redeploying a previously verified git commit or by
using a previous verified Workers deployment; do not force-push `main`.
