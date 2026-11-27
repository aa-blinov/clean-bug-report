# Tickets Cloudflare Worker

Creates GitHub Issues on behalf of the form without exposing a GitHub token to the browser.

## Deploy

1. Create a fine-grained GitHub PAT with **Issues: Read and write** on the repositories listed in `ALLOWED_REPOS` in `wrangler.toml`.
2. Store the token as a Wrangler secret and deploy:

```bash
cd workers/tickets
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

3. Set `VITE_TICKETS_API_URL` (e.g. `https://clean-bug-report-tickets.<subdomain>.workers.dev/tickets`) in GitHub Actions repository variables so the static frontend submits tickets directly.
