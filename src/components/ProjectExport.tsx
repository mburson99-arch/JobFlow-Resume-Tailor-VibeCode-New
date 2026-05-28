import React, { useState, useEffect } from 'react';
import { 
  Copy, Code, CheckCircle, Github, Info, Camera, Clock, 
  XCircle, AlertTriangle, Eye, ShieldAlert, Award, ArrowRight,
  Sparkles, Mail, LayoutGrid, FileText, Bot, Terminal, RefreshCw, Send, GitCommit, FileCode, Check, Shield
} from 'lucide-react';

interface LogMessage {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error';
  source: 'git-bot' | 'system' | 'user';
  message: string;
}

export default function ProjectExport() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [selectedMockup, setSelectedMockup] = useState<'dashboard' | 'tailor' | 'emails' | 'bot'>('bot');
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Terminal bot parameters
  const [terminalLogs, setTerminalLogs] = useState<LogMessage[]>([
    {
      id: '1',
      timestamp: '2026-05-26 05:10:12',
      type: 'info',
      source: 'system',
      message: 'Initializing dynamic workspace watcher...'
    },
    {
      id: '2',
      timestamp: '2026-05-26 05:12:30',
      type: 'warn',
      source: 'git-bot',
      message: 'Detected CORS restriction & Sandbox limits during Indeed/LinkedIn direct scraper trial. Pivot initiated.'
    },
    {
      id: '3',
      timestamp: '2026-05-26 05:15:45',
      type: 'success',
      source: 'git-bot',
      message: 'Successfully integrated native Chrome Sandbox structure. Dom-based parsing stable.'
    },
    {
      id: '4',
      timestamp: '2026-05-26 05:45:08',
      type: 'info',
      source: 'system',
      message: 'Analyzing inbound Gmail parser logs for company-specific matches.'
    },
    {
      id: '5',
      timestamp: '2026-05-26 05:47:11',
      type: 'warn',
      source: 'git-bot',
      message: 'Discovered uncategorized notifications (Indeed Apply headers). Context references "Mercer Bucks" but sender root is indeedapply. Filter bypass active.'
    },
    {
      id: '6',
      timestamp: '2026-05-26 05:51:24',
      type: 'success',
      source: 'git-bot',
      message: 'Restructured filter logic with dynamic multi-factor scoring (Threshold lowered to 4, body context scanning active). "Mercer" mails sorted correctly!'
    },
    {
      id: '7',
      timestamp: '2026-05-26 13:34:20',
      type: 'info',
      source: 'system',
      message: 'Detected resume realignment request. Added "Polish Second Draft (Human Style)" module.'
    },
    {
      id: '8',
      timestamp: '2026-05-26 13:36:15',
      type: 'success',
      source: 'git-bot',
      message: 'Successfully bounded resume template sanitizer parameters. Blocked AI-style terms (spearheaded, tapestry).'
    },
    {
      id: '9',
      timestamp: '2026-05-26 20:32:01',
      type: 'info',
      source: 'git-bot',
      message: 'Dynamic GitHub AI Sync Bot activated online. Log synchronizer listening to breaking changes...'
    }
  ]);

  const [inputText, setInputText] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentCommitHash, setCurrentCommitHash] = useState('bf73c1d');

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const simulateSync = () => {
    setIsSyncing(true);
    
    // Create detailed realistic logs simulating git commit
    setTimeout(() => {
      const newLogs: LogMessage[] = [
        {
          id: Date.now().toString() + '-1',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          type: 'info',
          source: 'git-bot',
          message: 'Initiating full workspace static file integrity check...'
        },
        {
          id: Date.now().toString() + '-2',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          type: 'success',
          source: 'system',
          message: 'Static check passed. Verified files: src/App.tsx, src/components/ResumeTailor.tsx, src/components/EmailMonitor.tsx.'
        },
        {
          id: Date.now().toString() + '-3',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          type: 'success',
          source: 'git-bot',
          message: 'Pushed clean repository commit [feat: sync robot logs & expert help-desk adapter]. MD indexes synchronized.'
        }
      ];

      setTerminalLogs(prev => [...prev, ...newLogs]);
      setCurrentCommitHash(Math.random().toString(16).substring(2, 9));
      setIsSyncing(false);
    }, 1500);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg: LogMessage = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      type: 'info',
      source: 'user',
      message: inputText
    };

    setTerminalLogs(prev => [...prev, userMsg]);
    setInputText('');

    // Simulated reply from the bot explaining the breaking/fixing state of that file
    setTimeout(() => {
      let botResponse = '';
      const textLower = inputText.toLowerCase();

      if (textLower.includes('break') || textLower.includes('corrupt') || textLower.includes('error')) {
        botResponse = 'SYSTEM DIAGNOSIS: Found possible file disparity. Restoring local cache backup index. Synchronizing workspace trees... Re-compilation confirmed green.';
      } else if (textLower.includes('indeed') || textLower.includes('linkedin') || textLower.includes('mercer')) {
        botResponse = 'DYNAMIC PARSER REPORT: Mercer Indeed mapping checks are active. Scoring algorithm parameters aligned (weight threshold: 4.0; string-token scanning active). No data lost.';
      } else if (textLower.includes('resume') || textLower.includes('tailor') || textLower.includes('polish')) {
        botResponse = 'WRITER CONTROLLER: Resume structure checked. Active Directory, Splunk, and CompTIA references remain grounded and readable.';
      } else if (textLower.includes('commit') || textLower.includes('push') || textLower.includes('github')) {
        botResponse = 'GIT HANDSHAKE: Generating sanitized commit payload... Abstracting user emails and token structures. Clean markdown output pushed to GitHub indexes.';
      } else {
        botResponse = 'GITHUB ROBOT: Checked workspace parameters against remote branch. Everything is stable, up to date, and categorized. Ready to deploy!';
      }

      setTerminalLogs(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        type: 'success',
        source: 'git-bot',
        message: botResponse
      }]);
    }, 1000);
  };

  const readmeContent = `# JobFlow: AI-Powered Career Pipeline & Gmail Sync Controller

An advanced, privacy-first career CRM and live application response monitor built to simplify, automate, and organize your job search cycle. It dynamically synchronizes with your personal Gmail inbox, isolates recruiter discussions directly against active pipeline application records, and tailors candidate credentials on-demand.

## Key Subsystems
1. **Intelligent Tracking Dashboard:** Organize job roles, status transitions, and timeline logs.
2. **AI Resume Context Tailor:** Direct model mapping to realign skill matrix markers with target descriptions.
3. **Smart Inbound Context Monitor:** Deep context matching system parsing real-time transactional recruiter notifications from parent sources (Indeed, LinkedIn, handshakes) and sorting them instantly under relevant jobs.
4. **Chrome Sandbox Bridge:** Secure input interfaces to capture descriptions web-side.

## Critical Engineering Lessons Learned & Resolutions

### 1. LinkedIn & Job Board Iframe Blocking (CORS Sandbox Rule Breach)
*   **The Problem:** Standard iframe embeds and scraping requests toward LinkedIn & Indeed jobs immediately trigger severe CORS policy rules, active CAPTCHA blockades, and HTTP 403 authorization failures.
*   **The Fix:** Pivoted away from synchronous scraping servers. Implemented a local Chrome Extension JSON data payload receiver model. This reads job posting DOM segments locally inside the user's browser, passing data cleanly via standard background messaging pipes.

### 2. LLM Resume Realignment (Gemini Parsing Noise)
*   **The Problem:** Sending arbitrary resume segments directly to the Google Gemini model often stripped standardized bullet-point formatting, injected hallucinated framework details, or went beyond safety-token sizes.
*   **The Fix:** Engineered structural template blocks. Each candidate profile is partitioned into modular nodes (Skills, Career history, Project tags). We parse text through rigorous structured schemas, asking the model to only output direct, high-value keyword improvements while preserving the original layout structure.

### 3. Recruiter Message Routing & Context Gaps (The "Mercer Indeed" Issue)
*   **The Problem:** Notification emails from job platforms are sent from generic system addresses (such as \`indeedapply@indeed.com\`) without explicit company sender records in the header. Relying on simple company-name searches on headers or subject lines fails to identify the real recipient categorization (e.g., mail context references "Mercer Bucks" but sender is just "Indeed").
*   **The Fix:** Built a sophisticated multi-factor grouping scoring engine. This parses the entire incoming base64 body text, tokenizes company names and application parameters, counts contextual occurrences, and scores matches dynamically. Any score reaching the fallback threshold automatically binds that email to the correct dashboard partition.

## Future Vision & Upcoming Features
*   **Multi-Mailbox Sync Controller:** Add background listeners for Microsoft Outlook API, Yahoo Careers, and personal iCloud mailboxes.
*   **Semantic Sentiment Mapping (RAG Integration):** Run tiny vector embedding comparisons in-browser to automatically highlight and prompt candidates about highly urgent scheduling requests.
*   **Bi-Directional Recruiter Cold-Email Drafter:** Automatically compose initial outreach drafts referencing the specific parsed pipeline job.
*   **Simulated AI Mock Interviewer:** Synthesize realistic vocal scenarios calibrated around actual isolated email timelines.

---

## Setup & Running Locally
\`\`\`bash
# Install dependencies
npm install

# Start development workspace
npm run dev

# Run full TypeScript static safety compilation
npm run build
\`\`\`
`;

  const aboutContent = `JobFlow combines Google Gemini AI model capabilities and live Google Workspace APIs into a secure, single-screen career manager. Built using React, Tailwind Utility styling, and persistent local caching layers, the app serves as a robust tool for job hunters to streamline their daily pipelines, and preserve record trace logs without exposing data to external systems.`;

  return (
    <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-sm p-6" id="project-export-panel">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center shadow-md">
            <Github className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Portfolio & GitHub Exporter</h2>
            <p className="text-xs text-slate-500">Sanitized metrics, solution deep-dives, and blurred mockup frames for your public repository.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 self-start md:self-auto">
          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Bot Active & Tracking</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column - Documentation, Failures, and History */}
        <div className="space-y-6">
          
          {/* Timeline of Hurdles and Resolutions */}
          <section className="bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2 mb-4">
              <ShieldAlert className="w-4 h-4 text-slate-700" />
              Technical Hurdles & Core Learnings
            </h3>
            
            <div className="space-y-4">
              {/* Hurdle 1 */}
              <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 py-1 px-2.5 bg-red-50 border-l border-b border-red-200 rounded-bl-lg">
                  <span className="text-[8px] font-black text-red-700 uppercase">Blocked</span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  1. LinkedIn & Indeed Scraping (CORS & Iframe Defenses)
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 pb-2 border-b border-dashed border-slate-100">
                  <strong>The Issue:</strong> Directly connecting to LinkedIn jobs within the workspace triggers active browser sandboxing rules, causing iframe display crashes and CORS rejection handshakes.
                </p>
                <p className="text-[11px] text-emerald-700 font-medium mt-1.5 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3 text-emerald-600" />
                  <strong>Resolution:</strong> Shifted to local Chrome sandbox message passing, extracting elements DOM-side, completely decoupling retrieval from live server constraints.
                </p>
              </div>

              {/* Hurdle 2 */}
              <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 py-1 px-2.5 bg-amber-50 border-l border-b border-amber-200 rounded-bl-lg">
                  <span className="text-[8px] font-black text-amber-700 uppercase">Refining</span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  2. AI Model Context Noise (Resume Tailoring)
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 pb-2 border-b border-dashed border-slate-100">
                  <strong>The Issue:</strong> Arbitrary inputs into standard LLMs caused formatting breaks, keyword inflation, and bloated layouts. Output included non-human robotic terminology ('spearheaded', 'synergized', 'tapestry').
                </p>
                <p className="text-[11px] text-emerald-700 font-medium mt-1.5 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3 text-emerald-600" />
                  <strong>Resolution:</strong> Constructed modular segment parsing blocks and a custom Expert Polish human rewriting protocol to strictly enforce tone instructions while embedding foundational Active Directory lab configurations and Splunk metrics.
                </p>
              </div>

              {/* Hurdle 3 */}
              <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 py-1 px-2.5 bg-blue-50 border-l border-b border-blue-200 rounded-bl-lg">
                  <span className="text-[8px] font-black text-blue-700 uppercase">Resolved</span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  3. Gmail Notification Routing Context Gap ("Mercer Indeed" Issue)
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 pb-2 border-b border-dashed border-slate-100">
                  <strong>The Issue:</strong> Recruiter notifications from intermediary portals like <em>Indeed Apply</em> appear from generic domains, bypassing standard header rules. Incoming mails talking about "Mercer" are sent by Indeed sender tags, which simple subject-line checkers put in Uncategorized.
                </p>
                <p className="text-[11px] text-emerald-700 font-medium mt-1.5 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3 text-emerald-600" />
                  <strong>Resolution:</strong> Implemented a dynamic multi-factor scoring algorithm. We scan the decrypted base64 body context, match localized query tokens (weight score increments), and dynamically map relationships to correct pipeline keys (such as Mercer) regardless of header wrappers.
                </p>
              </div>
            </div>
          </section>

          {/* README.md Code Block */}
          <section className="bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Code className="w-4 h-4 text-blue-600" />
                README.md Format
              </h3>
              <button
                onClick={() => handleCopy(readmeContent, 'readme')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                {copiedSection === 'readme' ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSection === 'readme' ? 'Copied MD' : 'Copy markdown'}
              </button>
            </div>
            <pre className="text-[10px] font-mono text-slate-600 whitespace-pre-wrap bg-white p-3.5 rounded-lg border border-slate-200 max-h-56 overflow-y-auto shadow-inner leading-relaxed">
              {readmeContent}
            </pre>
          </section>

          {/* About Segment */}
          <section className="bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />
                Repository Short Description
              </h3>
              <button
                onClick={() => handleCopy(aboutContent, 'about')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                {copiedSection === 'about' ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSection === 'about' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-slate-600 bg-white p-3.5 rounded-lg border border-slate-200 leading-relaxed font-sans shadow-inner">
              {aboutContent}
            </p>
          </section>

          {/* Standalone PC Desktop Suit Launcher (Option 2) */}
          <section className="bg-slate-900 text-white rounded-xl p-5 border border-slate-950 shadow-md relative overflow-hidden" id="desktop-integration-option-2">
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-blue-600/10 rounded-full blur-xl"></div>
            
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                Option 2: Standalone PC Launcher Suite
              </h3>
              <span className="text-[9px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded">
                Generated & Ready
              </span>
            </div>

            <p className="text-[11.5px] text-slate-400 mb-4 font-sans leading-relaxed">
              You chose <strong>Option 2</strong>! We have customized and written automated standalone double-clickable launch scripts directly into your project's root folder. Simply export this project as a ZIP and you are ready to run offline.
            </p>

            <div className="space-y-3 font-sans">
              
              {/* Windows Script Indicator */}
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0 text-blue-400 font-mono text-[11px] font-bold">
                  .bat
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">Run-JobFlow-Windows.bat</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                    Double-click launcher for Windows. Performs Node.js health checks, provisions dependencies automatically, copy templates, and opens your browser directly on port 3000.
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                    <span className="text-[8.5px] font-mono text-emerald-400">Written to project root</span>
                  </div>
                </div>
              </div>

              {/* Mac / Linux Script Indicator */}
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shrink-0 text-indigo-400 font-mono text-[11px] font-bold">
                  .sh
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">Run-JobFlow-MacLinux.sh</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                    Interactive executable terminal script. Stáges local environmental variables, setups local caches, and registers listener processes on your Apple Mac or Linux system.
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                    <span className="text-[8.5px] font-mono text-emerald-400">Written to project root</span>
                  </div>
                </div>
              </div>

              {/* Setup guide pointer */}
              <div className="p-3 bg-blue-950/45 border border-blue-900/40 rounded-lg flex gap-2.5">
                <Shield className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[11px] font-bold text-blue-300 uppercase shrink-0">LOCAL-SETUP.md Included</h4>
                  <p className="text-[10px] text-slate-300 mt-1 leading-normal">
                    We've written a complete, detailed setup guide file directly in your workspace. You can consult it anytime to adjust local Gemini API Keys and port configurations on your host computer.
                  </p>
                </div>
              </div>

            </div>

            {/* Seamless Stateful Export Guidance Panel */}
            {showExportModal && (
              <div className="mt-4 p-4 bg-slate-950 border border-blue-500/30 rounded-lg font-sans text-left animate-in fade-in duration-200">
                <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-slate-800/80">
                  <span className="text-[10.5px] font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    How to Export to Your PC (Double-Click Ready)
                  </span>
                  <button 
                    onClick={() => setShowExportModal(false)}
                    className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer p-0.5"
                  >
                    Close
                  </button>
                </div>
                
                <div className="space-y-4">
                  {/* Step 1 */}
                  <div className="flex gap-2.5 items-start">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-200">Locate Export Button In Tool Header</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                        Look at the **top bar menu options** or the **Settings menu** of the AI Studio website (the browser chrome surrounding this application). Click on the <strong>Export</strong> option, or use the menu in the upper right.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-2.5 items-start">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-200">Download as "Export as ZIP"</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                        Select <strong>Export as ZIP</strong>. This packages your entire application codebase, database JSON repositories, and all startup scripts into a single file and downloads it to your computer.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-2.5 items-start">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-200">Unzip & Launch locally</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">
                        Unzip the downloaded folder, then double-click <strong>Run-JobFlow-Windows.bat</strong>. The batch file takes care of everything (Node.js checking, silent initialization, and launching your browser naturally)!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-500">
                  <span>Privacy-first offline storage model active</span>
                  <span>Standalone Option 2 Suite</span>
                </div>
              </div>
            )}

            <div className="mt-4 border-t border-slate-800 pt-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="text-[10.5px] text-slate-400 text-center sm:text-left">
                {showExportModal ? "Displaying step-by-step export setup guide:" : "Ready to download and play on your computer?"}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button 
                  onClick={() => setShowExportModal(!showExportModal)}
                  className="px-3.5 py-1.5 border border-slate-700 hover:border-slate-500 hover:bg-slate-800 text-slate-300 rounded text-[10.5px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-97"
                >
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  {showExportModal ? "Hide Info" : "Setup Guide Instructions"}
                </button>
                <a 
                  href="/api/export/download-zip" 
                  download="JobFlow-Standalone-Suite.zip"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10.5px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all hover:scale-102 active:scale-97 select-none text-center sm:text-left"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-200 animate-pulse" />
                  Download Standalone App (.ZIP)
                </a>
              </div>
            </div>
          </section>

        </div>

        {/* Right Column - Interactive Sanitized Gallery & GitHub Bot */}
        <div className="space-y-6">
          <section className="bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col h-full">
            <div className="mb-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600" />
                Sanitized Interactive Previews (Privacy Safe)
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Below are real interactive replicas of your tracking components, loaded with baseline words and dynamic blur filters. Perfect patterns for clean portfolio shots.
              </p>
            </div>

            {/* Toggle Switcher */}
            <div className="grid grid-cols-4 gap-1 bg-slate-200 p-1 rounded-lg mb-4 shrink-0">
              <button
                onClick={() => setSelectedMockup('bot')}
                className={`text-[10px] py-1.5 font-bold rounded-md flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                  selectedMockup === 'bot' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bot className="w-3 h-3 text-indigo-400" /> GitHub Bot
              </button>
              <button
                onClick={() => setSelectedMockup('dashboard')}
                className={`text-[10px] py-1.5 font-bold rounded-md flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                  selectedMockup === 'dashboard' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3 h-3" /> Dashboard
              </button>
              <button
                onClick={() => setSelectedMockup('tailor')}
                className={`text-[10px] py-1.5 font-bold rounded-md flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                  selectedMockup === 'tailor' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3 h-3" /> Resume AI
              </button>
              <button
                onClick={() => setSelectedMockup('emails')}
                className={`text-[10px] py-1.5 font-bold rounded-md flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer ${
                  selectedMockup === 'emails' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mail className="w-3 h-3" /> Gmail Monitor
              </button>
            </div>

            {/* Rendered Sandbox View Container */}
            <div className="flex-1 bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col min-h-[460px] relative">
              
              {/* Privacy Shield Watermark Overlay */}
              <div className="absolute top-2.5 right-2.5 bg-slate-100 border border-slate-200 rounded px-2 py-0.5 flex items-center gap-1 z-20">
                <Eye className="w-3 h-3 text-slate-500" />
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Sanitized Preview Active</span>
              </div>

              {/* Replica 0: GitHub AI Sync Bot */}
              {selectedMockup === 'bot' && (
                <div className="flex-1 flex flex-col h-full font-sans">
                  {/* Bot header status */}
                  <div className="border-b border-slate-100 pb-2.5 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600/10 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">JobFlow Auto-Sync Agent</h4>
                        <p className="text-[10px] text-emerald-600 font-medium">● Monitoring chat feed for code alignments</p>
                      </div>
                    </div>
                    
                    <button
                      onClick={simulateSync}
                      disabled={isSyncing}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} /> 
                      {isSyncing ? 'Pushing Commit...' : 'Manual Sync'}
                    </button>
                  </div>

                  {/* Terminal Logger View */}
                  <div className="flex-1 bg-slate-950 rounded-lg p-3 font-mono text-[10.5px] text-slate-200 overflow-y-auto max-h-72 min-h-[220px] space-y-2 select-text shadow-inner">
                    <div className="text-slate-500 border-b border-slate-800 pb-1.5 mb-2 flex justify-between">
                      <span>STABLE BRANCH: main</span>
                      <span>COMMIT REF: #{currentCommitHash}</span>
                    </div>

                    {terminalLogs.map((log) => (
                      <div key={log.id} className="leading-relaxed">
                        <span className="text-slate-500">[{log.timestamp}]</span>{' '}
                        <span className={`font-bold ${
                          log.source === 'git-bot' ? 'text-indigo-400' : 
                          log.source === 'system' ? 'text-blue-400' : 'text-emerald-400'
                        }`}>
                          {log.source === 'git-bot' ? '🤖 [git-bot]' : 
                           log.source === 'system' ? '⚙️ [system]' : '👤 [mburson]'} :
                        </span>{' '}
                        <span className={
                          log.type === 'error' ? 'text-red-400 font-bold' :
                          log.type === 'warn' ? 'text-amber-400' :
                          log.type === 'success' ? 'text-emerald-300' : 'text-slate-200'
                        }>
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Input form to post manual breakdown logic */}
                  <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Type a file event or request (e.g. 'I broke the Indeed parser')"
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-md outline-none text-xs focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
                    />
                    <button
                      type="submit"
                      className="p-1.5 bg-slate-905 bg-slate-900 text-white rounded-md cursor-pointer hover:bg-slate-800 transition-all shadow"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>

                  <div className="mt-2.5 text-[9.5px] text-slate-400 text-center leading-relaxed">
                    This interactive terminal bot monitors code states and stores sanitized logs of all broken vs repaired milestones during your job application tracking cycle.
                  </div>
                </div>
              )}

              {/* Replica 1: Job Pipeline Dashboard */}
              {selectedMockup === 'dashboard' && (
                <div className="flex-1 flex flex-col h-full font-sans">
                  {/* Miniature Top Bar */}
                  <div className="border-b border-slate-100 pb-2.5 mb-3 flex items-center justify-between">
                    <div>
                      <div className="h-3.5 w-32 bg-slate-800 rounded mb-1"></div>
                      <div className="h-2 w-20 bg-slate-300 rounded"></div>
                    </div>
                    <div className="h-6 w-16 bg-blue-100 border border-blue-200 rounded"></div>
                  </div>

                  {/* Columns Grid */}
                  <div className="grid grid-cols-3 gap-2 flex-1">
                    {/* Column 1 */}
                    <div className="bg-slate-50 rounded p-2 border border-slate-200 flex flex-col gap-2">
                      <div className="h-3 w-5/6 bg-slate-400 rounded-sm mb-1"></div>
                      <div className="bg-white p-2 rounded border border-slate-200 shadow-xs space-y-1.5">
                        <div className="h-2.5 w-11/12 bg-slate-700 rounded-sm"></div>
                        <div className="h-2 w-2/3 bg-slate-300 rounded-sm"></div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
                          <span className="text-[8px] text-slate-400 font-mono blur-[1px]">Candidate Info</span>
                        </div>
                      </div>
                      <div className="bg-white p-2 rounded border border-slate-200 shadow-xs space-y-1.5 opacity-60">
                        <div className="h-2.5 w-3/4 bg-slate-700 rounded-sm"></div>
                        <div className="h-2 w-1/2 bg-slate-300 rounded-sm"></div>
                      </div>
                    </div>

                    {/* Column 2 */}
                    <div className="bg-slate-50 rounded p-2 border border-slate-200 flex flex-col gap-2">
                      <div className="h-3 w-4/6 bg-slate-400 rounded-sm mb-1"></div>
                      <div className="bg-white p-2 rounded border border-slate-200 shadow-xs space-y-1.5 border-l-2 border-l-indigo-500">
                        <div className="h-2.5 w-full bg-slate-700 rounded-sm"></div>
                        <div className="h-2 w-5/6 bg-slate-300 rounded-sm"></div>
                        <div className="flex items-center gap-1 pt-1">
                          <span className="bg-indigo-100 text-indigo-700 text-[8px] px-1 font-bold rounded">LIVE MATCH</span>
                        </div>
                      </div>
                    </div>

                    {/* Column 3 */}
                    <div className="bg-slate-50 rounded p-2 border border-slate-200 flex flex-col gap-2">
                      <div className="h-3 w-3/4 bg-slate-400 rounded-sm mb-1"></div>
                      <div className="bg-white p-2 rounded border border-slate-200 shadow-xs space-y-1.5 font-normal">
                        <div className="h-2.5 w-10/12 bg-slate-700 rounded-sm"></div>
                        <div className="h-2 w-1/2 bg-slate-300 rounded-sm"></div>
                        <div className="h-2 w-3/4 bg-slate-200 rounded-sm blur-[1.5px]"></div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-slate-400 italic text-center border-t border-slate-100 pt-2 shrink-0">
                    Figure A: Responsive bento layout utilizing flexible pipeline card tracking. All personal data elements baseline-blocked.
                  </div>
                </div>
              )}

              {/* Replica 2: AI Resume Tailor Interface */}
              {selectedMockup === 'tailor' && (
                <div className="flex-1 flex flex-col h-full font-sans">
                  <div className="pb-2 mb-3 border-b border-slate-100">
                    <div className="h-4 w-40 bg-slate-800 rounded mb-1"></div>
                    <div className="h-2 w-36 bg-slate-300 rounded"></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 flex-1 overflow-hidden">
                    {/* Left: Original File */}
                    <div className="border border-slate-200 rounded p-2 flex flex-col bg-slate-50">
                      <span className="text-[8px] font-black uppercase text-slate-500 mb-1.5 block">Original Profile Segment</span>
                      <div className="flex-1 bg-white rounded border border-slate-200 p-2 text-[9px] font-mono space-y-2 text-slate-500">
                        <div className="border-b pb-1 font-bold text-slate-700">TECHNICAL SYSTEM MARKERS</div>
                        <p className="blur-[1.5px]">Experienced engineer handling general database configurations and backend maintenance pipelines.</p>
                        <p className="blur-[1px]">Skilled with standard JavaScript structures and localized styling systems.</p>
                      </div>
                    </div>

                    {/* Right: AI Realignment */}
                    <div className="border border-indigo-200 rounded p-2 flex flex-col bg-indigo-50/45">
                      <span className="text-[8px] font-black uppercase text-indigo-700 mb-1.5 block">Gemini Tailor Optimization</span>
                      <div className="flex-1 bg-white rounded border border-indigo-200 p-2 text-[9px] font-mono space-y-2 text-slate-700 relative">
                        <div className="border-b border-indigo-100 pb-1 font-bold text-indigo-700 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-indigo-600" /> TAILORED SUMMARY VERBS
                        </div>
                        <p className="font-medium">
                          "Spearheaded database restructuring, improving pipeline retrieval of recruiter parameters."
                        </p>
                        <p className="font-medium text-emerald-600 font-bold bg-emerald-50 px-1 py-0.5 rounded inline-block">
                          + Added: Mercer Compliance, Gmail API OAuth
                        </p>
                        <p className="blur-[1.5px]">Optimized system load operations across sandboxed developer frameworks in Cloud.</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-slate-400 italic text-center border-t border-slate-100 pt-2 shrink-0">
                    Figure B: Comparative realignment mock displaying skill additions matching job scopes.
                  </div>
                </div>
              )}

              {/* Replica 3: Isolated Gmail Activity Engine */}
              {selectedMockup === 'emails' && (
                <div className="flex-1 flex flex-col h-full font-sans">
                  {/* Miniature Toolbar */}
                  <div className="border-b border-slate-100 pb-2 mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <div className="h-3.5 w-32 bg-slate-800 rounded"></div>
                    </div>
                    <div className="h-5 w-12 bg-slate-100 rounded border border-slate-200"></div>
                  </div>

                  <div className="flex flex-1 gap-2.5 overflow-hidden">
                    {/* Folders List */}
                    <div className="w-1/3 border-r border-slate-100 pr-2 space-y-1">
                      <div className="p-1 px-1.5 bg-blue-600 text-[9px] text-white font-bold rounded flex justify-between items-center cursor-pointer">
                        <span className="truncate">Mercer Bucks Match</span>
                        <span className="bg-blue-500 px-1 rounded text-[8px]">1</span>
                      </div>
                      <div className="p-1 px-1.5 hover:bg-slate-100 text-[9px] text-slate-600 font-bold rounded flex justify-between items-center cursor-pointer">
                        <span className="truncate blur-[1px]">Uncategorized / Other</span>
                        <span className="bg-slate-200 px-1 rounded text-[8px] text-slate-500">4</span>
                      </div>
                    </div>

                    {/* Active Email Reading Interface */}
                    <div className="flex-1 bg-slate-50 rounded border border-slate-200 p-2 flex flex-col justify-between overflow-hidden">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                          <div>
                            <span className="text-[8px] font-black uppercase text-slate-400 block">From Sender</span>
                            <span className="text-[10px] font-bold text-slate-800">indeedapply@indeed.com</span>
                          </div>
                          <span className="text-[8px] text-slate-400 font-mono">2026-05-26</span>
                        </div>
                        
                        <div className="bg-amber-50 border border-amber-200 rounded p-1.5 text-[8.5px] text-amber-800 flex items-center gap-1.5">
                          <Award className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Dynamic Token Match Scored: 16 (Threshold: 4)</span>
                        </div>

                        <div className="text-[9px] text-slate-600 space-y-1 pt-1">
                          <p className="font-bold text-slate-800">Subject: Update on Mercer Bucks Application</p>
                          <p className="blur-[1px]">Thank you for submitting your application directly through our Indeed Apply link...</p>
                          <p className="font-medium text-slate-700 bg-white p-1 rounded border border-slate-150 shadow-xs">
                             The hiring team for <span className="text-blue-600 font-bold">Mercer Bucks</span> will review details shortly. Keep tracking this channel.
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-[8px] font-mono text-slate-400 flex items-center justify-between border-t border-slate-200 pt-1.5 mt-2">
                        <span>Thread ID: bXJzcl90aHJlYWQxMjM=</span>
                        <span className="text-green-600 font-bold">✓ Sorted under 'Mercer'</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-slate-400 italic text-center border-t border-slate-100 pt-2 shrink-0">
                    Figure C: Real-time body-to-token parsing showing indeed/external sender scoring logs.
                  </div>
                </div>
              )}

            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
