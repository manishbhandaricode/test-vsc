# Tapas's Ruilings Atlas

A Vercel-ready rebuilt copy of the Tapas's Ruilings Atlas workspace, bundled with the local ruling dataset for static deployment.

## Features

- Local rulings catalogue loaded from `assets/data/ruilings.json`
- Keyword search, category, sub-category, stage, court, and sort filters
- Result cards with pagination and expanded legal detail blocks
- Issue, holding/ratio, category, sub-category, stage, court, statutory anchors, practice notes, related details, web references, and data provenance shown on each card
- Detail modal with full issue, holding, tags, notes, sources, and companion authorities
- Add, edit, delete, copy citation, reset, and main website controls
- Keyboard-accessible cards and search relevance ranking
- Local browser persistence for edits, custom rulings, and locally deleted bundled entries
- Static deployment on Vercel with no build step

## Run

Serve the folder with any static server, or use:

```bash
npm start
```

## Deploy

Import this repository into Vercel and keep the default static project settings.
