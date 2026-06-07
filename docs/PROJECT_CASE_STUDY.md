# JobFlow Project Case Study

## Overview

JobFlow is a Windows desktop job-search workspace that combines job tracking, AI resume tailoring, Gmail response monitoring, and browser-based job capture into one local-first application.

The goal was to replace a messy manual workflow with a tool that can:

- Capture job postings from supported job-board pages.
- Tailor a resume against the actual job description.
- Track which jobs have been captured, tailored, submitted, denied, or deleted.
- Monitor Gmail for recruiter and application responses.
- Export a clean PDF resume draft.
- Keep sensitive job-search data on the user's machine.

## My Role

This project covers product design, frontend development, backend API design, AI workflow engineering, Google OAuth/Gmail integration, Electron packaging, debugging, and Windows installer delivery.

## Problem

Applying for jobs often requires switching between:

- Job boards
- Resume documents
- Email inboxes
- AI chat tools
- Spreadsheets or notes
- Browser extensions
- Downloaded PDF versions

That creates missed follow-ups, inconsistent resume tailoring, and unclear application status. It also makes it hard to explain why a resume is or is not a good match for a specific job.

## Solution

JobFlow brings the workflow into one local desktop app:

1. Capture the job.
2. Tailor the resume.
3. Review match score and critique.
4. Export the resume.
5. Mark the job as submitted.
6. Monitor email responses.
7. Keep logs and records locally.

## Key Features

### Job Pipeline

The dashboard tracks jobs through practical application states:

- Captured
- Tailored
- Submitted
- Denied
- Interviewing
- Deleted/archived

This makes the app useful as more than a resume generator. It becomes a lightweight application CRM.

### AI Resume Tailoring

The Resume Tailor uses Gemini as the primary AI provider and supports OpenRouter as an optional fallback. The backend asks the model for:

- A tailored resume draft
- Brutally honest critique
- Match explanation
- Suggested missing skills
- Hard requirement warnings
- Relocation/onsite concerns

The AI prompt is intentionally strict. It instructs the model not to invent employers, dates, certifications, metrics, or paid IT experience. It also distinguishes between lab/project experience and professional work history.

### Deterministic Match Scoring

Instead of trusting the model's estimated match percentage, JobFlow recalculates match score server-side using a weighted formula:

```text
40% Skills
30% Experience
20% Certifications
10% Keywords
```

This is important because AI models often inflate scores or provide inconsistent estimates. The deterministic scoring system makes the result explainable and easier to defend in an interview.

### Resume Formatting Controls

The app includes a repair layer for AI-generated Markdown. Recent improvements focused on keeping resumes clean and professional:

- Job title/company/location/date lines are rendered as emphasized section headings.
- Resume bullets use plain hyphen bullets.
- Stray asterisks and malformed bold markers are removed.
- Bullet labels are not over-styled.
- Polished resumes preserve enough detail for a 1.5-2.5 page target instead of becoming generic one-page summaries.

### Gmail Response Tracker

JobFlow connects directly to Gmail through Google OAuth and Gmail API scopes. It does not use Firebase. The response tracker can identify recruiter/application emails and associate them with active jobs, including job-board-style messages from platforms such as Indeed and LinkedIn.

Important engineering details:

- OAuth client ID is configured through `.env` or the app UI.
- Gmail API scopes include read and modify access for message tracking.
- Email matching logic avoids accidentally hiding relevant messages.
- Runtime logs expose sync behavior for debugging.

### Chrome Extension Capture

The `jobflow-chrome-extension/` folder contains a Manifest V3 extension for scraping supported job pages and posting the captured data to the local JobFlow server.

This shows browser extension experience alongside the desktop app:

- Content script extraction
- Background service worker
- Localhost API communication
- Job-board matching rules

### Windows Desktop Packaging

JobFlow is packaged with Electron and electron-builder as a Windows NSIS installer. The backend Express server is bundled into `dist/server.cjs`, launched by Electron, and served through `localhost:3000`.

The packaged app includes:

- Electron desktop shell
- Bundled Express server
- Vite-built React frontend
- Runtime `.env` loading from app/user data paths
- Windows installer output
- PowerShell script for patching an installed local build during development

## Architecture

```text
Chrome Extension
  |
  | POST job data
  v
Express API on localhost:3000 <---- React UI inside Electron
  |
  |-- Local JSON stores
  |-- Gemini/OpenRouter AI provider layer
  |-- Gmail OAuth/API integration
  |-- Resume Markdown repair and scoring
  v
Windows desktop app
```

## Engineering Challenges

### AI Provider Reliability

OpenRouter free models were inconsistent and sometimes returned 404/429 provider errors. Gemini was faster and more reliable for this use case, so the provider priority was changed to Gemini first with OpenRouter as optional fallback.

### Gemini Authentication Differences

The Gemini SDK path produced authentication issues for the user's key. The backend was updated to use the Gemini REST API directly with the `X-goog-api-key` header, matching the successful API request format.

### AI Response Shape Instability

The model occasionally returned arrays or objects where strings were expected. The backend now coerces AI response fields into stable strings before validation, markdown repair, and UI display.

### Packaged App Configuration

Electron packaging introduced runtime environment issues because installed apps cannot rely on the same `.env` file path as development. The app now supports runtime `.env` loading for installed builds.

### Resume Formatting Quality

AI-generated Markdown often included unwanted asterisk bullets and bold markers. The solution combined:

- Prompt updates
- Server-side Markdown cleanup
- Frontend renderer simplification
- CSS targeting only job title/company/date headings

## What This Demonstrates

This project demonstrates:

- Building a production-style desktop app with web technologies.
- Designing a local-first architecture without a hosted database.
- Integrating real OAuth and Gmail API workflows.
- Creating a browser extension that talks to a local desktop backend.
- Working with AI models while guarding against hallucinations and malformed output.
- Debugging a packaged Electron application on Windows.
- Turning vague AI output into deterministic, explainable product behavior.
- Shipping an installable app instead of only a development server.

## Future Improvements

- Add automated tests around match scoring and Markdown repair.
- Add encrypted storage for secrets and OAuth tokens.
- Expand Chrome extension support for more job boards.
- Add import/export for job pipeline backups.
- Add a sample/demo mode with fake data for public walkthroughs.
- Add signed Windows installer distribution.

## Interview Summary

JobFlow is a strong interview project because it is not only a CRUD app. It combines frontend state management, backend APIs, AI provider integration, deterministic algorithms, OAuth, browser extension development, local persistence, desktop packaging, and real-world debugging.

The most important technical theme is control: the app uses AI where it helps, but keeps scoring, validation, formatting, persistence, and workflow state under deterministic application logic.
