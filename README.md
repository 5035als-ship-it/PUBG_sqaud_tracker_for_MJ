# PUBG Squad Tracker

Steam PUBG users `ClassMusic`, `MJPantyThief`, `Machine_Jun`, and `coca_cola_bear_` are refreshed by GitHub Actions and displayed through GitHub Pages.

## Setup

1. Create a PUBG API key from the official PUBG developer portal.
2. In your GitHub repository, add this secret:
   - `PUBG_API_KEY`
3. Optional Discord notifications:
   - Add `DISCORD_WEBHOOK_URL`
4. Enable GitHub Pages:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/docs`
5. Run the workflow manually once from `Actions > Update PUBG stats > Run workflow`.

The workflow updates `docs/data/pubg-stats.json` every hour and commits changes back to the repository.

## Local Refresh

```powershell
$env:PUBG_API_KEY="your-api-key"
node scripts/update-pubg.mjs
```

Then open `docs/index.html`.

