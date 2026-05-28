import React, { useState } from "react";
import { Job } from "../types";
import { MailOpen, Bell, AlertTriangle, RefreshCw, Trash2, Mail, Briefcase, Inbox, Filter, ExternalLink } from "lucide-react";
import { GoogleUser } from "../lib/googleAuth";
import { JOBFLOW_GMAIL_LABEL_NAME } from "../lib/gmailLabels";
import { matchEmailToJob } from "../lib/emailMatcher";

interface EmailMonitorProps {
  jobs: Job[];
  onUpdateJobStatus: (id: string, status: Job["status"]) => void;
  emails: ParsedEmail[];
  isLoadingEmails: boolean;
  emailError: string | null;
  needsAuth: boolean;
  isLoggingIn: boolean;
  token: string | null;
  user: GoogleUser | null;
  isDemoMode: boolean;
  onStartDemoMode: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onDeleteEmail: (id: string) => void;
  hiddenEmailIds: string[];
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
  hiddenEmailIds,
  onRefreshEmails,
  selectedCompanyJob,
  onSelectCompanyJob,
  isSyncActive,
  onToggleSync
}: EmailMonitorProps) {

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

  // Group emails by the shared matcher so the tracker and monitor stay consistent.
  const groupedJobs: Record<string, { job: Job, emails: ParsedEmail[] }> = {};
  
  jobs.forEach(job => {
    const key = `${job.company}-${job.title}`;
    groupedJobs[key] = { job, emails: [] };
  });
  
  const untrackedEmails: ParsedEmail[] = [];
  const emailJobMap: Record<string, Job> = {};

  emails.forEach(email => {
    const match = matchEmailToJob(email, jobs);
    if (match) {
      const matchedJobKey = `${match.job.company}-${match.job.title}`;
      groupedJobs[matchedJobKey].emails.push(email);
      emailJobMap[email.id] = match.job;
    } else {
      untrackedEmails.push(email);
    }
  });

  if (needsAuth) {
    return (
      <div className="flex-1 bg-faction-panel rounded border border-faction-border shadow-xl flex flex-col items-center justify-center p-8">
        <Mail className="w-14 h-14 text-slate-700 mb-4 animate-pulse" />
        <h2 className="text-sm font-bold font-mono uppercase tracking-widest text-[#e6edf3] mb-2">Connect your Gmail Inbox</h2>
        <p className="text-xs font-mono text-slate-400 max-w-sm text-center mb-6 leading-relaxed">
          Link to your Google account to live-monitor matching recruiter communications in real-time. We only query and trace work-related email matches.
        </p>
        <button
          onClick={onLogin}
          disabled={isLoggingIn}
          className="px-4 py-2 bg-white border border-slate-300 rounded shadow-md hover:shadow-lg hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer font-sans text-xs font-bold disabled:opacity-50 mb-5 transition-all text-slate-800 active:scale-98"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-full h-full">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
          </div>
          <span className="text-slate-700">{isLoggingIn ? "Sign In Sequence..." : "Sign in with Google"}</span>
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
    // Filter out our locally deleted / hidden items
    const visibleList = emailList.filter(email => !hiddenEmailIds.includes(email.id));

    if (visibleList.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500 p-6 bg-black/30 rounded border border-dashed border-faction-border shadow-inner">
          <MailOpen className="w-8 h-8 mx-auto text-slate-700 mb-2.5" />
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Workspace Inbox Clean</h4>
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
            title="Delete from Sight"
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
                <h4 className="text-[11.5px] font-bold font-mono text-slate-200 leading-snug">{email.subject || '(No Subject)'}</h4>
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
              <span className="text-slate-400 truncate max-w-sm">From: {email.from}</span>
              <span className="text-slate-700 font-bold">•</span>
              <span className="text-slate-550">{new Date(email.date).toLocaleString()}</span>
            </div>
            
            <div className="mt-2 text-[10px] text-faction-text bg-black/40 p-2.5 rounded border border-faction-border max-h-48 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed select-text">
              {email.bodyText.trim() === "" ? <span className="italic text-slate-600">Message content empty or not parseable from plain text.</span> : email.bodyText}
            </div>
          </div>
        </div>
      );
    });
  };

  const getVisibleEmailsCount = (emailList: ParsedEmail[]) => {
    return emailList.filter(email => !hiddenEmailIds.includes(email.id)).length;
  };

  const getSelectedEmails = () => {
    if (selectedCompanyJob === "all") return emails;
    if (selectedCompanyJob === "untracked") return untrackedEmails;
    if (selectedCompanyJob && groupedJobs[selectedCompanyJob]) return groupedJobs[selectedCompanyJob].emails;
    return [];
  };

  const visibleEmailsCount = getVisibleEmailsCount(emails);
  const visibleUntrackedCount = getVisibleEmailsCount(untrackedEmails);

  return (
    <div className="flex-1 flex flex-col gap-2 overflow-hidden" id="email-monitor-workspace">
      {!isDemoMode && user && (
        <p className="text-[9px] font-mono text-emerald-400/90 bg-emerald-950/20 border border-emerald-900/30 rounded px-2.5 py-1.5 shrink-0">
          Matched job emails are saved to Gmail label <strong>{JOBFLOW_GMAIL_LABEL_NAME}</strong> so future syncs remember them.
        </p>
      )}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0">
      {/* Sidebar: Grouped Categories with cohesive structural blocks */}
      <div className="w-full lg:w-64 flex flex-col bg-faction-panel border border-faction-border rounded overflow-hidden shrink-0 shadow-lg">
        <div className="p-3 border-b border-faction-border bg-faction-panel-header/80 flex items-center justify-between">
          <h2 className="text-[10px] font-black font-mono uppercase tracking-widest text-faction-text flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-400" /> Tracking Hub
          </h2>
          <button 
            onClick={onRefreshEmails}
            disabled={isLoadingEmails}
            className="p-1.5 text-slate-400 hover:text-blue-450 hover:bg-slate-900 rounded cursor-pointer disabled:opacity-50 transition-colors"
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-left cursor-pointer transition-colors border ${selectedCompanyJob === "all" ? 'bg-faction-primary text-faction-text border-faction-accent-border/40 font-bold' : 'border-transparent hover:bg-black/10 text-faction-text-muted'}`}
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-left cursor-pointer transition-colors border ${selectedCompanyJob === "untracked" ? 'bg-faction-primary text-faction-text border-faction-accent-border/40 font-bold' : 'border-transparent hover:bg-black/10 text-faction-text-muted'}`}
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
                      className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left cursor-pointer transition-colors border ${isSelected ? 'bg-faction-primary text-faction-text border-faction-accent-border/40' : 'border-transparent hover:bg-black/10 text-faction-text-muted'}`}
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
        <div className="p-3 border-t border-faction-border bg-black/20 flex flex-col gap-2 shrink-0 font-mono">
          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-slate-505 select-none">
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
             title={isSyncActive ? "Pause active mail polling" : "Resume active 8s polling and trash sweepers"}
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
              <span className="truncate max-w-[120px] font-semibold text-slate-300">{user?.email}</span>
              <button onClick={onLogout} className="text-slate-450 hover:text-rose-450 cursor-pointer underline font-bold transition-colors">Log out</button>
            </>
          )}
        </div>
      </div>        {/* Main Mail View */}
      <div className="flex-1 bg-faction-panel rounded border border-faction-border shadow-xl flex flex-col overflow-hidden">
        {selectedCompanyJob ? (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-faction-border bg-faction-panel-header/80 flex items-center justify-between shrink-0 font-mono">
              <div className="flex flex-col gap-1 pr-4">
                <h3 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider leading-none">
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
                      groupedJobs[selectedCompanyJob].job.status === "submitted" ? "bg-slate-900 text-slate-350 border-slate-800" :
                      groupedJobs[selectedCompanyJob].job.status === "denied" ? "bg-rose-950/40 text-rose-400 border-rose-900/30" :
                      groupedJobs[selectedCompanyJob].job.status === "interviewing" ? "bg-blue-950/40 text-blue-400 border-blue-900/30" :
                      "bg-slate-950/20 text-[#e6edf3] border-slate-800"
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
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/10">
              {isLoadingEmails ? (
                <div className="flex flex-col justify-center items-center h-full text-slate-500 gap-2.5 py-12 font-mono">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                  <p className="text-[10px] font-bold text-slate-400">Syncing live workspace details...</p>
                  <p className="text-[9px] text-slate-500">Performing fast parallel checks with official Google servers</p>
                </div>
              ) : (
                renderEmailList(getSelectedEmails())
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 text-slate-505 font-mono">
            <Inbox className="w-10 h-10 text-slate-700 mb-2.5" />
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Select a Pipeline Filter</h3>
            <p className="text-[10px] text-slate-500 mt-1 max-w-sm leading-relaxed">
              Click any matching active pipeline or view global feeds from the tracking panel to inspect recent email statuses.
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
