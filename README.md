# DailyStox

A local stock and ETF dashboard that runs at `http://localhost:5177`.

## One-click startup

Double-click `start.bat`.

The startup script:

1. Moves into this project folder.
2. Runs `git pull --ff-only` for the currently checked-out branch when that branch has an upstream.
3. Starts the local Node server.
4. Opens the app in your browser.

## Stop the server

Double-click `stop-dailystox.bat`.

This stops the saved DailyStox server process and anything still listening on port `5177`.

## Test branches

`start.bat` does not force `main`. It starts whatever branch is currently checked out.

Create and test a branch:

```powershell
git switch -c my-test-branch
start.bat
```

Return to main:

```powershell
stop-dailystox.bat
git switch main
start.bat
```

If a branch has no upstream remote, startup skips `git pull` and runs your local branch as-is.

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

## Local Node.js install

If Windows cannot find Node.js 18 or newer, double-click `install-node-local.bat`.

This downloads the official Windows x64 Node.js LTS zip into `.runtime/node`. It does not require admin rights and does not install Node globally.

## Notes

- Requires Node.js 18 or newer.
- Watchlist data is saved in `data/watchlist.json`.
- Market data is fetched from Yahoo Finance's public endpoints when the app is running.
- Quotes refresh every 15 seconds. Exchange delays and endpoint availability depend on Yahoo Finance.
