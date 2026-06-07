import React, { useState, useEffect, useMemo, useRef } from "react";
import { Job, CandidateProfile, EmailAlert, LogMessage } from "./types";
import { Briefcase, Layers, Sparkles, Mail, Settings, Chrome, Terminal, AlertTriangle, CheckCircle, ChevronRight, HelpCircle, Bell, ExternalLink, Trash2, X } from "lucide-react";
import Dashboard from "./components/Dashboard";
import ResumeTailor from "./components/ResumeTailor";
import EmailMonitor from "./components/EmailMonitor";
import ExtensionPanel from "./components/ExtensionPanel";
import Configuration from "./components/Configuration";
import ManualReviewModal from "./components/ManualReviewModal";
import AIConsole from "./components/AIConsole";
import { googleSignIn, logout } from "./lib/googleAuth";

import ProjectExport from "./components/ProjectExport";

interface ParsedEmail {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
  bodyText: string;
  labelIds?: string[];
}

const HIDDEN_EMAIL_STORAGE_VERSION = "4";
const GMAIL_TOKEN_STORAGE_KEY = "jobflow_google_access_token";

export default function App() {
  const [faction, setFaction] = useState<"alliance" | "horde" | "alliance">(() => {
    try {
      const saved = localStorage.getItem("jobflow_faction_theme");
      return (saved === "horde" || saved === "alliance") ? saved : "alliance";
    } catch {
      return "alliance";
    }
  });

  const handleToggleFaction = (nextFaction: "alliance" | "horde") => {
    setFaction(nextFaction);
    localStorage.setItem("jobflow_faction_theme", nextFaction);
  };

  const [activeTab, setActiveTab] = useState<"dashboard" | "tailor" | "emails" | "extension" | "config" | "export" | "gemini">("dashboard");
  const [jobs, setJobs] = useState<Job[]>(() => {
    try {
      const saved = localStorage.getItem("jobflow_jobs");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [deletedJobs, setDeletedJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<CandidateProfile>({
    name: "Michael Burson",
    email: "mburson99@gmail.com",
    phone: "740.755.0345",
    website: "https://github.com/mburson99-arch",
    githubProfileUrl: "https://github.com/mburson99-arch",
    githubProfileSummary: "",
    resumeText: "",
  });
  const [emails, setEmails] = useState<EmailAlert[]>([]);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Hoisted Gmail/Auth States
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(GMAIL_TOKEN_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<any | null>(() => {
    try {
      return sessionStorage.getItem(GMAIL_TOKEN_STORAGE_KEY) ? { email: "Google Workspace" } : null;
    } catch {
      return null;
    }
  });
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("jobflow_is_demo_mode");
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [gmailEmails, setGmailEmails] = useState<ParsedEmail[]>([]);
  const [emailError, setEmailError] = useState<string | null>(null);
  const isFetchingEmailsRef = useRef(false);
  const lastEmailSyncStartedAtRef = useRef(0);
  const untrashedEmailIdsRef = useRef<Set<string>>(new Set());

  // Persistent email deletion state ("delete from sight")
  const [hiddenEmailIds, setHiddenEmailIds] = useState<string[]>(() => {
    try {
      const version = localStorage.getItem("jobflow_hidden_email_version");
      if (version !== HIDDEN_EMAIL_STORAGE_VERSION) {
        localStorage.setItem("jobflow_hidden_email_version", HIDDEN_EMAIL_STORAGE_VERSION);
        localStorage.removeItem("jobflow_hidden_email_ids");
        localStorage.removeItem("jobflow_uncat_first_seen");
        return [];
      }
      const stored = localStorage.getItem("jobflow_hidden_email_ids");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Hoisted state from Tracking Hub to enable direct deep-link filter paths
  const [selectedCompanyJob, setSelectedCompanyJob] = useState<string | null>("all");

  // Toggle to stagnate/stay (Observer Mode) vs Active sync and auto-trash (Fetch and delete mode)
  const [isSyncActive, setIsSyncActive] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("jobflow_sync_active");
      return saved ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const handleToggleSync = () => {
    setIsSyncActive((prev) => {
      const nextVal = !prev;
      localStorage.setItem("jobflow_sync_active", String(nextVal));
      return nextVal;
    });
  };

  // Keep track of when unmatched/uncategorized emails are first seen in this workspace
  const [firstSeenUncategorized, setFirstSeenUncategorized] = useState<Record<string, number>>(() => {
    try {
      const version = localStorage.getItem("jobflow_hidden_email_version");
      if (version !== HIDDEN_EMAIL_STORAGE_VERSION) {
        return {};
      }
      const saved = localStorage.getItem("jobflow_uncat_first_seen");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const gmailJobQuerySignature = useMemo(() => {
    return jobs
      .map((job) => `${job.id}:${job.company}:${job.title}`)
      .sort()
      .join("|");
  }, [jobs]);

  // Search input query inside the sidebar Trash Bin
  const [trashSearch, setTrashSearch] = useState("");

  // Response tracker panel tab state: "feed" (Live Filing Feed) vs "trash" (Trash Bin)
  const [asideTab, setAsideTab] = useState<"feed" | "trash">("feed");

  // Local active persistent state for closed subcategories and their last known snapshot data
  const [closedSubcategories, setClosedSubcategories] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("jobflow_closed_subcategories");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleCloseSubcategory = (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();

    const snapshotData = {
      status: job.status,
      matchScore: job.matchScore,
      tailoredResumeText: job.tailoredResumeText,
      hasUnreadEmailUpdate: job.hasUnreadEmailUpdate,
      emailUpdateCount: job.emailUpdateCount,
      requiresRelocation: job.requiresRelocation
    };

    const nextClosed = {
      ...closedSubcategories,
      [job.id]: JSON.stringify(snapshotData)
    };
    setClosedSubcategories(nextClosed);
    localStorage.setItem("jobflow_closed_subcategories", JSON.stringify(nextClosed));
  };

  // Check for updates to closed subcategories and reopen them if updated
  useEffect(() => {
    let changed = false;
    const nextClosed = { ...closedSubcategories };

    jobs.forEach((j) => {
      if (nextClosed[j.id]) {
        try {
          const snapshot = JSON.parse(nextClosed[j.id]);
          const currentData = {
            status: j.status,
            matchScore: j.matchScore,
            tailoredResumeText: j.tailoredResumeText,
            hasUnreadEmailUpdate: j.hasUnreadEmailUpdate,
            emailUpdateCount: j.emailUpdateCount,
            requiresRelocation: j.requiresRelocation
          };

          // Compare the snapshot values with current values
          if (JSON.stringify(snapshot) !== JSON.stringify(currentData)) {
            delete nextClosed[j.id];
            changed = true;
          }
        } catch (err) {
          // Fallback if parsing fails or invalid
          delete nextClosed[j.id];
          changed = true;
        }
      }
    });

    if (changed) {
      setClosedSubcategories(nextClosed);
      localStorage.setItem("jobflow_closed_subcategories", JSON.stringify(nextClosed));
    }
  }, [jobs, closedSubcategories]);

  // Decode Gmail Body data stream
  const decodeEmailBody = (payload: any): string => {
    const collectAllTextParts = (parts: any[]): { plains: string[], htmls: string[] } => {
      let plains: string[] = [];
      let htmls: string[] = [];
      for (const part of parts) {
        if (part.mimeType === "text/plain" && part.body && part.body.data) {
          plains.push(part.body.data);
        } else if (part.mimeType === "text/html" && part.body && part.body.data) {
          htmls.push(part.body.data);
        }
        if (part.parts && part.parts.length > 0) {
          const sub = collectAllTextParts(part.parts);
          plains = plains.concat(sub.plains);
          htmls = htmls.concat(sub.htmls);
        }
      }
      return { plains, htmls };
    };

    let bodyChunks: string[] = [];
    if (payload.parts) {
      const parsedParts = collectAllTextParts(payload.parts);
      bodyChunks = [...parsedParts.plains, ...parsedParts.htmls];
    } else if (payload.body && payload.body.data) {
      bodyChunks = [payload.body.data];
    }

    if (bodyChunks.length > 0) {
      const decodedParts = bodyChunks.map(chunk => {
        try {
          const sanitized = chunk.replace(/[^A-Za-z0-9+/=_-]/g, "").replace(/-/g, '+').replace(/_/g, '/');
          const padded = sanitized.padEnd(sanitized.length + (4 - sanitized.length % 4) % 4, "=");

          let decodedStr = "";
          try {
            const binaryString = atob(padded);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            decodedStr = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
          } catch (err) {
            try {
              decodedStr = decodeURIComponent(escape(atob(padded)));
            } catch (err2) {
              decodedStr = atob(padded);
            }
          }

          if (typeof document !== 'undefined') {
            try {
              const doc = new DOMParser().parseFromString(decodedStr, "text/html");
              const textContent = doc.body.textContent || doc.body.innerText;
              if (textContent) {
                return textContent;
              }
            } catch (e) {
            }
          }

          return decodedStr
            .replace(/&nbsp;/gi, " ")
            .replace(/&amp;/gi, "&")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/<[^>]*>/g, " ");
        } catch (chunkErr) {
          return "";
        }
      });

      return decodedParts.filter(text => text.trim().length > 0).join("\n").slice(0, 12000);
    }
    return "";
  };

  // Gmail live fetch
  const fetchLiveEmails = async (accessToken: string) => {
    if (isFetchingEmailsRef.current) return;

    const syncStartedAt = Date.now();
    lastEmailSyncStartedAtRef.current = syncStartedAt;
    isFetchingEmailsRef.current = true;
    const yieldToUi = () => new Promise((resolve) => setTimeout(resolve, 0));

    setIsLoadingEmails(true);
    setEmailError(null);
    try {
      const companyQueries = jobs
        .map((job) => job.company || "")
        .flatMap((company) => {
          const normalized = company
            .replace(/\b(technology|technologies|medical|corporation|corp|inc|llc|ltd|limited|group|solutions|services|systems|care)\b/gi, "")
            .replace(/[^a-z0-9\s-]/gi, " ")
            .replace(/\s+/g, " ")
            .trim();
          const firstUniqueWord = normalized.split(/\s+/).find((word) => word.length >= 5);
          return [normalized, firstUniqueWord]
            .filter(Boolean)
            .flatMap((term) => [
              `"${term}" newer_than:365d`,
              `"${term}" in:anywhere newer_than:365d`,
            ]);
        })
        .slice(0, 12);

      const gmailQueries = [
        ...companyQueries,
        "newer_than:90d",
        "from:indeed newer_than:180d",
        "from:linkedin newer_than:180d",
        "from:workday newer_than:180d",
        "from:greenhouse newer_than:180d",
        "from:lever newer_than:180d",
        "from:smartrecruiters newer_than:180d",
        "from:ziprecruiter newer_than:180d",
        "from:glassdoor newer_than:180d",
        "subject:application newer_than:180d",
        "subject:interview newer_than:180d",
        "\"IT Support\" newer_than:180d",
        "\"Technical Support\" newer_than:180d",
        "\"Help Desk\" newer_than:180d",
      ];

      const messageMap = new Map<string, any>();

      for (const [index, query] of gmailQueries.entries()) {
        const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=35`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setEmailError("Filing Exception: Live Google Workspace session expired. Please re-sign in.");
          } else {
            setEmailError(`Filing Exception: Google API server responded with error status ${res.status}`);
          }
          continue;
        }

        const data = await res.json();
        (data.messages || []).forEach((msg: any) => messageMap.set(msg.id, msg));
        if (index % 3 === 2) await yieldToUi();
      }

      const messages = Array.from(messageMap.values()).slice(0, 120);

      if (messages.length > 0) {
          const resolved: Array<ParsedEmail | null> = [];
          const batchSize = 8;

          for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(async (msg: any) => {
            try {
              const mRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });
              if (mRes.ok) {
                const mData = await mRes.json();
                const headers = mData.payload.headers;
                const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject');
                const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from');
                const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date');

                return {
                  id: mData.id,
                  threadId: mData.threadId,
                  snippet: mData.snippet,
                  subject: subjectHeader ? subjectHeader.value : "No Subject",
                  from: fromHeader ? fromHeader.value : "Unknown Sender",
                  date: dateHeader ? dateHeader.value : "",
                  bodyText: decodeEmailBody(mData.payload),
                  labelIds: Array.isArray(mData.labelIds) ? mData.labelIds : [],
                } as ParsedEmail;
              }
            } catch (err) {
              console.error(`Error resolving email metadata for ${msg.id}:`, err);
            }
            return null;
            }));

            resolved.push(...batchResults);
            await yieldToUi();
          }

          const parsed = resolved.filter((e): e is ParsedEmail => e !== null);

          const sorted = parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          if (lastEmailSyncStartedAtRef.current === syncStartedAt) {
            setGmailEmails((previous) => {
              const prevKey = previous.map((email) => `${email.id}:${email.date}`).join("|");
              const nextKey = sorted.map((email) => `${email.id}:${email.date}`).join("|");
              return prevKey === nextKey ? previous : sorted;
            });
          }
          setEmailError(null);
        } else {
          setGmailEmails([]);
        }
    } catch (err: any) {
      console.error("Error fetching live emails", err);
      setEmailError(`Filing Exception: Failed to connect to Gmail inbox (${err.message || "Network Error"})`);
    } finally {
      setIsLoadingEmails(false);
      isFetchingEmailsRef.current = false;
    }
  };

  // Saved/Simulated Sandbox emails fetch
  const fetchDemoEmails = async () => {
    setIsLoadingEmails(true);
    setEmailError(null);
    try {
      const resp = await fetch("/api/emails");
      if (resp.ok) {
        const data = await resp.json();
        const mapped = data.map((simEmail: any) => ({
          id: simEmail.id,
          threadId: simEmail.id,
          snippet: simEmail.body ? simEmail.body.substring(0, 100) : "",
          subject: simEmail.subject || "No Subject",
          from: simEmail.senderName || `Recruitment Desk (${simEmail.company})`,
          date: simEmail.timestamp || new Date().toISOString(),
          bodyText: simEmail.body || "No message content.",
        })) as ParsedEmail[];

        // Strict Date Filter: Only pull data on or after May 20, 2026.
        const filtered = mapped.filter((e) => {
          try {
            const d = new Date(e.date);
            return d.getTime() >= new Date("2026-05-20T00:00:00Z").getTime();
          } catch {
            return false;
          }
        });

        setGmailEmails(filtered);
        setEmailError(null);
      } else {
        setEmailError("Filing Exception: Local API failure loading sandbox simulation.");
      }
    } catch (err: any) {
      console.error("Failed to fetch simulated sandbox emails:", err);
      setEmailError(`Filing Exception: Failed to retrieve sandbox email files (${err.message})`);
    } finally {
      setIsLoadingEmails(false);
    }
  };

  // Direct Google OAuth only. No Firebase.
  useEffect(() => {
    if (isDemoMode) {
      setUser(null);
      setToken(null);
      setNeedsAuth(false);
      return;
    }

    const restoredToken = sessionStorage.getItem(GMAIL_TOKEN_STORAGE_KEY);
    if (restoredToken) {
      setToken(restoredToken);
      setUser({ email: "Google Workspace" });
      setNeedsAuth(false);
    } else {
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
    }
  }, [isDemoMode]);

  // Periodic Email sync loop
  useEffect(() => {
    if (!isSyncActive) return; // Freeze polling / "stagnat and stay" representation
    if (isDemoMode) {
      fetchDemoEmails();
      const interval = setInterval(fetchDemoEmails, 15000);
      return () => clearInterval(interval);
    }

    if (token) {
      fetchLiveEmails(token);
      const interval = setInterval(() => fetchLiveEmails(token), 20000);
      return () => clearInterval(interval);
    }
  }, [isDemoMode, token, isSyncActive, gmailJobQuerySignature]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setEmailError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        sessionStorage.setItem(GMAIL_TOKEN_STORAGE_KEY, result.accessToken);
        setToken(result.accessToken);
        setUser({ email: "Google Workspace" });
        setNeedsAuth(false);
        setIsDemoMode(false);
        localStorage.setItem("jobflow_is_demo_mode", "false");
        fetchLiveEmails(result.accessToken);
      }
    } catch (err: any) {
      console.error("Direct Google OAuth failed:", err);
      setEmailError(`Auth Error: Google OAuth failed (${err.message})`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setGmailEmails([]);
    setNeedsAuth(true);
    setIsDemoMode(false);
    sessionStorage.removeItem(GMAIL_TOKEN_STORAGE_KEY);
    localStorage.setItem("jobflow_is_demo_mode", "false");
  };

  const handleStartDemoMode = () => {
    sessionStorage.removeItem(GMAIL_TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setIsDemoMode(true);
    setNeedsAuth(false);
    localStorage.setItem("jobflow_is_demo_mode", "true");
    fetchDemoEmails();
  };

  const handleRefreshEmails = () => {
    if (isDemoMode) {
      fetchDemoEmails();
    } else if (token) {
      fetchLiveEmails(token);
    }
  };

  const handleDeleteEmail = async (emailId: string) => {
    const updated = [...hiddenEmailIds, emailId];
    setHiddenEmailIds(updated);
    localStorage.setItem("jobflow_hidden_email_ids", JSON.stringify(updated));
  };

  const handleRestoreFromTrash = (emailId: string) => {
    const newHidden = hiddenEmailIds.filter(id => id !== emailId);
    setHiddenEmailIds(newHidden);
    localStorage.setItem("jobflow_hidden_email_ids", JSON.stringify(newHidden));

    const newFirstSeen = { ...firstSeenUncategorized };
    if (newFirstSeen[emailId]) {
      newFirstSeen[emailId] = Date.now();
      setFirstSeenUncategorized(newFirstSeen);
      localStorage.setItem("jobflow_uncat_first_seen", JSON.stringify(newFirstSeen));
    }

    if (!isDemoMode && token) {
      fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/untrash`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).catch((e) => console.error("Failed to restore Gmail message from Trash:", e));
    }
  };

  const getTrashedEmails = () => {
    return gmailEmails
      .filter(email => hiddenEmailIds.includes(email.id))
      .map(email => {
        let matchedCompany = "Unassigned Feed";
        let isMatched = false;

        const originalEvent = filingEvents.find(e => e.emailId === email.id);
        if (originalEvent && originalEvent.type === "filed") {
          matchedCompany = originalEvent.company;
          isMatched = true;
        }

        return {
          id: email.id,
          threadId: email.threadId,
          fromName: email.from.split("<")[0].replace(/"/g, '').trim(),
          fromEmail: email.from,
          subject: email.subject,
          date: email.date,
          matchedCompany,
          isMatched
        };
      })
      .filter(t => {
        if (!trashSearch.trim()) return true;
        const q = trashSearch.toLowerCase();
        return (
          t.fromName.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.matchedCompany.toLowerCase().includes(q)
        );
      });
  };

  // Filing classifier logic to compile activity feed for Response Tracker
  const getFilingEvents = () => {
    const events: any[] = [];
    if (emailError) {
      events.push({
        id: "err-auth",
        type: "error",
        desc: emailError,
        timestamp: new Date().toISOString(),
      });
    }

    const GENERIC_COMPANIES = new Set([
      "technology", "technologies", "medical", "corporation", "corporations", "corp", "group", "group llc",
      "solutions", "solution", "services", "service", "systems", "system", "inc", "co", "llc", "ltd", "limited",
      "consulting", "careers", "jobs", "staffing", "recruitment", "recruiting", "talent", "com", "net", "org",
      "workday", "workday.com", "myworkday", "myworkdayjobs", "noreply", "no-reply",
      "all", "access", "help", "desk", "support", "technical", "technician", "specialist", "level", "remote"
    ]);
    const hasWord = (text: string, word: string) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);

    gmailEmails.forEach((email) => {
      let matchedJob: Job | null = null;
      let highestScore = 0;

      const fromStr = email.from.toLowerCase();
      const subStr = email.subject.toLowerCase();
      const bodyStr = email.bodyText.toLowerCase();
      const snippetStr = (email.snippet || "").toLowerCase();
      const allText = `${fromStr} ${subStr} ${bodyStr} ${snippetStr}`;

      for (const job of jobs) {
        const company = job.company.toLowerCase().trim();
        const title = job.title.toLowerCase().trim();
        const cleanTitle = title.replace(/\b(job post|- job post)\b/gi, "").trim();

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

        if (matchedSpecificToken && score >= 20 && cleanTitle.length > 2) {
          if (subStr.includes(cleanTitle)) {
            score += 15;
          } else if (bodyStr.includes(cleanTitle) || snippetStr.includes(cleanTitle)) {
            score += 5;
          }
        }

        if (matchedSpecificToken && strongCompanyEvidence && score > highestScore) {
          highestScore = score;
          matchedJob = job;
        }
      }

      if (matchedJob && highestScore >= 30) {
        events.push({
          id: `filed-${email.id}`,
          type: "filed",
          company: matchedJob.company,
          title: matchedJob.title,
          fromName: email.from.split("<")[0].trim(),
          subject: email.subject,
          timestamp: email.date,
          emailId: email.id,
          threadId: email.threadId,
        });
      } else {
        events.push({
          id: `unmatched-${email.id}`,
          type: "unmatched",
          company: "Unassigned Feed",
          fromName: email.from.split("<")[0].trim(),
          subject: email.subject,
          timestamp: email.date,
          emailId: email.id,
          threadId: email.threadId,
        });
      }
    });

    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const filingEvents = useMemo(() => getFilingEvents(), [emailError, gmailEmails, jobs]);

  // Synchronously record "first seen" timestamps for any active, visible unmatched elements
  useEffect(() => {
    const filedIds = new Set(filingEvents.filter(e => e.type === "filed").map(e => e.emailId));
    const uncatEvents = filingEvents.filter(e => e.type === "unmatched");
    const now = Date.now();
    let updated = false;
    const newFirstSeen = { ...firstSeenUncategorized };

    filedIds.forEach((id) => {
      if (newFirstSeen[id]) {
        delete newFirstSeen[id];
        updated = true;
      }
    });

    uncatEvents.forEach(e => {
      if (!newFirstSeen[e.emailId]) {
        newFirstSeen[e.emailId] = now;
        updated = true;
      }
    });

    if (updated) {
      setFirstSeenUncategorized(newFirstSeen);
      localStorage.setItem("jobflow_uncat_first_seen", JSON.stringify(newFirstSeen));
    }
  }, [filingEvents]);

  // If an email becomes matched later, remove stale hidden/auto-trash state so it can show under the job again.
  useEffect(() => {
    const filedIds = new Set(filingEvents.filter(e => e.type === "filed").map(e => e.emailId));
    const restoredHidden = hiddenEmailIds.filter(id => !filedIds.has(id));

    if (restoredHidden.length !== hiddenEmailIds.length) {
      setHiddenEmailIds(restoredHidden);
      localStorage.setItem("jobflow_hidden_email_ids", JSON.stringify(restoredHidden));
    }
  }, [filingEvents, hiddenEmailIds]);

  useEffect(() => {
    if (isDemoMode || !token) return;

    const filedIds = new Set(filingEvents.filter(e => e.type === "filed").map(e => e.emailId));
    gmailEmails.forEach((email) => {
      if (!filedIds.has(email.id)) return;
      if (!email.labelIds?.includes("TRASH")) return;
      if (untrashedEmailIdsRef.current.has(email.id)) return;

      untrashedEmailIdsRef.current.add(email.id);
      fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.id}/untrash`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).catch((e) => {
        untrashedEmailIdsRef.current.delete(email.id);
        console.error("Failed to auto-restore matched Gmail message from Trash:", e);
      });
    });
  }, [filingEvents, gmailEmails, isDemoMode, token]);

  // Poll intervals to refresh logs & emails periodically
  useEffect(() => {
    fetchProfile();
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  // Listen for direct synchronization messages from the Chrome Extension content script
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === "JOBFLOW_DIRECT_SYNC") {
        console.log("⚡ [JobFlow App] Direct real-time job sync message received:", event.data.data);
        try {
          await fetch("/api/jobs/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(event.data.data),
          });
          fetchData();
        } catch (err) {
          console.error("Error saving direct sync data to local container:", err);
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const fetchProfile = async () => {
    try {
      let localProfile: Partial<CandidateProfile> = {};
      try {
        const savedProfile = localStorage.getItem("jobflow_profile");
        localProfile = savedProfile ? JSON.parse(savedProfile) : {};
        const savedGithubUrl = localStorage.getItem("jobflow_github_profile_url");
        const savedGithubSummary = localStorage.getItem("jobflow_github_profile_summary");
        if (savedGithubUrl) localProfile.githubProfileUrl = savedGithubUrl;
        if (savedGithubSummary) localProfile.githubProfileSummary = savedGithubSummary;
      } catch {}

      const profileRes = await fetch("/api/profile");
      if (profileRes.ok) {
        const loadedProfile = await profileRes.json();
        const mergedProfile = { ...loadedProfile, ...localProfile };
        setProfile(mergedProfile);

        if (Object.keys(localProfile).length > 0) {
          fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mergedProfile),
          }).catch((err) => console.warn("Could not restore local profile backup to server:", err));
        }
      }
    } catch (err) {
      console.error("Error fetching candidate profile:", err);
    }
  };

  const fetchData = async () => {
    try {
      const [jobsRes, deletedRes, emailsRes, logsRes] = await Promise.all([
        fetch("/api/jobs"),
        fetch("/api/jobs/deleted"),
        fetch("/api/emails"),
        fetch("/api/logs"),
      ]);

      if (emailsRes.ok) setEmails(await emailsRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());

      if (jobsRes.ok) {
        const serverJobs = await jobsRes.json();
        const serverDeleted = deletedRes.ok ? await deletedRes.json() : [];

        // Load tombstone list
        let deletedIds: string[] = [];
        try {
          const savedDeleted = localStorage.getItem("jobflow_deleted_jobs");
          deletedIds = savedDeleted ? JSON.parse(savedDeleted) : [];
        } catch {}

        let localJobs: Job[] = [];
        try {
          const saved = localStorage.getItem("jobflow_jobs");
          localJobs = saved ? JSON.parse(saved) : [];
        } catch {
          localJobs = [];
        }

        // Active items
        let activeLocalJobs = localJobs.filter((j) => !deletedIds.includes(j.id));
        let activeServerJobs = serverJobs.filter((j: Job) => !deletedIds.includes(j.id));

        // Merge active records
        const mergedActiveMap = new Map<string, Job>();
        activeLocalJobs.forEach((j) => mergedActiveMap.set(j.id, j));
        activeServerJobs.forEach((j: Job) => {
          const existing = mergedActiveMap.get(j.id);
          if (!existing || j.status !== "captured" || existing.status === "captured") {
            mergedActiveMap.set(j.id, j);
          }
        });
        const mergedActiveList = Array.from(mergedActiveMap.values());

        // Deleted items
        let deletedLocalJobs = localJobs.filter((j) => deletedIds.includes(j.id));
        const mergedDeletedMap = new Map<string, Job>();
        deletedLocalJobs.forEach((j) => mergedDeletedMap.set(j.id, j));
        serverDeleted.forEach((j: Job) => mergedDeletedMap.set(j.id, j));
        const mergedDeletedList = Array.from(mergedDeletedMap.values());

        // Heal the server database: upload any active jobs the server lost because of container resets
        const serverIds = new Map<string, Job>(activeServerJobs.map((j: Job) => [j.id, j] as [string, Job]));
        activeLocalJobs.forEach(async (lj) => {
          const matchedServer = serverIds.get(lj.id);
          if (!matchedServer || (lj.status !== "captured" && matchedServer.status === "captured")) {
            try {
              await fetch("/api/jobs/scrape", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...lj,
                  date: lj.dateCaptured
                }),
              });
            } catch (err) {
              console.warn("Could not sync job back to ephemeral server filesystem:", err);
            }
          }
        });

        setJobs(mergedActiveList);
        setDeletedJobs(mergedDeletedList);
        setSelectedJob((prev) => {
          if (!prev) return prev;
          return mergedActiveList.find((job) => job.id === prev.id) || mergedDeletedList.find((job) => job.id === prev.id) || prev;
        });

        // Keep cache pool of all profiles (active + deleted)
        const combinedPool = [...mergedActiveList, ...mergedDeletedList];
        localStorage.setItem("jobflow_jobs", JSON.stringify(combinedPool));
      }
    } catch (err) {
      console.error("Error communicating with workspace backend API endpoints:", err);
    }
  };

  const handleAddManualJob = async (jobData: { title: string; company: string; url: string; description: string }) => {
    try {
      const resp = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobData),
      });
      if (resp.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to add manual job:", err);
    }
  };

  const handleDeleteJob = async (id: string) => {
    try {
      // Add deleted job ID to local tombstones list
      let deletedIds: string[] = [];
      try {
        const savedDeleted = localStorage.getItem("jobflow_deleted_jobs");
        deletedIds = savedDeleted ? JSON.parse(savedDeleted) : [];
      } catch {}
      if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        localStorage.setItem("jobflow_deleted_jobs", JSON.stringify(deletedIds));
      }

      // Soft delete on the backend server
      const resp = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (resp.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to delete job index:", err);
    }
  };

  const handleRestoreJob = async (id: string) => {
    try {
      // Remove from local tombstone list
      let deletedIds: string[] = [];
      try {
        const savedDeleted = localStorage.getItem("jobflow_deleted_jobs");
        deletedIds = savedDeleted ? JSON.parse(savedDeleted) : [];
      } catch {}
      const updatedDeleted = deletedIds.filter((d) => d !== id);
      localStorage.setItem("jobflow_deleted_jobs", JSON.stringify(updatedDeleted));

      // Restore on database server
      const resp = await fetch(`/api/jobs/${id}/restore`, { method: "POST" });
      if (resp.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to restore job profile:", err);
    }
  };

  const handleUpdateJobStatus = async (jobId: string, status: Job["status"]) => {
    try {
      const resp = await fetch(`/api/jobs/${jobId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (resp.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed updating status code parameters:", err);
    }
  };

  const handleSimulateEmail = async (
    jobId: string,
    type: "interview" | "rejection" | "received" | "update",
    options?: { subject: string; body: string; sender: string }
  ) => {
    try {
      const resp = await fetch(`/api/jobs/${jobId}/simulate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          subject: options?.subject,
          body: options?.body,
          sender: options?.sender,
        }),
      });
      if (resp.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed generating simulated message thread:", err);
    }
  };

  const handleMarkEmailSeen = async (emailId: string) => {
    try {
      const resp = await fetch(`/api/emails/${emailId}/read`, { method: "POST" });
      if (resp.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed flagging email seen status parameters:", err);
    }
  };

  const handleClearAlert = async (jobId: string) => {
    try {
      const resp = await fetch(`/api/jobs/${jobId}/clear-alert`, { method: "POST" });
      if (resp.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed to clear specific job indicators:", err);
    }
  };

  const handleUpdateProfile = async (updatedProfile: CandidateProfile) => {
    localStorage.setItem("jobflow_profile", JSON.stringify(updatedProfile));
    localStorage.setItem("jobflow_github_profile_url", updatedProfile.githubProfileUrl || "");
    localStorage.setItem("jobflow_github_profile_summary", updatedProfile.githubProfileSummary || "");
    setProfile(updatedProfile);

    try {
      const resp = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedProfile),
      });
      if (resp.ok) {
        const savedProfile = await resp.json();
        const mergedProfile = { ...savedProfile, ...updatedProfile };
        setProfile(mergedProfile);
        localStorage.setItem("jobflow_profile", JSON.stringify(mergedProfile));
      }
    } catch (err) {
      console.error("Failed committing candidate credentials details:", err);
    }
  };

  const handleClearLogs = async () => {
    try {
      const resp = await fetch("/api/logs/clear", { method: "POST" });
      if (resp.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Failed clearing logs:", err);
    }
  };

  const handleResetPipeline = async () => {
    try {
      localStorage.removeItem("jobflow_jobs");
      localStorage.removeItem("jobflow_deleted_jobs");
      localStorage.removeItem("jobflow_hidden_email_ids");
      setJobs([]);
      await fetch("/api/jobs/reset", { method: "POST" });
      await fetchData();
    } catch (err) {
      console.error("Failed resetting pipeline database configurations:", err);
    }
  };

  const handleOpenTailor = (job: Job) => {
    setSelectedJob(job);
    setActiveTab("tailor");
  };

  const handleOpenManualReview = (job: Job) => {
    setSelectedJob(job);
    setShowReviewModal(true);
  };

  const handleTailoringComplete = (updatedJob?: Job) => {
    if (updatedJob) {
      setSelectedJob(updatedJob);
      setJobs((prev) => {
        const next = prev.some((job) => job.id === updatedJob.id)
          ? prev.map((job) => job.id === updatedJob.id ? updatedJob : job)
          : [updatedJob, ...prev];

        try {
          const cached = localStorage.getItem("jobflow_jobs");
          const cachedJobs: Job[] = cached ? JSON.parse(cached) : [];
          const nextCached = cachedJobs.some((job) => job.id === updatedJob.id)
            ? cachedJobs.map((job) => job.id === updatedJob.id ? updatedJob : job)
            : [updatedJob, ...cachedJobs];
          localStorage.setItem("jobflow_jobs", JSON.stringify(nextCached));
        } catch {
          localStorage.setItem("jobflow_jobs", JSON.stringify(next));
        }

        return next;
      });
    }

    fetchData();
  };

  const handleSubmissionCompleted = (jobId: string) => {
    handleUpdateJobStatus(jobId, "submitted");
    setShowReviewModal(false);
  };

  const unreadEmails = emails.filter((e) => !e.isRead);
  const unreadCount = unreadEmails.length;

  return (
    <div className={`faction-${faction} flex flex-col h-screen w-full bg-faction-bg font-sans text-faction-text overflow-hidden`} id="jobflow-master-container">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-faction-panel border-b border-faction-border backdrop-blur-md shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-faction-primary text-white rounded-md flex items-center justify-center font-extrabold text-xs hover:rotate-12 transition-transform shadow-md border border-faction-accent-border/40">
            JF
          </div>
          <h1 className="text-sm font-black tracking-wider text-faction-text flex items-center gap-1.5">
            JobFlow <span className="text-blue-700 font-bold uppercase text-[9px] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">Career Console</span>
          </h1>
        </div>

        <div className="flex items-center gap-6">
          {/* Theme switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-[9px]">
            <button
              type="button"
              onClick={() => handleToggleFaction("alliance")}
              className={`px-2 py-0.5 rounded font-black flex items-center gap-1 cursor-pointer transition-all ${
                faction === "alliance"
                  ? "bg-blue-600 text-white border border-blue-700/20 shadow"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
              title="Use the standard blue, black, and white workspace theme"
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => handleToggleFaction("horde")}
              className={`px-2 py-0.5 rounded font-black flex items-center gap-1 cursor-pointer transition-all ${
                faction === "horde"
                  ? "bg-slate-900 text-white border border-slate-700 shadow"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
              title="Use the high contrast black, white, and blue workspace theme"
            >
              Contrast
            </button>
          </div>

          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded border border-emerald-200 shadow-xs">
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-semibold text-emerald-700">Sync online (Indeed / LinkedIn)</span>
          </div>
          <div className="w-7 h-7 rounded bg-white border border-slate-200 text-slate-900 flex items-center justify-center font-bold text-xs shadow-sm" title={profile.name}>
            {(() => {
              if (!profile.name) return "?";
              const parts = profile.name.trim().split(/\s+/);
              if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
              return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            })()}
          </div>
        </div>
      </header>

      {/* Main View Grid container */}
      <main className="flex flex-1 overflow-hidden p-3 gap-3 bg-faction-bg">
        {/* Main Sidebar Navigation layout */}
        <nav className="w-48 flex flex-col gap-1 shrink-0 bg-faction-panel border border-faction-border p-2 rounded-xl shadow-sm" id="sidebar-nav">
          <div className="text-[9px] font-black text-faction-text-muted uppercase tracking-widest px-2 py-1">Navigator</div>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2.5 px-3 py-2 rounded font-mono font-bold text-xs text-left cursor-pointer transition-all border ${
              activeTab === "dashboard"
                ? "bg-blue-50 text-blue-900 border-blue-200 shadow-sm"
                : "border-transparent text-faction-text-muted hover:bg-faction-panel-header/80 hover:text-faction-text"
            }`}
          >
            <span>📋 Pipeline Desk</span>
          </button>

          <button
            onClick={() => setActiveTab("gemini")}
            className={`flex items-center gap-2.5 px-3 py-2 rounded font-mono font-bold text-xs text-left cursor-pointer transition-all border ${
              activeTab === "gemini"
                ? "bg-blue-50 text-blue-900 border-blue-200 shadow-sm"
                : "border-transparent text-faction-text-muted hover:bg-faction-panel-header/80 hover:text-faction-text"
            }`}
          >
            <span>🤖 AI Operations</span>
          </button>

          <button
            onClick={() => setActiveTab("tailor")}
            className={`flex items-center gap-2.5 px-3 py-2 rounded font-mono font-bold text-xs text-left cursor-pointer transition-all border ${
              activeTab === "tailor"
                ? "bg-blue-50 text-blue-900 border-blue-200 shadow-sm"
                : "border-transparent text-faction-text-muted hover:bg-faction-panel-header/80 hover:text-faction-text"
            }`}
          >
            <span>✨ Resume Editor</span>
          </button>

          <button
            onClick={() => setActiveTab("emails")}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded font-mono font-bold text-xs text-left cursor-pointer transition-all border ${
              activeTab === "emails"
                ? "bg-blue-50 text-blue-900 border-blue-200 shadow-sm"
                : "border-transparent text-faction-text-muted hover:bg-faction-panel-header/80 hover:text-faction-text"
            }`}
          >
            <span className="flex items-center gap-2">📥 Email Monitor</span>
            {unreadCount > 0 && (
              <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 leading-none">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("extension")}
            className={`flex items-center gap-2.5 px-3 py-2 rounded font-mono font-bold text-xs text-left cursor-pointer transition-all border ${
              activeTab === "extension"
                ? "bg-blue-50 text-blue-900 border-blue-200 shadow-sm"
                : "border-transparent text-faction-text-muted hover:bg-faction-panel-header/80 hover:text-faction-text"
            }`}
          >
            <span>🔌 Extension Port</span>
          </button>

          <button
            onClick={() => setActiveTab("config")}
            className={`flex items-center gap-2.5 px-3 py-2 rounded font-mono font-bold text-xs text-left cursor-pointer transition-all border ${
              activeTab === "config"
                ? "bg-blue-50 text-blue-900 border-blue-200 shadow-sm"
                : "border-transparent text-faction-text-muted hover:bg-faction-panel-header/80 hover:text-faction-text"
            }`}
          >
            <span>⚙️ Configuration</span>
          </button>

          <button
            onClick={() => setActiveTab("export")}
            className={`flex items-center gap-2.5 px-3 py-2 rounded font-mono font-bold text-xs text-left cursor-pointer transition-all border ${
              activeTab === "export"
                ? "bg-blue-50 text-blue-900 border-blue-200 shadow-sm"
                : "border-transparent text-faction-text-muted hover:bg-faction-panel-header/80 hover:text-faction-text"
            }`}
          >
            <span>📁 GitHub Sync</span>
          </button>

          <div className="mt-auto p-2.5 bg-slate-50 border border-faction-border rounded-lg">
            <p className="text-[9px] uppercase font-bold text-faction-text-muted mb-1">AI Linker State</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] text-faction-text font-bold">Port 3000 Active</span>
            </div>
          </div>
        </nav>

        {/* Dynamic Inner Panel Switching */}
        {activeTab === "dashboard" && (
          <Dashboard
            jobs={jobs}
            deletedJobs={deletedJobs}
            onRestoreJob={handleRestoreJob}
            onOpenTailor={handleOpenTailor}
            onOpenManualReview={handleOpenManualReview}
            onDeleteJob={handleDeleteJob}
            onAddManualJob={handleAddManualJob}
            logs={logs}
            onClearLogs={handleClearLogs}
            onUpdateJobStatus={handleUpdateJobStatus}
            onResetPipeline={handleResetPipeline}
          />
        )}

        {activeTab === "gemini" && (
          <AIConsole
            logs={logs}
            onClearLogs={handleClearLogs}
          />
        )}

        {activeTab === "tailor" && (
          <ResumeTailor
            selectedJob={selectedJob}
            jobs={jobs}
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            onTailoringComplete={handleTailoringComplete}
            onStatusUpdate={handleUpdateJobStatus}
          />
        )}

        {activeTab === "emails" && (
          <EmailMonitor
            jobs={jobs}
            onUpdateJobStatus={handleUpdateJobStatus}
            emails={gmailEmails}
            isLoadingEmails={isLoadingEmails}
            emailError={emailError}
            needsAuth={needsAuth}
            isLoggingIn={isLoggingIn}
            token={token}
            user={user}
            isDemoMode={isDemoMode}
            onStartDemoMode={handleStartDemoMode}
            onLogin={handleLogin}
            onLogout={handleLogout}
            onDeleteEmail={handleDeleteEmail}
            onRefreshEmails={handleRefreshEmails}
            selectedCompanyJob={selectedCompanyJob}
            onSelectCompanyJob={setSelectedCompanyJob}
            isSyncActive={isSyncActive}
            onToggleSync={handleToggleSync}
          />
        )}

        {activeTab === "extension" && <ExtensionPanel />}

        {activeTab === "config" && (
          <Configuration profile={profile} onUpdateProfile={handleUpdateProfile} onResetPipeline={handleResetPipeline} />
        )}

        {activeTab === "export" && <ProjectExport profile={profile} onUpdateProfile={handleUpdateProfile} />}

        {/* Right Sidebar Notification Alert System Panel when active on dashboard/emails */}
        {(activeTab === "dashboard" || activeTab === "emails") && (() => {
          const visibleFilingEvents = filingEvents.filter(e => e.type === "error" || e.type === "filed" || !hiddenEmailIds.includes(e.emailId));
          return (
            <aside className="w-64 bg-faction-panel border-l border-faction-border flex flex-col shrink-0 overflow-hidden shadow-xl" id="live-aside-response-tracker">
              <div className="p-3 border-b border-faction-border bg-faction-panel-header/80 flex items-center justify-between shrink-0">
                <h2 className="text-[10px] font-bold uppercase font-mono tracking-widest text-faction-text flex items-center justify-between w-full">
                  <span>RESPONSE TRACKER</span>
                  <span className="bg-faction-primary/20 text-faction-accent border border-faction-border text-[8px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase font-mono">FILING LOOP</span>
                </h2>
              </div>

              {/* Subfolders/Directories Section */}
              <div className="p-3 bg-black/20 border-b border-faction-border flex flex-col gap-1.5 shrink-0 max-h-48 overflow-y-auto font-mono">
                <div className="flex items-center justify-between text-[9px] font-bold text-faction-text-muted uppercase tracking-widest leading-none">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#3b82f6] shrink-0" />
                    <span>SUBCATEGORIES ({jobs.filter((j) => !closedSubcategories[j.id]).length}/{jobs.length})</span>
                  </div>
                  {Object.keys(closedSubcategories).length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setClosedSubcategories({});
                        localStorage.removeItem("jobflow_closed_subcategories");
                      }}
                      className="text-[8px] text-faction-accent hover:underline normal-case font-bold cursor-pointer transition-colors"
                      title="Reveal all hidden subcategory directories"
                    >
                      RESET
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {jobs.filter((j) => !closedSubcategories[j.id]).map((j) => {
                    const trackingFilterKey = `${j.company}-${j.title}`;
                    return (
                      <div
                        key={j.id}
                        className="group relative flex items-center gap-1 bg-faction-bg border border-faction-border rounded hover:border-faction-accent-border/40 hover:bg-black/30 transition-all text-left"
                      >
                        <button
                          onClick={() => {
                            setSelectedCompanyJob(trackingFilterKey);
                            setActiveTab("emails");
                          }}
                          className="flex-1 flex items-center justify-between p-1.5 text-[10px] font-bold text-faction-text cursor-pointer text-left truncate"
                          title="Click to view parsed matched emails in Tracking Hub"
                        >
                          <span className="truncate max-w-[110px]">
                            📂 {j.company}
                          </span>
                          <span className="text-[7.5px] bg-emerald-950/50 text-emerald-400 border border-emerald-500/20 px-1 rounded uppercase font-bold tracking-wider shrink-0 select-none mr-1">
                            ACTIVE
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleCloseSubcategory(e, j)}
                          className="p-1 text-faction-text-muted hover:text-rose-450 rounded cursor-pointer mr-1 shrink-0 transition-colors"
                          title="Clear from view"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                  {jobs.length === 0 && (
                    <div className="text-[9px] text-faction-text-muted/65 italic text-center py-2 bg-black/15 border border-dashed rounded border-faction-border">
                      No active directories.
                    </div>
                  )}
                  {jobs.length > 0 && jobs.filter((j) => !closedSubcategories[j.id]).length === 0 && (
                    <div className="text-[9px] text-faction-text-muted/65 italic text-center py-2 bg-black/15 border border-dashed rounded border-faction-border">
                      All subcategories cleared.
                    </div>
                  )}
                </div>
              </div>

              {/* Sliding Tabs: Filing Feed vs Trash Bin */}
              <div className="flex border-b border-faction-border bg-faction-panel-header text-[9px] font-mono shrink-0 font-bold">
                <button
                  onClick={() => setAsideTab("feed")}
                  className={`flex-1 py-1.5 text-center cursor-pointer border-b-2 transition-all ${asideTab === "feed" ? "border-faction-accent text-faction-accent font-bold bg-black/20" : "border-transparent text-faction-text-muted hover:text-faction-text hover:bg-black/10"}`}
                >
                  FEED ({visibleFilingEvents.length})
                </button>
                <button
                  onClick={() => setAsideTab("trash")}
                  className={`flex-1 py-1.5 text-center cursor-pointer border-b-2 transition-all ${asideTab === "trash" ? "border-faction-accent text-faction-accent font-bold bg-black/20" : "border-transparent text-faction-text-muted hover:text-faction-text hover:bg-black/10"}`}
                >
                  TRASH ({getTrashedEmails().length})
                </button>
              </div>

              {/* Tab Content Panels */}
              {asideTab === "feed" ? (
                /* Live Event Activity Feed section */
                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50 scrollbar-thin scrollbar-thumb-faction-border" id="aside-scroller">
                  {visibleFilingEvents.length > 0 ? (
                    visibleFilingEvents.map((event) => {
                      const gmailLink = `https://mail.google.com/mail/u/0/#inbox/${event.threadId || event.emailId}`;

                      if (event.type === "error") {
                        return (
                          <div key={event.id} className="p-2.5 border-l-4 border-rose-500 bg-white rounded-lg border border-rose-200 flex flex-col gap-1 shadow-sm" id={`aside-notif-${event.id}`}>
                            <div className="flex justify-between items-center text-[8px] font-bold uppercase text-rose-700">
                              <span className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-500" /> FILE ERROR
                              </span>
                              <span>FAIL</span>
                            </div>
                            <p className="text-[10.5px] font-bold text-rose-800 mt-0.5 leading-snug">{event.desc}</p>
                            <p className="text-[9.5px] text-rose-600 leading-tight">
                              Verify security setup or status checks in Email Monitor.
                            </p>
                          </div>
                        );
                      }

                      if (event.type === "unmatched") {
                        return (
                          <div key={event.id} className="p-2.5 border-l-4 border-slate-300 bg-white rounded-lg border border-slate-200 flex flex-col gap-1 shadow-sm" id={`aside-notif-${event.id}`}>
                            <div className="flex justify-between items-center text-[8px] font-bold uppercase text-slate-500">
                              <span className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-slate-500" /> Unmatched Mail
                              </span>
                              <span>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-900 leading-snug truncate">
                              From: {event.fromName}
                            </p>
                            <p className="text-[9px] text-slate-600 italic truncate leading-tight">
                              "{event.subject}"
                            </p>
                            <p className="text-[8.5px] text-slate-600 bg-slate-50 px-1 py-0.5 rounded leading-tight border border-slate-200">
                              No company directory match detected.
                            </p>
                            <div className="flex justify-between items-center mt-1.5 pt-1 border-t border-slate-200 text-[8.5px] font-bold uppercase">
                              <a
                                href={gmailLink}
                                target="_blank"
                                referrerPolicy="no-referrer"
                                className="text-blue-700 hover:underline cursor-pointer flex items-center gap-0.5 font-bold"
                              >
                                Open Gmail <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              <button
                                onClick={() => handleDeleteEmail(event.emailId)}
                                className="text-slate-500 hover:text-slate-900 cursor-pointer"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // Default: Success match
                      return (
                        <div key={event.id} className="p-2.5 border-l-4 border-emerald-500 bg-faction-panel rounded border border-faction-border flex flex-col gap-1 shadow-md" id={`aside-notif-${event.id}`}>
                          <div className="flex justify-between items-center text-[8.5px] font-black uppercase text-emerald-400 font-mono">
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-400" /> FILING OCCURRED
                            </span>
                            <span>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-[10.5px] font-bold text-faction-text leading-snug">
                            Filed to 📂 {event.company}
                          </p>
                          <p className="text-[9.5px] text-faction-text-muted italic truncate leading-tight mt-0.5">
                            "{event.subject}"
                          </p>
                          <p className="text-[9.5px] text-faction-text-muted/80 font-medium">
                            Sender: {event.fromName}
                          </p>
                          <div className="flex justify-between items-center mt-2.5 pt-1 border-t border-faction-border text-[8.5px] font-bold uppercase font-mono">
                            <a
                              href={gmailLink}
                              target="_blank"
                              referrerPolicy="no-referrer"
                              className="text-faction-accent hover:underline cursor-pointer flex items-center gap-0.5 font-bold"
                            >
                              Open Gmail <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                            <button
                              onClick={() => handleDeleteEmail(event.emailId)}
                              className="text-faction-text-muted hover:text-rose-400 cursor-pointer font-bold"
                            >
                              Archive
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-faction-text-muted h-full">
                      <Bell className="w-8 h-8 text-faction-border mb-2" />
                      <p className="text-[10.5px] font-bold text-faction-text-muted font-mono">Pipeline Stream Clear</p>
                      <p className="text-[9.5px] text-faction-text-muted/70 max-w-[170px] mt-0.5 leading-normal font-mono">
                        Waiting for active emails to poll and parse on registered folders.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Trash Bin section with search box (as requested) */
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 bg-black/10" id="aside-trash-scroller">
                  <div className="px-1 py-1 shrink-0">
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-faction-text-muted select-none mb-1.5 font-mono">Search Trash By Name</p>
                    <input
                      type="text"
                      className="w-full bg-faction-bg border border-faction-border rounded px-2.5 py-1.5 text-[11px] outline-none text-faction-text placeholder-faction-text-muted/50 focus:border-faction-accent transition-colors font-mono"
                      placeholder="Search name or company..."
                      value={trashSearch}
                      onChange={(e) => setTrashSearch(e.target.value)}
                    />
                  </div>

                  {getTrashedEmails().length > 0 ? (
                    getTrashedEmails().map((email) => {
                      const gmailLink = `https://mail.google.com/mail/u/0/#inbox/${email.threadId || email.id}`;
                      return (
                        <div key={email.id} className="p-2.5 bg-faction-panel rounded border border-faction-border flex flex-col gap-1 shadow-md">
                          <div className="flex justify-between items-center text-[8px] font-black uppercase font-mono">
                            <span className="text-rose-450 font-bold">🗑️ Trashed</span>
                            <span className="text-faction-text-muted">{new Date(email.date).toLocaleDateString([], { month: '2-digit', day: '2-digit' })}</span>
                          </div>

                          <p className="text-[10.5px] font-bold text-faction-text mt-0.5 leading-snug truncate font-mono">
                            {email.matchedCompany === "Unassigned Feed" ? "Unassigned Feed" : `📂 ${email.matchedCompany}`}
                          </p>
                          <p className="text-[10px] text-faction-text-muted font-mono truncate">
                            Sender: {email.fromName}
                          </p>
                          <p className="text-[9px] text-faction-text-muted italic truncate leading-tight font-mono">
                            "{email.subject}"
                          </p>

                          <div className="flex justify-between items-center mt-2 pt-1 border-t border-faction-border text-[8.5px] font-bold uppercase font-mono">
                            <a
                              href={gmailLink}
                              target="_blank"
                              referrerPolicy="no-referrer"
                              className="text-faction-accent hover:underline cursor-pointer flex items-center gap-0.5"
                            >
                              View <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                            <button
                              onClick={() => handleRestoreFromTrash(email.id)}
                              className="text-emerald-400 hover:text-emerald-350 cursor-pointer font-bold"
                            >
                              Restore
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-faction-text-muted h-full">
                      <Trash2 className="w-8 h-8 text-faction-border mb-2" />
                      <p className="text-[10px] font-bold text-faction-text-muted font-mono">Trash Bin Empty</p>
                      <p className="text-[9px] text-faction-text-muted/70 max-w-[170px] mt-0.5 leading-normal font-mono">
                        No locally hidden messages matching search filters.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 bg-faction-panel-header/40 border-t border-faction-border shrink-0">
                <div className="flex justify-between items-center mb-1 font-mono">
                  <span className="text-[10px] text-faction-text-muted font-bold">Workspace Feed</span>
                  <span className="text-[10px] font-bold text-emerald-400">Healthy</span>
                </div>
                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[100%]"></div>
                </div>
              </div>
            </aside>
          );
        })()}
      </main>

      {/* Manual review submission form modal */}
      {showReviewModal && selectedJob && (
        <ManualReviewModal
          job={selectedJob}
          profile={profile}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedJob(null);
          }}
          onSubmitCompleted={handleSubmissionCompleted}
        />
      )}

      {/* Footer Status Bar matching High Density layout specs perfectly */}
      <footer className="px-4 py-1.5 bg-faction-panel-header border-t border-faction-border text-faction-text-muted flex items-center justify-between shrink-0 text-[10px] font-mono">
        <div className="flex gap-4">
          <span>
            ● LinkedIn Scraper: <span className="text-green-400 font-bold uppercase">Idle</span>
          </span>
          <span>
            ● Indeed Scraper Client: <span className="text-faction-accent font-bold uppercase underline">Scanning...</span>
          </span>
        </div>
        <div className="italic text-[9px]">Secure End-to-End Workflow • Version 1.0.4-stable</div>
      </footer>
    </div>
  );
}
