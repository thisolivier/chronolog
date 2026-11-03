# Port directory (Mac mini)

Chronolog's entry. Other projects should add theirs here or in a shared directory when one exists.

| Port | Service | Bind | Notes |
|------|---------|------|-------|
| 3123 | Chronolog app (production) | 127.0.0.1 | Reached via Cloudflare Tunnel and Tailscale only |
| 5173 | Chronolog dev server (vite) | ::1 | Development only |
| 5432 | Chronolog dev Postgres | 127.0.0.1 | Development only; production Postgres publishes no port |

Known occupied by other services on this machine: 4533, 4534, 5030, 5040, 5041, 6789, 8080 (UniFi),
8443, 8453, 8456, 8787–8792, 8843, 8880, 13378, 28082, 50300.
