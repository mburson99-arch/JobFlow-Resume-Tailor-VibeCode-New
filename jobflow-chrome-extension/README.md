# JobFlow Chrome Extension

This folder contains the unpacked Chrome extension used to capture job postings from supported job-board pages and send them into the local JobFlow desktop app.

## What It Does

- Injects a floating **Sync to JobFlow** button on supported job pages.
- Extracts job title, company, URL, description, and capture date.
- Reads structured `JobPosting` JSON-LD when available.
- Falls back to common Indeed and LinkedIn DOM selectors.
- Posts captured job data to the local JobFlow API.

## Supported Local API Targets

```text
http://localhost:3000/api/jobs/scrape
http://127.0.0.1:3000/api/jobs/scrape
```

## Install for Local Development

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `jobflow-chrome-extension/` folder.
5. Start JobFlow locally or open the installed desktop app.
6. Visit a supported job page and click **Sync to JobFlow**.

## Files

- `manifest.json`: Manifest V3 permissions, host matches, and script registration.
- `content.js`: Job-page scraping, floating button injection, and message dispatch.
- `background.js`: Posts scraped job data to the local JobFlow backend.

## Interview Notes

This extension demonstrates browser automation without requiring a hosted backend. It bridges the browser and the local Electron/Express app through localhost, which keeps job-search data local while still making job capture fast.
