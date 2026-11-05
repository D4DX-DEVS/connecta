# Connecta on Cloudflare

One Worker serves the API (`/api/*`), uploaded files from R2 (`/files/*`) and the React build (static assets).
Data lives in D1 (`connecta`), uploads in R2 (`connecta-uploads`).

```bash
cd frontend && npm run build        # uses .env.production (REACT_APP_API_URL=/api)
cd ../worker && npm install
npx wrangler secret put JWT_SECRET  # once
npm run db:init -- --remote         # apply migrations
npm run deploy
```

Local: copy `.dev.vars.example` to `.dev.vars`, run `npx wrangler dev`.

`scripts/` holds the one-off Mongo + DigitalOcean Spaces -> D1 + R2 migration used for the move.
