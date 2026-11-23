# KORASTINE — Live Football Data v0.3

This is the previous premium prototype with a new real-data integration. **No real match data is included or fabricated.** You must configure an API-FOOTBALL key to retrieve live fixtures.

## Start

Requires Node.js 20+ (built-in fetch, no npm dependencies).

macOS/Linux:
```bash
export API_FOOTBALL_KEY='YOUR_KEY'
node server/server.js
```
Windows PowerShell:
```powershell
$env:API_FOOTBALL_KEY='YOUR_KEY'
node server/server.js
```
Open http://localhost:3000 (do not open index.html as a file for API integration).

Get a key: https://dashboard.api-football.com/register

## Endpoints
- GET /api/health — configuration and requests count
- GET /api/leagues — six supported competitions
- GET /api/fixtures — next fixtures for six competitions
- GET /api/today — today's fixtures in supported competitions (UTC date)

## Notes
- The free API plan limits season availability and has a daily quota. Some competitions may return no fixtures or provider errors. The UI shows a clear status and never disguises demo data as live.
- Each league fetch is cached for 30 minutes. Daily safety threshold of 90 provider requests leaves margin under the advertised 100/day free plan.
- League IDs: 233 Egyptian Premier League, 39 Premier League, 140 La Liga, 203 Süper Lig, 2 Champions League, 3 Europa League. Confirm coverage in your provider dashboard.
- The fixtures endpoint currently loads the next 20 matches per competition. To show historical matches, live fixtures, or richer statistics, add season-aware and date-filtered endpoints.
- Keep the key server-side. Never commit it or paste it into browser code.
- Predictions and streaming remain demo-only. This API supplies football data, **not** streaming rights.
