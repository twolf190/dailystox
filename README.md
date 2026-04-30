# DailyStox

A local stock and ETF dashboard that runs at `http://localhost:5177`.

## One-click startup

Double-click `start.bat`.

The startup script:

1. Moves into this project folder.
2. Runs `git pull --ff-only` when the folder is connected to a git repository.
3. Starts the local Node server.
4. Opens the app in your browser.

## Repository setup

After creating a GitHub repository, connect this folder once:

```powershell
git init
git add .
git commit -m "Initial DailyStox app"
git branch -M main
git remote add origin <your-repository-url>
git push -u origin main
```

After that, `start.bat` will pull the latest changes before launching.

## Notes

- Requires Node.js 18 or newer.
- Watchlist data is saved in `data/watchlist.json`.
- Market data is fetched from Yahoo Finance's public endpoints when the app is running.
- Quotes refresh every 15 seconds. Exchange delays and endpoint availability depend on Yahoo Finance.
