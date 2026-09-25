# Third-party notices

This repository integrates the following upstream projects.

- MoonTV: <https://github.com/Stardm0/MoonTV>, MIT License. The destination
  repository is <https://github.com/yaojerry2025/MoonTV>.
- edgetunnel: <https://github.com/cmliu/edgetunnel>, GPL-2.0-only License,
  fixed at commit `a4330bf7664732b73788febf9e6ed9cce7defdb7` (version
  `2026-09-22 20:01:17`). Its readable source, upstream README, and unmodified
  license text are in `vendor/edgetunnel/`.

The integrated copy changes only the outbound TCP adapter: Cloudflare Workers
uses the documented `cloudflare:sockets` `connect` import instead of the
upstream request-internal connector. `src/worker/pages-dispatcher.mjs` is the
separate routing layer and does not alter edgetunnel's protocol implementation.
