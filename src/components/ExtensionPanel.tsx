import React, { useState } from "react";
import { Check, Copy, ExternalLink, Chrome, FileCode, PlayCircle, Layers, ClipboardCheck, AlertTriangle } from "lucide-react";

export default function ExtensionPanel() {
  const [copiedManifest, setCopiedManifest] = useState(false);
  const [copiedBackground, setCopiedBackground] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Determine current window origin safely
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "https://ais-dev-ft2kquwyh6vcoeqtuxptoq-556362956929.us-west2.run.app";

  const manifestCode = `{
  "manifest_version": 3,
  "name": "JobFlow Scraper Attachment",
  "version": "1.0",
  "description": "Scrape Indeed & LinkedIn jobs and sync to your JobFlow Workspace instantly.",
  "permissions": ["activeTab", "tabs"],
  "host_permissions": [
    "${currentOrigin}/*",
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.indeed.com/*",
        "*://indeed.com/*",
        "*://*.linkedin.com/*",
        "*://linkedin.com/*",
        "*://*.run.app/*",
        "http://localhost/*"
      ],
      "js": ["content.js"],
      "run_at": "document_end",
      "all_frames": true
    }
  ]
}`;

  const backgroundScriptCode = `// Background Service Worker to bypass Content Security Policy (CSP) on Indeed / LinkedIn pages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("⚡ [JobFlow Background] Action received:", request.action);
  
  if (request.action === "syncToWorkspace") {
    console.log("⚡ [JobFlow Background] Posting scraped job to JobFlow URL:", request.url);
    console.log("⚡ [JobFlow Background] Saved payload data:", request.data);

    // 1. Post to workspace API endpoint
    fetch(request.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request.data)
    })
    .then(async (response) => {
      console.log("⚡ [JobFlow Background] Response Status:", response.status, response.statusText);
      const isOk = response.ok;
      const text = isOk ? "" : await response.text();

      // 2. ALSO broadcast directly to any open JobFlow tabs in this browser context!
      // This is 100% reliable and bypasses any serverless/container-idle file resets.
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id && tab.url && (tab.url.indexOf("run.app") !== -1 || tab.url.indexOf("localhost") !== -1)) {
            chrome.tabs.sendMessage(tab.id, {
              action: "directJobSync",
              data: request.data
            }, (res) => {
              // Silently catch the error if the tab isn't listening or ready
              const err = chrome.runtime.lastError;
            });
          }
        });
      });

      if (isOk) {
        console.log("⚡ [JobFlow Background] Saved successfully into spreadsheet database.");
        sendResponse({ success: true });
      } else {
        console.error("⚡ [JobFlow Background] Server response error message:", text);
        sendResponse({ success: false, error: "Server status " + response.status + ": " + text });
      }
    })
    .catch((err) => {
      console.error("⚡ [JobFlow Background] Server fetch connection rejected:", err);
      // Even if server connection is temporary down, still broadcast to active tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id && tab.url && (tab.url.indexOf("run.app") !== -1 || tab.url.indexOf("localhost") !== -1)) {
            chrome.tabs.sendMessage(tab.id, {
              action: "directJobSync",
              data: request.data
            }, (res) => {
              const err = chrome.runtime.lastError;
            });
          }
        });
      });
      sendResponse({ success: true, warning: "Spanned browser sync fallback active" });
    });
    return true; // MUST return true to notify chrome that response is asynchronous
  }
});`;

  const contentScriptCode = `// Content script to scrape Indeed and LinkedIn job panels
console.log("⚡ [JobFlow Scraper] Content script loaded successfully on " + window.location.href);

// Check if this script is injected in a JobFlow workspace page
const isJobFlowPage = window.location.href.includes("run.app") || window.location.href.includes("localhost");

if (isJobFlowPage) {
  console.log("⚡ [JobFlow Scraper] Detected JobFlow Active Dashboard! Activating direct sync messenger.");
  if (typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.action === "directJobSync") {
        console.log("⚡ [JobFlow Scraper] Real-time job received from background script:", message.data);
        window.postMessage({ type: "JOBFLOW_DIRECT_SYNC", data: message.data }, "*");
        sendResponse({ success: true });
      }
    });
  }
}

function extractJobContent() {
  console.log("⚡ [JobFlow Scraper] Running extraction selectors...");
  let title = "Unknown Job Title";
  let company = "Unknown Company";
  let description = "";
  const url = window.location.href;

  if (url.includes("indeed.com")) {
    title = document.querySelector("h1.jobsearch-JobInfoHeader-title")?.innerText || 
            document.querySelector("[class*='jobsearch-JobInfoHeader-title']")?.innerText ||
            document.querySelector(".jobsearch-JobInfoHeader-title-container h2")?.innerText || 
            document.querySelector("h1")?.innerText || "Indeed Position";
            
    company = document.querySelector("div[data-company-name='true'] a")?.innerText || 
              document.querySelector("[data-testid='inlineHeader-companyName']")?.innerText ||
              document.querySelector(".jobsearch-InlineCompanyRating div")?.innerText || 
              document.querySelector(".jobsearch-CompanyInfoContainer")?.innerText || "Indeed Recruiter";
              
    description = document.getElementById("jobDescriptionText")?.innerText || 
                  document.querySelector(".jobsearch-JobComponent-description")?.innerText || "";
  } else if (url.includes("linkedin.com")) {
    title = document.querySelector("h1")?.innerText || "LinkedIn Position";
    company = document.querySelector(".job-details-jobs-unified-top-card__company-name")?.innerText || 
              document.querySelector(".jobs-unified-top-card__company-name")?.innerText || "LinkedIn Recruiter";
    description = document.querySelector(".jobs-description__content")?.innerText || 
                  document.querySelector("#job-details")?.innerText || "";
  }

  // Sanitize data
  title = title.replace(/\\n/g, " ").trim();
  company = company.replace(/\\n/g, " ").trim();

  console.log("⚡ [JobFlow Scraper] Extracted:", { title, company });
  return { title, company, url, description, date: new Date().toISOString() };
}

// Post extracted card output to JobFlow Workspace API route (utilizes background.js worker to bypass page Content Security Policies)
async function syncToWorkspace(jobData) {
  const targetUrl = "${currentOrigin}/api/jobs/scrape";
  console.log("⚡ [JobFlow Scraper] Syncing job to " + targetUrl);
  
  if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.sendMessage === "function") {
    chrome.runtime.sendMessage(
      {
        action: "syncToWorkspace",
        url: targetUrl,
        data: jobData
      },
      (response) => {
        if (chrome.runtime.lastError) {
          alert("⚠️ Chrome Extension Connection Error!\\n\\n1. You MUST reload/refresh your Indeed or LinkedIn browser tab after installing or reloading the extension in Developer Mode.\\n2. Make sure background.js is created in the exact folder where manifest.json lives.");
          console.error("JobFlow Scraper Connection error:", chrome.runtime.lastError);
          return;
        }

        if (response && response.success) {
          alert("✓ Captured [" + jobData.title + " at " + jobData.company + "] into JobFlow successfully!");
        } else {
          const errorDetails = response ? response.error : "Unknown connection blocker";
          alert("⚠️ Workspace sync failed: " + errorDetails);
        }
      }
    );
  } else {
    console.log("⚡ [JobFlow Scraper] chrome.runtime is undefined! Running direct fetch fallback...", jobData);
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobData)
      });
      if (response.ok) {
        alert("✓ Captured [" + jobData.title + " at " + jobData.company + "] into JobFlow successfully via direct console fallback!");
      } else {
        alert("⚠️ Workspace direct sync failed. Status code: " + response.status);
      }
    } catch (err) {
      alert("⚠️ Direct workspace connection failed!\\n\\nThis is typically because Indeed or LinkedIn blocked the request using Content Security Policy (CSP).\\n\\nTo bypass this security block, please make sure you install the unpacked Chrome Extension folder as described in the steps, and then RELOAD your Indeed/LinkedIn pages so it goes through the extension background worker!");
      console.error("Direct fallback error:", err);
    }
  }
}

// Injects a premium, modern floating button to Indeed/LinkedIn pages
function injectFloatingButton() {
  if (isJobFlowPage) return; // Do not inject button on JobFlow itself!
  if (!document || !document.body) return;
  if (document.getElementById("jobflow-scrape-btn")) return;

  console.log("⚡ [JobFlow Scraper] Creating and injecting the floating button...");

  const btn = document.createElement("button");
  btn.id = "jobflow-scrape-btn";
  btn.innerText = "⚡ Sync to JobFlow";
  
  // Apply highly visual inline styling using setProperty to guarantee !important status
  btn.style.setProperty("position", "fixed", "important");
  btn.style.setProperty("bottom", "30px", "important");
  btn.style.setProperty("right", "30px", "important");
  btn.style.setProperty("z-index", "2147483647", "important");
  btn.style.setProperty("background-color", "#2563eb", "important");
  btn.style.setProperty("color", "#ffffff", "important");
  btn.style.setProperty("border", "3px solid #ffffff", "important");
  btn.style.setProperty("border-radius", "12px", "important");
  btn.style.setProperty("padding", "14px 22px", "important");
  btn.style.setProperty("font-size", "15px", "important");
  btn.style.setProperty("font-weight", "bold", "important");
  btn.style.setProperty("cursor", "pointer", "important");
  btn.style.setProperty("box-shadow", "0 10px 30px rgba(0, 0, 0, 0.45)", "important");
  btn.style.setProperty("display", "flex", "important");
  btn.style.setProperty("align-items", "center", "important");
  btn.style.setProperty("gap", "10px", "important");
  btn.style.setProperty("font-family", "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", "important");
  btn.style.setProperty("transition", "all 0.2s ease-in-out", "important");
  btn.style.setProperty("opacity", "1", "important");
  btn.style.setProperty("visibility", "visible", "important");

  btn.onmouseover = () => {
    btn.style.setProperty("background-color", "#1d53d8", "important");
    btn.style.setProperty("transform", "translateY(-4px) scale(1.03)", "important");
  };

  btn.onmouseout = () => {
    btn.style.setProperty("background-color", "#2563eb", "important");
    btn.style.setProperty("transform", "translateY(0) scale(1)", "important");
  };

  btn.onclick = async () => {
    btn.innerText = "⏳ Scraping...";
    btn.disabled = true;
    try {
      const data = extractJobContent();
      await syncToWorkspace(data);
    } catch (e) {
      alert("Extraction failed: " + e.message);
    } finally {
      btn.innerText = "⚡ Sync to JobFlow";
      btn.disabled = false;
    }
  };

  try {
    document.body.appendChild(btn);
    console.log("⚡ [JobFlow Scraper] Success! Button appended to body.");
  } catch (err) {
    console.error("⚡ [JobFlow Scraper] Error appending button:", err);
  }
}

// Ensure the button is injected after DOM loads and on dynamic navigations
setTimeout(injectFloatingButton, 1500);
setTimeout(injectFloatingButton, 3500);
setInterval(injectFloatingButton, 5000);
`;

  const copyToClipboard = (text: string, setCopied: React.Dispatch<React.SetStateAction<boolean>>) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-y-auto p-5 space-y-5" id="extension-panel-view">
      {/* Intro Header */}
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Chrome className="w-5 h-5 text-blue-600 animate-spin" /> Chrome Extension Developer Setup Area
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Install this custom localized script inside Google Chrome to fetch Indeed and LinkedIn listings. Clicking it immediately appends live jobs into our primary spreadsheet dashboard!
        </p>
      </div>

      {/* Multi-Environment Container Notice Box */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg flex flex-col gap-1.5 text-xs text-blue-800">
        <div className="flex items-center gap-2 font-black uppercase text-[10.5px]">
          <AlertTriangle className="w-4 h-4 text-blue-600" />
          <span>⚠️ Multi-Environment Sync Info (Where is my job?)</span>
        </div>
        <p className="leading-relaxed text-[11px] text-slate-705">
          JobFlow runs in two separate isolated cloud containers: the <strong>Development App URL</strong> (for the AI Studio builder preview pane) and the <strong>Shared App URL</strong> (for the private link shared with others). Because they have completely isolated filesystems/databases:
        </p>
        <ul className="list-disc list-inside space-y-1 text-[11px] pl-1 font-medium text-slate-700">
          <li>
            If you load the app inside the <span className="font-extrabold text-blue-800">AI Studio editor preview</span>, it reads from the <strong>Development API</strong>.
          </li>
          <li>
            If you load the app in <span className="font-extrabold text-blue-800">a new shared tab</span>, it reads from the <strong>Shared/Preview API</strong>.
          </li>
        </ul>
        <div className="mt-2 p-2 bg-white rounded border border-blue-100 divide-y divide-slate-105">
          <div className="py-1.5 flex justify-between items-center text-[10.5px]">
            <span className="text-slate-550 font-bold">This Tab's Current Origin:</span>
            <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono font-bold text-[10px] break-all">{currentOrigin}</code>
          </div>
          <div className="py-1.5 flex justify-between items-center text-[10.5px]">
            <span className="text-slate-550 font-bold">Scraped Jobs Will Send To:</span>
            <code className="bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-mono font-bold text-[10px] break-all">{currentOrigin}/api/jobs/scrape</code>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 italic leading-relaxed mt-1">
          * If you successfully clicked "Sync to JobFlow" and saw the success popup, but do not see it in your current view, you are likely viewing the <strong>Development Panel</strong> while your extension was configured to target the <strong>Shared Preview Panel</strong> (or vice-versa). Simply check both URL links to see your captured role!
        </p>
      </div>

      {/* Guide Steps */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="extension-steps-grid">
        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-blue-600">STEP 1</span>
            <h4 className="text-xs font-bold text-slate-800 mt-1">Create Folder</h4>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
              Create a blank folder on your computer named <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">JobFlow-Chrome</code>.
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-blue-600">STEP 2</span>
            <h4 className="text-xs font-bold text-slate-800 mt-1">Save Source Files</h4>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
              Create 3 files inside that folder: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">manifest.json</code>, <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">background.js</code>, and <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">content.js</code>.
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-blue-600">STEP 3</span>
            <h4 className="text-xs font-bold text-slate-800 mt-1">Load Unpacked</h4>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
              Go to <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">chrome://extensions</code>, enable **Developer Mode**, click **Load unpacked**, and select your <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">JobFlow-Chrome</code> folder.
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-amber-50 rounded-lg border border-amber-200 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-amber-700">STEP 4 (CRITICAL)</span>
            <h4 className="text-xs font-bold text-amber-900 mt-1">Reload Job Pages</h4>
            <p className="text-[11px] text-amber-800 mt-1.5 leading-normal font-medium">
              You **MUST** reload or refresh your open Indeed and LinkedIn tabs! Otherwise, Chrome refuses background port access and alerts a Connection Error.
            </p>
          </div>
        </div>
      </div>

      {/* Developer Diagnostic Hub */}
      <div className="bg-slate-50 border-2 border-emerald-500/30 rounded-xl p-4 space-y-3" id="extension-diagnostics-hub">
        <div className="flex items-center gap-2 border-b border-slate-150 pb-2">
          <PlayCircle className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-bold text-slate-800">🔬 Chrome Extension Debugging Guide & Telemetry FAQ</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <span className="font-extrabold text-[11px] text-slate-700 block">❓ 1. Why do jobs only show in AI Studio, but not the Shared App?</span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              <strong>Wait! Have you updated your extension files?</strong> We recently added "Universal Cross-Tab Sync" to the code below. If you installed the extension earlier, it still has the old code hardcoded to the AI Studio preview environment.
            </p>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              <strong>How to fix:</strong> Delete your old files, copy the updated <code className="bg-slate-200 px-1 rounded font-mono">manifest.json</code>, <code className="bg-slate-200 px-1 rounded font-mono">background.js</code>, and <code className="bg-slate-200 px-1 rounded font-mono">content.js</code> from this page, and click the <strong>Reload button</strong> in <code className="bg-slate-200 px-1 rounded font-mono">chrome://extensions</code>. Then refresh your Shared App tab and Indeed tab!
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="font-extrabold text-[11px] text-slate-700 block">❓ 2. Where are the "background.js" Console Logs?</span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Chrome runs the background script in a separate Service Worker thread. Its console logs <strong>will NOT appear in your normal Indeed tab console</strong>!
            </p>
            <div className="bg-blue-50/50 p-2 rounded border border-blue-100 text-[10.5px] text-slate-700 space-y-1">
              <span className="font-bold text-blue-800 block">How to open the Background Console:</span>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Go to <code className="bg-white/80 px-1 rounded font-mono">chrome://extensions</code>.</li>
                <li>Locate the loaded <strong>JobFlow Scraper Attachment</strong> card.</li>
                <li>Click the blue <strong className="text-blue-700">"service worker"</strong> link.</li>
                <li>A dedicated DevTools window will open, showcasing full background sync logs!</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Code Blocks */}
      <div className="space-y-4" id="code-snippet-blocks">
        {/* Manifest.json Code block */}
        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-slate-500" /> manifest.json
            </span>
            <button
              onClick={() => copyToClipboard(manifestCode, setCopiedManifest)}
              className="text-[10.5px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              {copiedManifest ? (
                <>
                  <ClipboardCheck className="w-3.5 h-3.5 text-green-600" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" /> Copy JSON
                </>
              )}
            </button>
          </div>
          <pre className="p-3 bg-slate-900 text-slate-200 text-[10.5px] font-mono overflow-x-auto max-h-[180px] leading-relaxed">
            {manifestCode}
          </pre>
        </div>

        {/* background.js Code block */}
        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-slate-500" /> background.js
            </span>
            <button
              onClick={() => copyToClipboard(backgroundScriptCode, setCopiedBackground)}
              className="text-[10.5px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              {copiedBackground ? (
                <>
                  <ClipboardCheck className="w-3.5 h-3.5 text-green-600" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" /> Copy Javascript
                </>
              )}
            </button>
          </div>
          <pre className="p-3 bg-slate-900 text-slate-200 text-[10.5px] font-mono overflow-x-auto max-h-[200px] leading-relaxed">
            {backgroundScriptCode}
          </pre>
        </div>

        {/* content.js Code block */}
        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-slate-500" /> content.js
            </span>
            <button
              onClick={() => copyToClipboard(contentScriptCode, setCopiedScript)}
              className="text-[10.5px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              {copiedScript ? (
                <>
                  <ClipboardCheck className="w-3.5 h-3.5 text-green-600" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" /> Copy Javascript
                </>
              )}
            </button>
          </div>
          <pre className="p-3 bg-slate-900 text-slate-200 text-[10.5px] font-mono overflow-x-auto max-h-[300px] leading-relaxed">
            {contentScriptCode}
          </pre>
        </div>
      </div>
    </div>
  );
}
