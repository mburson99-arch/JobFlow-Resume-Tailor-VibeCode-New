import React, { useMemo, useState, useEffect } from "react";
import { Job } from "../types";
import { MailOpen, Bell, AlertTriangle, RefreshCw, Trash2, Mail, Briefcase, Inbox, Filter, ExternalLink } from "lucide-react";

interface EmailMonitorProps {
  jobs: Job[];
  onUpdateJobStatus: (id: string, status: Job["status"]) => void;
  emails: ParsedEmail[];
  isLoadingEmails: boolean;
  emailError: string | null;
  needsAuth: boolean;
  isLoggingIn: boolean;
  token: string | null;
  user: any | null;
  isDemoMode: boolean;
  onStartDemoMode: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onDeleteEmail: (id: string) => void;
  onRefreshEmails: () => void;
  selectedCompanyJob: string | null;
  onSelectCompanyJob: (val: string | null) => void;
  isSyncActive: boolean;
  onToggleSync: () => void;
}

interface ParsedEmail {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
  bodyText: string;
}

export default function EmailMonitor({
  jobs,
  onUpdateJobStatus,
  emails,
  isLoadingEmails,
  emailError,
  needsAuth,
  isLoggingIn,
  token,
  user,
  isDemoMode,
  onStartDemoMode,
  onLogin,
  onLogout,
  onDeleteEmail,
  onRefreshEmails,
  selectedCompanyJob,
  onSelectCompanyJob,
  isSyncActive,
  onToggleSync
}: EmailMonitorProps) {
  const [googleClientId, setGoogleClientId] = useState(() => {
    try {
      return localStorage.getItem("jobflow_google_client_id") || "";
    } catch {
      return "";
    }
  });

  // Dismissed individual pipeline subcategories ("close to clear from sight, allow auto reopening on update")
  const [dismissedCategories, setDismissedCategories] = useState<Record<string, { emailCount: number; status: string }>>(() => {
    try {
      const stored = localStorage.getItem("jobflow_dismissed_categories");
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });

  const handleDismissCategory = (e: React.MouseEvent, key: string, emailCount: number, status: string) => {
    e.stopPropagation();
    const next = {
      ...dismissedCategories,
      [key]: { emailCount, status }
    };
    setDismissedCategories(next);
    localStorage.setItem("jobflow_dismissed_categories", JSON.stringify(next));
    if (selectedCompanyJob === key) {
      onSelectCompanyJob("all");
    }
  };

  const isCategoryDismissed = (key: string, emailCount: number, status: string) => {
    const saved = dismissedCategories[key];
    if (!saved) return false;
    return saved.emailCount === emailCount && saved.status === status;
  };

  // Persistent local deletion state ("delete from sight")
  const [hiddenEmailIds, setHiddenEmailIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("jobflow_hidden_email_ids");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem("jobflow_hidden_email_ids");
        setHiddenEmailIds(stored ? JSON.parse(stored) : []);
      } catch (e) {
        setHiddenEmailIds([]);
      }
    };
    handleStorageChange();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [jobs]);

  // Grouping logic with STRICT BRAND MATCHING to keep common word clutter ("clutter bullshit") out
  const { groupedJobs, untrackedEmails, emailJobMap } = useMemo(() => {
    const nextGroupedJobs: Record<string, { job: Job, emails: ParsedEmail[] }> = {};
    const nextUntrackedEmails: ParsedEmail[] = [];
    const nextEmailJobMap: Record<string, Job> = {};

    jobs.forEach(job => {
      const key = `${job.company}-${job.title}`;
      nextGroupedJobs[key] = { job, emails: [] };
    });

    // Generic business/tech terms to strip from token matching to avoid false positives
    const GENERIC_COMPANIES = new Set([
      "technology", "technologies", "medical", "corporation", "corporations", "corp", "group", "group llc",
      "solutions", "solution", "services", "service", "systems", "system", "inc", "co", "llc", "ltd", "limited",
      "consulting", "careers", "jobs", "staffing", "recruitment", "recruiting", "talent", "com", "net", "org",
      "workday", "workday.com", "myworkday", "myworkdayjobs", "noreply", "no-reply",
      "all", "access", "help", "desk", "support", "technical", "technician", "specialist", "level", "remote"
    ]);
    const hasWord = (text: string, word: string) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);

    emails.forEach(email => {
      let matchedJobKey: string | null = null;
      let matchedJob: Job | null = null;
      let highestScore = 0;

    // Normalize spacing and formatting: compress newlines, tabs, and non-breaking spaces (\u00a0) into a single space
    const fromStr = email.from.toLowerCase().replace(/[\s\u00a0]+/g, " ");
    const subStr = email.subject.toLowerCase().replace(/[\s\u00a0]+/g, " ");
    const bodyStr = email.bodyText.toLowerCase().replace(/[\s\u00a0]+/g, " ");
    const snippetStr = (email.snippet || "").toLowerCase().replace(/[\s\u00a0]+/g, " ");
    const allText = `${fromStr} ${subStr} ${bodyStr} ${snippetStr}`;

    for (const job of jobs) {
      const company = job.company.toLowerCase().trim();
      const title = job.title.toLowerCase().trim();
      const cleanTitle = title.replace(/\b(job post|- job post)\b/gi, "").trim();

      // Extract core unique brand word. For "Mercer Bucks Technology", it yields "mercer bucks"
      // For "Zoll Medical Corporation", it yields "zoll"
      const coreBrand = company
        .replace(/\b(technology|technologies|medical|corporation|corp|inc|llc|ltd|limited|group|solutions|services|systems|care)\b/gi, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const brandWords = coreBrand
        .split(/\s+/)
        .filter(w => w.length >= 4 && !GENERIC_COMPANIES.has(w));

      let score = 0;
      let matchedSpecificToken = false;
      let strongCompanyEvidence = false;

      // 1. Core Brand Phrase match in prominent fields (Huge Score)
      if (coreBrand.length > 2) {
        if (fromStr.includes(coreBrand) || subStr.includes(coreBrand)) {
          score += 50;
          matchedSpecificToken = true;
          strongCompanyEvidence = true;
        } else if (bodyStr.includes(coreBrand) || snippetStr.includes(coreBrand)) {
          score += 30;
          matchedSpecificToken = true;
          strongCompanyEvidence = true;
        }
      }

      // 2. Individual non-generic token check (No Alex Mercer constraints apply)
      let bodyBrandWordMatches = 0;
      let uniqueBodyBrandMatch = false;
      brandWords.forEach(word => {
        if (hasWord(fromStr, word)) {
          score += 25;
          matchedSpecificToken = true;
          strongCompanyEvidence = true;
        } else if (hasWord(subStr, word)) {
          score += 20;
          matchedSpecificToken = true;
          strongCompanyEvidence = true;
        } else if (hasWord(bodyStr, word) || hasWord(snippetStr, word)) {
          score += 15;
          matchedSpecificToken = true;
          bodyBrandWordMatches += 1;
          if (word.length >= 6) uniqueBodyBrandMatch = true;
        }
      });
      if (bodyBrandWordMatches >= 2) strongCompanyEvidence = true;
      if (uniqueBodyBrandMatch) {
        score += 15;
        strongCompanyEvidence = true;
      }

      // 3. Exact matching overrides for known companies
      if (company.includes("zoll") && (fromStr.includes("zoll") || subStr.includes("zoll") || bodyStr.includes("zoll") || snippetStr.includes("zoll"))) {
        score += 35;
        matchedSpecificToken = true;
        strongCompanyEvidence = true;
      }
      if (company.includes("mercer") && (fromStr.includes("mercer") || subStr.includes("mercer") || bodyStr.includes("mercer") || snippetStr.includes("mercer"))) {
        score += 35;
        matchedSpecificToken = true;
        strongCompanyEvidence = true;
      }

      // 4. Role keywords (Only adds positive reinforcement if we already have a strong company brand signal)
      if (matchedSpecificToken && score >= 20) {
        // Clean titles of "job post" noise
        if (subStr.includes(cleanTitle)) {
          score += 15;
        } else if (bodyStr.includes(cleanTitle) || snippetStr.includes(cleanTitle)) {
          score += 5;
        }

        const titleWords = cleanTitle
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter(w => w.length > 3 && !GENERIC_COMPANIES.has(w));

        for (const token of titleWords) {
          if (subStr.includes(token)) score += 4;
          else if (bodyStr.includes(token) || snippetStr.includes(token)) score += 2;
        }
      }

      if (matchedSpecificToken && strongCompanyEvidence && score > highestScore) {
        highestScore = score;
        matchedJobKey = `${job.company}-${job.title}`;
        matchedJob = job;
      }
    }

    // High threshold of 20 verifies that words like "technology" or "medical" alone inside body/subject yield 0 score
      if (matchedJobKey && highestScore >= 30 && matchedJob) {
        nextGroupedJobs[matchedJobKey].emails.push(email);
        nextEmailJobMap[email.id] = matchedJob;
      } else {
        nextUntrackedEmails.push(email);
      }
    });

    return {
      groupedJobs: nextGroupedJobs,
      untrackedEmails: nextUntrackedEmails,
      emailJobMap: nextEmailJobMap,
    };
  }, [jobs, emails]);

  if (needsAuth) {
    return (
      <div className="flex-1 bg-faction-panel rounded border border-faction-border shadow-xl flex flex-col items-center justify-center p-8">
        <Mail className="w-14 h-14 text-slate-700 mb-4 animate-pulse" />
        <h2 className="text-sm font-bold font-mono uppercase tracking-widest text-faction-text mb-2">Connect Google Workspace</h2>
        <p className="text-xs font-mono text-slate-400 max-w-sm text-center mb-6 leading-relaxed">
          Sign in directly with Google OAuth to monitor matching Gmail recruiter communications. Firebase is not used.
        </p>
        <input
          type="text"
          value={googleClientId}
          onChange={(e) => {
            setGoogleClientId(e.target.value);
            localStorage.setItem("jobflow_google_client_id", e.target.value.trim());
          }}
          placeholder="Google OAuth Client ID (.apps.googleusercontent.com)"
          className="w-full max-w-md mb-3 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={onLogin}
          disabled={isLoggingIn || !googleClientId.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded shadow-md flex items-center gap-2.5 cursor-pointer font-sans text-xs font-bold disabled:opacity-50 mb-5 transition-all text-white active:scale-98"
        >
          <Mail className="w-4 h-4" />
          <span>{isLoggingIn ? "Connecting..." : "Sign in with Google OAuth"}</span>
        </button>

        <div className="mt-6 border-t border-faction-border pt-5 w-full max-w-xs text-center">
          <span className="text-[9px] text-[#4285f4] font-black block mb-3.5 uppercase tracking-widest font-mono">Demo Sandbox Workspace Mode</span>
          <button
            onClick={onStartDemoMode}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-405 text-xs font-mono font-bold rounded-lg border border-blue-500/20 shadow-xs cursor-pointer transition-colors"
          >
            <Briefcase className="w-3.5 h-3.5 text-blue-400" />
            LOAD SIMULATED DEMO SANDBOX
          </button>
          <p className="mt-2 text-[9px] text-slate-500 font-mono">
            Instantly render mock communications from Zoll Medical and Mercer Bucks to visualize matched recruiter triggers without granting email access.
          </p>
        </div>
      </div>
    );
  }

  const renderEmailList = (emailList: ParsedEmail[]) => {
    // Keep matched messages visible even if they were previously auto-hidden while unmatched.
    const visibleList = emailList.filter(email => emailJobMap[email.id] || !hiddenEmailIds.includes(email.id));

    if (visibleList.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500 p-6 bg-slate-50 rounded border border-dashed border-slate-300 shadow-inner">
          <MailOpen className="w-8 h-8 mx-auto text-slate-400 mb-2.5" />
          <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-wider font-mono">Workspace Inbox Clean</h4>
          <p className="text-[9px] max-w-xs mx-auto mt-1 text-slate-500 leading-normal font-mono">
            No active communications matched. Hidden or deleted emails are persistently shelved from your tracking feed.
          </p>
        </div>
      );
    }

    return visibleList.map(email => {
      const matchedJob = emailJobMap[email.id];
      const gmailLink = `https://mail.google.com/mail/u/0/#inbox/${email.threadId || email.id}`;
      return (
        <div key={email.id} className="p-3.5 rounded border border-faction-border bg-faction-panel/50 hover:border-faction-accent transition-colors flex gap-3 items-start shadow-md">
          {/* Delete Button on Left */}
          <button
            onClick={() => onDeleteEmail(email.id)}
            title="Hide locally only. This no longer moves Gmail messages to Trash."
            className="p-1 text-slate-500 hover:text-rose-450 hover:bg-rose-950/20 rounded cursor-pointer transition-colors shrink-0 mt-0.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  {matchedJob ? (
                    <span className="px-1.5 py-0.5 bg-emerald-950/40 text-emerald-400 text-[8.5px] font-bold rounded border border-emerald-900/30 uppercase tracking-widest font-mono select-none">
                      Matched: {matchedJob.company}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-black/40 text-faction-text-muted text-[8.5px] font-bold rounded border border-faction-border uppercase tracking-widest font-mono select-none">
                      Unmatched / Other
                    </span>
                  )}
                </div>
                <h4 className="text-[11.5px] font-bold font-mono text-slate-900 leading-snug">{email.subject || '(No Subject)'}</h4>
              </div>

              {/* Clickable Deep Link to Gmail */}
              <a
                href={gmailLink}
                target="_blank"
                referrerPolicy="no-referrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[9px] font-bold font-mono text-blue-400 hover:text-blue-300 bg-blue-955/20 hover:bg-blue-955/40 rounded transition-colors border border-blue-900/40 cursor-pointer shadow whitespace-nowrap"
                title="Open this conversation thread in Gmail"
              >
                Open in Gmail <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 font-mono">
              <span className="text-slate-600 truncate max-w-sm">From: {email.from}</span>
              <span className="text-slate-400 font-bold">•</span>
              <span className="text-slate-600">{new Date(email.date).toLocaleString()}</span>
            </div>

            <div className="mt-2 text-[10px] text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed select-text">
              {email.bodyText.trim() === "" ? <span className="italic text-slate-600">Message content empty or not parseable from plain text.</span> : email.bodyText}
            </div>
          </div>
        </div>
      );
    });
  };

  const getVisibleEmailsCount = (emailList: ParsedEmail[]) => {
    return emailList.filter(email => emailJobMap[email.id] || !hiddenEmailIds.includes(email.id)).length;
  };

  const getSelectedEmails = () => {
    if (selectedCompanyJob === "all") return emails;
    if (selectedCompanyJob === "untracked") return untrackedEmails;
    if (selectedCompanyJob && groupedJobs[selectedCompanyJob]) return groupedJobs[selectedCompanyJob].emails;
    return [];
  };

  const visibleEmailsCount = getVisibleEmailsCount(emails);
  const visibleUntrackedCount = getVisibleEmailsCount(untrackedEmails);  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden" id="email-monitor-workspace">
      {/* Sidebar: Grouped Categories with cohesive structural blocks */}
      <div className="w-full lg:w-64 flex flex-col bg-faction-panel border border-faction-border rounded overflow-hidden shrink-0 shadow-lg">
        <div className="p-3 border-b border-faction-border bg-faction-panel-header/80 flex items-center justify-between">
          <h2 className="text-[10px] font-black font-mono uppercase tracking-widest text-faction-text flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-400" /> Tracking Hub
          </h2>
          <button
            onClick={onRefreshEmails}
            disabled={isLoadingEmails}
            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer disabled:opacity-50 transition-colors"
            title="Reload Inbox Feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEmails ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {/* SECTION 1: GLOBAL FEEDS */}
          <div>
            <p className="px-2.5 py-1 text-[8.5px] font-extrabold font-mono uppercase tracking-widest text-slate-500 select-none">Global Feeds</p>
            <div className="space-y-1">
              <button
                onClick={() => onSelectCompanyJob("all")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-left cursor-pointer transition-colors border ${selectedCompanyJob === "all" ? 'bg-blue-50 text-blue-900 border-blue-200 font-bold' : 'border-transparent hover:bg-slate-50 text-slate-600'}`}
              >
                <div className="flex items-center gap-2">
                  <Inbox className={`w-3.5 h-3.5 ${selectedCompanyJob === "all" ? 'text-blue-400' : 'text-slate-600'}`} />
                  <div className="text-[11px] font-mono">1:1 Gmail Feed</div>
                </div>
                {visibleEmailsCount > 0 && (
                  <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md ${selectedCompanyJob === "all" ? 'bg-[#0f172a] text-blue-400 border border-blue-500/20' : 'bg-slate-900 text-slate-550'}`}>
                    {visibleEmailsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => onSelectCompanyJob("untracked")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-left cursor-pointer transition-colors border ${selectedCompanyJob === "untracked" ? 'bg-blue-50 text-blue-900 border-blue-200 font-bold' : 'border-transparent hover:bg-slate-50 text-slate-600'}`}
              >
                <div className="flex items-center gap-2">
                  <Filter className={`w-3.5 h-3.5 ${selectedCompanyJob === "untracked" ? 'text-blue-400' : 'text-slate-600'}`} />
                  <div className="text-[11px] font-mono">Uncategorized / Other</div>
                </div>
                {visibleUntrackedCount > 0 && (
                  <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md ${selectedCompanyJob === "untracked" ? 'bg-[#0f172a] text-blue-400 border border-blue-500/20' : 'bg-slate-900 text-slate-550'}`}>
                    {visibleUntrackedCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* SECTION 2: PIPELINE MATCHED */}
          <div className="pt-2">
            <p className="px-2.5 py-1 text-[8.5px] font-extrabold font-mono uppercase tracking-widest text-faction-text-muted select-none border-t border-faction-border mt-1">Application Matches</p>
            <div className="space-y-1">
              {Object.entries(groupedJobs)
                .filter(([key, group]) => {
                  const cnt = getVisibleEmailsCount(group.emails);
                  return !isCategoryDismissed(key, cnt, group.job.status);
                })
                .map(([key, group]) => {
                  const groupCount = getVisibleEmailsCount(group.emails);
                  const isSelected = selectedCompanyJob === key;
                  return (
                    <div
                      key={key}
                      onClick={() => onSelectCompanyJob(key)}
                      className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left cursor-pointer transition-colors border ${isSelected ? 'bg-blue-50 text-blue-900 border-blue-200' : 'border-transparent hover:bg-slate-50 text-slate-600'}`}
                    >
                      <div className="flex-1 overflow-hidden pr-1">
                        <div className="text-[11px] font-bold font-mono truncate leading-tight">{group.job.company}</div>
                        <div className="text-[9px] truncate text-slate-500 mt-0.5 font-mono">{group.job.title.replace(' - job post', '')}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {groupCount > 0 && (
                          <span className={`text-[9.5px] font-bold font-mono px-1.5 py-0.5 rounded ${isSelected ? 'bg-[#0f172a] text-blue-400 border border-blue-500/20' : 'bg-slate-900 text-slate-500'}`}>
                            {groupCount}
                          </span>
                        )}
                        {/* Dismiss button per category requested by user */}
                        <button
                          onClick={(e) => handleDismissCategory(e, key, groupCount, group.job.status)}
                          title="Clear subcategory from list (auto-restores on status/email update)"
                          className="text-slate-500 hover:text-rose-450 p-0.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ml-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>

        {/* Sync Mode Control Block */}
        <div className="p-3 border-t border-faction-border bg-slate-50 flex flex-col gap-2 shrink-0 font-mono">
          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-slate-600 select-none">
            <span>Automation Feed</span>
            {isSyncActive ? (
              <span className="text-[8px] text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-1 py-0.5 rounded uppercase font-black tracking-widest animate-pulse flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
                ACTIVE SYNC
              </span>
            ) : (
              <span className="text-[8px] text-amber-500 bg-amber-950/40 border border-amber-900/50 px-1 py-0.5 rounded uppercase font-black tracking-widest flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-amber-500" />
                LIVE STANDBY
              </span>
            )}
          </div>
          <button
            onClick={onToggleSync}
            className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded text-[10px] font-bold cursor-pointer border transition-colors ${
              isSyncActive
                ? "bg-amber-950/20 hover:bg-amber-950/40 text-amber-400 border-amber-900/40"
                : "bg-blue-950/20 hover:bg-blue-950/40 text-blue-400 border-blue-900/40"
            }`}
             title={isSyncActive ? "Pause active mail polling" : "Resume active 20s polling and faster feed cleanup"}
          >
            {isSyncActive ? (
              <>⏸ Pause & Hold Feed</>
            ) : (
              <>⚡ Resume Live Sync</>
            )}
          </button>
        </div>

        <div className="p-3 border-t border-faction-border bg-faction-panel-header text-[10px] text-faction-text-muted flex justify-between items-center shrink-0 font-mono">
          {isDemoMode ? (
            <>
              <span className="text-amber-500 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-505 animate-pulse" /> SIMULATOR ACTIVE
              </span>
              <button
                onClick={onLogout}
                className="text-slate-450 hover:text-rose-400 cursor-pointer underline font-bold transition-colors"
              >
                Exit Sandbox
              </button>
            </>
          ) : (
            <>
              <span className="truncate max-w-[120px] font-semibold text-slate-700">{user?.email}</span>
              <button onClick={onLogout} className="text-slate-600 hover:text-rose-700 cursor-pointer underline font-bold transition-colors">Log out</button>
            </>
          )}
        </div>
      </div>        {/* Main Mail View */}
      <div className="flex-1 bg-faction-panel rounded border border-faction-border shadow-xl flex flex-col overflow-hidden">
        {selectedCompanyJob ? (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-faction-border bg-faction-panel-header/80 flex items-center justify-between shrink-0 font-mono">
              <div className="flex flex-col gap-1 pr-4">
                <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider leading-none">
                  {selectedCompanyJob === "all" ? "1:1 Google Workspace Feed" : selectedCompanyJob === "untracked" ? "Uncategorized Work Emails" : selectedCompanyJob.replace('-', ' - ')}
                </h3>
                <p className="text-[9.5px] text-slate-500 leading-normal mt-1">
                  {selectedCompanyJob === "all" ? "A clean, prioritized timeline mapping Live Google Workspace communications." : "Emails and workspace thread history matched strictly to this application pipeline."}
                </p>
              </div>
              {selectedCompanyJob !== "untracked" && selectedCompanyJob !== "all" && groupedJobs[selectedCompanyJob]?.job && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono select-none">Pipeline status:</span>
                  <select
                    value={groupedJobs[selectedCompanyJob].job.status}
                    onChange={(e) => onUpdateJobStatus(groupedJobs[selectedCompanyJob].job.id, e.target.value as any)}
                    className={`px-2 py-1 rounded text-[10px] font-mono outline-none cursor-pointer border shadow transition-colors ${
                      groupedJobs[selectedCompanyJob].job.status === "submitted" ? "bg-slate-900 text-white border-slate-800" :
                      groupedJobs[selectedCompanyJob].job.status === "denied" ? "bg-rose-950/40 text-rose-400 border-rose-900/30" :
                      groupedJobs[selectedCompanyJob].job.status === "interviewing" ? "bg-blue-950/40 text-blue-400 border-blue-900/30" :
                      "bg-white text-slate-900 border-slate-300"
                    }`}
                  >
                    <option value="captured">Captured</option>
                    <option value="analyzing">Analyzing</option>
                    <option value="tailored">Tailored / Review Ready</option>
                    <option value="submitted">✓ Submitted</option>
                    <option value="interviewing">► Next Step (Interview)</option>
                    <option value="denied">✕ Denied</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {isLoadingEmails ? (
                <div className="flex flex-col justify-center items-center h-full text-slate-500 gap-2.5 py-12 font-mono">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                  <p className="text-[10px] font-bold text-slate-700">Syncing live workspace details...</p>
                  <p className="text-[9px] text-slate-500">Performing fast parallel checks with official Google servers</p>
                </div>
              ) : (
                renderEmailList(getSelectedEmails())
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 text-slate-600 font-mono">
            <Inbox className="w-10 h-10 text-slate-400 mb-2.5" />
            <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Select a Pipeline Filter</h3>
            <p className="text-[10px] text-slate-500 mt-1 max-w-sm leading-relaxed">
              Click any matching active pipeline or view global feeds from the tracking panel to inspect recent email statuses.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
