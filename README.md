# KORASTINE — Vercel-ready v0.5

Arabic RTL football platform prototype for 6 leagues, with API-FOOTBALL serverless backend.

## Deploy from GitHub to Vercel

1. Import the GitHub repository on Vercel.
2. Choose **Framework Preset: Other**, Root Directory `./`, leave Build Command and Output Directory **blank/default**.
3. Set an Environment Variable named `API_FOOTBALL_KEY` to a **fresh, private** API-FOOTBALL key. Do **not** add the actual key to files or Git history.
4. Deploy. Check `/api/health` (must show `configured: true`) and `/api/fixtures`.

## Serverless endpoints

- `/api/health` — key configuration, without exposing its value.
- `/api/leagues` — the six competition IDs.
- `/api/fixtures` — next fixtures from each competition (parallel calls).
- `/api/today` — matches today (UTC date) in six leagues.

## Important limitations

- API-FOOTBALL free plans may not provide current-season data across all leagues.
- Serverless functions don't share persistent in-memory caches or rate limits. This version does **not** implement server-side quota protection. Every page load can trigger six provider calls, so monitor API usage and add a persistent cache before public traffic. Limit automatic polling.
- The `/api/fixtures` endpoint only loads upcoming fixtures, not currently live or completed games.
- Predictions, leaderboards and streaming are still demos; no unauthorized broadcasts are provided.
- `index.html` is a static frontend, and `api/*` are Vercel Node functions. `server/server.js` from earlier versions is not required here.
