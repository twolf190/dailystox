# DailyStox

A local stock and ETF dashboard that runs at `http://localhost:5177`.

Local-run scripts (start/stop/install-node/build-release) live in [sandbox/](sandbox/).

## One-click startup

Double-click `sandbox/start.bat`.

The startup script:

1. Moves into this project folder.
2. Starts the local Node server against whatever code is currently on disk (no `git pull` — this is just a local test env for the branch you have checked out).
3. Opens the app in your browser.

## Stop the server

Double-click `sandbox/stop-dailystox.bat`.

This stops the saved DailyStox server process and anything still listening on port `5177`.

## Local Node.js install

If Windows cannot find Node.js 18 or newer, double-click `sandbox/install-node-local.bat`.

This downloads the official Windows x64 Node.js LTS zip into `.runtime/node`. It does not require admin rights and does not install Node globally.

## Build a Shareable Zip

Double-click `sandbox/build-release.bat`.

It creates:

```text
release/DailyStox/
release/DailyStox.zip
```

Send `release/DailyStox.zip` to first-time users. It excludes development files like `.git`, `.runtime`, logs, and your local watchlist data.

## Notes

- Requires Node.js 18 or newer.
- Watchlist data is saved in `data/watchlist.json`.
- Market data is fetched from Yahoo Finance's public endpoints when the app is running.
- Quotes refresh every 15 seconds. Exchange delays and endpoint availability depend on Yahoo Finance.
