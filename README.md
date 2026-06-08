# JobFlow

JobFlow is a Windows desktop job-search command center built with React, Express, Gemini, Gmail API, Chrome Extension APIs, and Electron. It helps capture job postings, tailor resumes against real job descriptions, track recruiter emails, and keep a local audit trail of every application workflow step.

This project is designed as both a practical job-search tool and a portfolio-grade demonstration of full-stack desktop application development: local data persistence, OAuth integration, AI workflow design, deterministic scoring, installer packaging, and production debugging.

## Why This Project Matters

Most job-search workflows are scattered across browser tabs, spreadsheets, email inboxes, downloaded resumes, and AI chat windows. JobFlow consolidates that workflow into one local desktop app:

- Capture jobs from LinkedIn/Indeed or manual entry.
- Tailor a resume against a specific job description.
- Get recruiter-style critique and hard requirement warnings.
- Calculate a deterministic match score instead of trusting a hallucinated AI percentage.
- Export a clean PDF resume.
- Track which applications were captured, tailored, submitted, archived, or deleted.
- Monitor Gmail for recruiter/application responses and associate messages with jobs.

## Product Highlights

- **Pipeline Desk**: Tracks active, submitted, archived/deleted, and tailored roles with a dedicated submitted tab for completed applications.
- **AI Resume Tailor**: Uses Gemini to produce a tailored resume, critique, recruiter warnings, suggested skills, relocation detection, and match explanation.
- **Strict Refinement Mode**: Allows targeted edits to the current resume draft without restarting from the base resume.
- **Polish Draft Workflow**: Humanizes the resume, cleans formatting, keeps truthful detail, and enforces a practical 1.5-2.5 page target.
- **Deterministic Match Score**: Recalculates every AI result with a weighted formula instead of accepting the model's guessed score.
- **Formatting Repair**: Normalizes resume layout, removes malformed Markdown markers, uses clean hyphen bullets, and keeps job title/company/date lines visually emphasized.
- **Gmail Response Tracker**: Uses Google OAuth and Gmail API scopes to monitor recruiter and job-board messages directly from the local app.
- **Chrome Extension Capture**: An unpacked extension can scrape supported job pages and send job descriptions to the local backend.
- **Local-First Persistence**: Stores jobs, profile data, emails, logs, deleted jobs, and AI summaries in local JSON files.
- **Windows Desktop Packaging**: Ships through Electron with an NSIS installer and a bundled Express backend.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, `react-markdown`, `html2pdf.js`
- **Backend**: Express, TypeScript, Node.js, local JSON persistence
- **Desktop Runtime**: Electron, electron-builder, NSIS
- **AI Providers**: Gemini primary, OpenRouter fallback support
- **Email Integration**: Google OAuth + Gmail API
- **Browser Integration**: Manifest V3 Chrome extension for job capture
- **Build Tooling**: Vite, esbuild, PowerShell patch script for installed-app updates

## Architecture

```text
React UI
  |
  | fetch /api/*
  v
Express server on localhost:3000
  |
  |-- Local JSON storage
  |-- Gemini/OpenRouter AI provider layer
  |-- Gmail API/OAuth workflows
  |-- Chrome extension scrape endpoint
  v
Electron desktop shell
```

The packaged app launches an Electron window, starts the bundled Express server, waits for the local server to become available, then loads `http://localhost:3000`. Runtime secrets can be loaded from the Electron user-data `.env` file so the installed app can use Gemini/Gmail without rebuilding.

## Resume Tailoring and Scoring

JobFlow deliberately separates AI generation from scoring:

```text
Total Score =
  40% Skills
  30% Experience
  20% Certifications
  10% Keywords
```

The AI can rewrite and critique the resume, but the app recalculates match score server-side using job-description terms, resume terms, required certifications, and experience requirements. This keeps the percentage explainable in interviews and avoids the "AI always says 90%" problem.

## AI Safety and Resume Integrity

The backend prompt and cleanup pipeline enforce several resume-specific safeguards:

