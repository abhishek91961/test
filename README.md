# Typesense Frontend Monitor

A zero-backend web app to monitor a Typesense cluster and inspect collection data directly from the browser.

## Features

- Browser-only connection (host + API key) with localStorage persistence.
- Cluster health and stats overview (`/health`, `/stats.json`, `/collections`).
- Collection list and schema viewer.
- Document search UI using Typesense search API.

## Run

Serve the folder with any static server, for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

> Note: Your Typesense server must allow browser CORS for your origin.
