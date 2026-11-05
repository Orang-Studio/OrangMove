# OrangMove - Safety Analysis

the OrangMove upload/serve service (Rust backend + React SPA) and its
intended deployment behind nginx + Anubis + Cloudflare on oranges.lt.

## Threat model

Anonymous internet users can upload and download files. There is no login. We
assume an attacker will try to: run code on the server, read other people's
files or files outside the store, fill the disk, get a malicious file to execute
in a victim's browser under our origin, or abuse us as free bulk storage.

## Controls in place

| Risk | Control | Where |
|------|---------|-------|
| Guessing other people's links | 256-bit CSPRNG token, base64url (43 chars). No enumeration. | `token.rs` |
| Path traversal (`../`, absolute, null) | Tokens validated against a strict charset before any FS call; disk path is `dir/<token>` with no user-supplied component. | `token.rs`, `store.rs:path_for` |
| Code execution on server | Files are never executed, decompressed, or passed to a shell. Inert bytes. | by design |
| Executables and scripts | **Accepted.** Never executed, decompressed or shelled out to; served as a forced `attachment` under `nosniff`, and the preview has no renderable type for them. The risk is to whoever runs the file, not to this server. | `routes.rs`, by design |
| Oversized upload / single-file DoS | 1 GiB cap counted live during streaming; `Content-Length` is not trusted; partial file deleted on abort. | `routes.rs`, `lib.rs` (DefaultBodyLimit) |
| Disk exhaustion over time | Global live-storage cap (`ORANG_MAX_TOTAL`, default 20 GiB) → `507` when full. | `store.rs:live_total`, `routes.rs` |
| Request flooding | Per-IP rate limit (burst 60, refill 1/s) keyed on X-Forwarded-For/X-Real-IP. | `main.rs`, `lib.rs:rate_limited` |
| Stored XSS via "view in browser" | Served as `application/octet-stream` + `nosniff` + `Content-Security-Policy: default-src 'none'; sandbox`, and embedded in an iframe with `sandbox=""` (no scripts, no same-origin). | `routes.rs:view`, `ResultPage.tsx` |
| Drive-by download tricks | Download endpoint forces `Content-Disposition: attachment` + `nosniff`. | `routes.rs:download` |
| Header injection via filename | Filename stripped of path, control chars, quotes, backslashes; length-capped. | `store.rs:sanitize_name` |
| SQL injection | All queries parameterized (sqlx bind). | `store.rs` |
| Stale files lingering | Reaper deletes expired files + rows every 5 s; access after expiry → 404. | `main.rs`, `store.rs:reap` |

## Residual risks & required deployment hardening

These are real and must be handled in deployment, not code:

1. **Rate-limit IP spoofing.** The limiter trusts `X-Forwarded-For`. If the
   backend is reachable directly, a client can forge that header and bypass the
   limit. **Mitigation:** bind the backend to `127.0.0.1:8080` only (the systemd
   unit does this) so the only path in is nginx, which overwrites `X-Real-IP`
   with the true peer.

2. **Cloudflare 100 MB body cap.** Cloudflare's proxy (orange cloud, and CF
   Tunnel) rejects request bodies over 100 MB on Free/Pro. The upload/file
   subdomain must therefore be **DNS-only (grey cloud)** pointing at the server,
   not proxied and not behind a tunnel. Otherwise the 1 GiB limit silently
   becomes ~100 MB.

3. **Anubis must not front the file API.** Anubis issues a proof-of-work
   challenge; that breaks programmatic downloads and large uploads. Anubis fronts
   the **app** subdomain (static SPA) only. The **files** subdomain goes straight
   to the backend.

4. **Origin isolation.** Untrusted file bytes are served from a separate
   subdomain (`files.*`) than the app (`move.*`). Even though `view` is already
   neutralised, this keeps any future slip from touching the app origin or its
   cookies. CORS is locked to the app origin via `APP_ORIGIN`.

5. **TLS.** Terminated at nginx (Let's Encrypt). Backend speaks plain HTTP on
   loopback only.

6. **No malware/AV scanning, and no file-type blocklist.** Any type may be
   uploaded, executables included. Files are short-lived (≤1 h) and never
   executed here, so the server is safe; recipients are responsible for what
   they open. Document this in the ToS.

7. **Abuse / illegal content.** No moderation. Short TTLs limit exposure; keep
   nginx access logs and have a takedown path. Consider lowering `ORANG_MAX_TOTAL`
   and the max TTL if abuse appears.

## Verified by tests

`cargo test`: live size-cap abort, lying Content-Length, executables accepted
and served inert, scripts accepted, bad TTL, malformed/traversal token,
expired-token 404, view sandbox headers, happy-path byte round-trip, byte
ranges, storage cap → 507, rate limit → 429.