- Do not invent employers, job titles, dates, certifications, metrics, or paid IT experience.
- Treat lab work as lab/project experience unless the base resume says it was paid work.
- Preserve contact details exactly.
- Restore the previous job status if the AI provider fails.
- Retry refinement once if the model returns an unchanged draft.
- Validate requested refinement terms before accepting a result.
- Coerce AI response fields to stable strings before validation and formatting.
- Clean malformed Markdown, stray asterisks, collapsed headings, and over-short outputs.

## Desktop and Local Data

JobFlow is intentionally local-first. The app writes runtime data to the user's application data directory rather than requiring a hosted database. This keeps the project easy to demo, easier to reason about, and safer for personal job-search data.

Typical local stores include:

- `jobs_db.json`
- `emails_db.json`
- `profile_db.json`
- `logs_db.json`
- `deleted_jobs_db.json`

## Chrome Extension

The `jobflow-chrome-extension/` folder contains a Manifest V3 extension that can capture job details from supported job-board pages and post them to the local JobFlow server.

The extension is intentionally unpacked for easy portfolio review:

- `manifest.json`: permissions and page matches
- `content.js`: page scraping and UI injection
- `background.js`: extension-to-localhost request handling

## Local Development

Prerequisites:

- Node.js 22+
- Gemini API key
- Google OAuth Web Client ID if using live Gmail monitoring

Install dependencies:

```bash
npm install
```

Create a local `.env` file from `.env.example`, then set:

```bash
GEMINI_API_KEY="your_gemini_key"
GEMINI_MODEL="gemini-flash-latest"
VITE_GOOGLE_CLIENT_ID="your_google_oauth_web_client_id.apps.googleusercontent.com"
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Run a production build:

```bash
npm run build
```

## Google OAuth Setup

JobFlow connects directly to Gmail using Google OAuth and the Gmail API. It does not use Firebase.

In Google Cloud Console:

1. Enable Gmail API.
2. Create an OAuth Client ID.
3. Application type: Web application.
4. Add this authorized JavaScript origin:

```text
http://localhost:3000
```

5. Add your Gmail account as a test user while the app is in testing mode.
6. Paste the client ID into JobFlow's Email Monitor or set `VITE_GOOGLE_CLIENT_ID`.

Required scopes:

```text
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.modify
```

## Build Windows Installer

Build the production frontend and bundled server:

```bash
npm run build
```

Create a Windows installer:

```bash
npm run dist:win
```

The installer appears in:

```text
release/
```

For a smaller alternate output folder during local testing:

```bash
npx electron-builder --win nsis --config.directories.output=release-small
```

## Patch an Installed Local Build

During development, the installed app can be updated without rebuilding the installer:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\patch-installed.ps1
```

This script stops running JobFlow/Electron/Node processes, builds the app, copies the latest `dist/`, `electron/`, and `package.json` into the installed app directory, and then the app can be relaunched.

## Key Points

- Built a full-stack local desktop app with React, Express, Electron, and Windows installer packaging.
- Integrated Gemini through a provider abstraction with OpenRouter fallback and robust error recovery.
- Replaced AI-guessed resume scores with deterministic, explainable scoring logic.
- Implemented Google OAuth/Gmail API integration without Firebase.
- Built a Chrome extension to capture job descriptions from job boards into the desktop app.
- Added local persistence, audit logs, live debugging hooks, and status restoration when AI calls fail.
- Improved AI prompt design and post-processing to prevent hallucinated work history and malformed resumes.
- Debugged production-like issues in a packaged Electron app, including runtime `.env` loading, stale bundles, and provider authentication differences.

## Documentation

- `docs/PROJECT_CASE_STUDY.md`: interview-friendly project walkthrough and engineering narrative.
- `jobflow-chrome-extension/`: unpacked extension source.
- `scripts/patch-installed.ps1`: local installed-app patch workflow.

## Status

JobFlow is actively developed as a practical personal job-search tool and a portfolio project. Current focus areas include AI resume quality, deterministic scoring, Gmail response tracking, and polished Windows desktop packaging.
