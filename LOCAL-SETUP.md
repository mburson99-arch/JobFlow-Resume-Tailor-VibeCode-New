# JobFlow Local Standalone Desktop Setup (Option 2)

Welcome! By choosing **Option 2**, you have selected the lightweight, secure, and privacy-first local hosting model. This bundles both the React frontend and Node.js Express/Vite backend with your databases to run directly on your own machine. Your data remains stored inside your local directories (`jobs_db.json`, `emails_db.json`, etc.) and is never synced to external multi-tenant cloud storage unless you configure it.

---

## 🚀 Quick Start Guide

### Step 1: Export Your Project
1. Open the **Settings/Project Menu** in the Google AI Studio builder web page.
2. Select **Export as ZIP** or **Export to GitHub**.
3. Unzip the downloaded folder into any directory on your computer (e.g., `Documents/JobFlow`).

### Step 2: Install Node.js (If you don't already have it)
JobFlow's backend runs on Node.js to manage file storage and route LLM queries.
* Download & install Node.js (version 18 or above is recommended) from [https://nodejs.org/](https://nodejs.org/).
* The local launcher scripts will automatically check this and guide you on your first run.

### Step 3: Run the Desktop Boot Launcher
We've built automated double-clickable launchers explicitly for your operating system:

#### 💻 Windows PC
1. Double-click the file named `Run-JobFlow-Windows.bat` in the project root directory.
2. A terminal window will open, perform the system health checks, automatically run `npm install` for you, copy your parameters template, and boot the backend.
3. Your default web browser will automatically load the local address: [http://localhost:3000](http://localhost:3000).

#### 🍎 macOS or 🐧 Linux
1. Open your terminal application.
2. Navigate to your project folder:
   ```bash
   cd /path/to/downloaded/JobFlow
   ```
3. Make the script executable and run it:
   ```bash
   chmod +x Run-JobFlow-MacLinux.sh
   ./Run-JobFlow-MacLinux.sh
   ```
4. Done! Your default browser will connect to the workspace.

---

## 🔑 AI Key Alignment

To use Gemini's AI tailoring capabilities locally on your PC, you will need to add your personal developer API Key:
1. Locate the `.env` file generated in the project root folder.
2. Open it with any text editor (Notepad, TextEdit, VS Code).
3. Find the line:
   ```env
   GEMINI_API_KEY="your_actual_api_key_here"
   ```
4. Replace `"your_actual_api_key_here"` with your real Google Gemini API Key from Google AI Studio.
5. Save the file and restart your launcher!

---

## 🗄️ Where Is My Data Kept?

All your pipeline records, tailoring configurations, logs, and Gmail tracking rules are saved locally inside individual JSON schema files inside this root directory:
* `jobs_db.json` — Stores actively captured corporate job records, match weights, and tailored summaries.
* `profile_db.json` — Pre-loaded with your default candidate resume, certification matrix, and credentials.
* `emails_db.json` — Tracks sorted communication details.
* `logs_db.json` — System tracer notes detailing live routing actions.

You are completely in control of your data. To backup your entries, simply duplicate these files or backup your entire unzipped directory!
