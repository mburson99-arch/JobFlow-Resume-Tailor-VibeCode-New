import React, { useState, useEffect, useMemo } from "react";
import { Job, CandidateProfile, EmailAlert, LogMessage } from "./types";
import { Briefcase, Layers, Sparkles, Mail, Settings, Chrome, Terminal, AlertTriangle, CheckCircle, ChevronRight, HelpCircle, Bell, ExternalLink, Trash2, X } from "lucide-react";
import Dashboard from "./components/Dashboard";
import ResumeTailor from "./components/ResumeTailor";
import EmailMonitor from "./components/EmailMonitor";
import ExtensionPanel from "./components/ExtensionPanel";
import Configuration from "./components/Configuration";
import ManualReviewModal from "./components/ManualReviewModal";
import AIConsole from "./components/AIConsole";
import {
  initAuth,
  googleSignIn,
  logout,
  GoogleUser,
  GOOGLE_OAUTH_CREDENTIALS_URL,
  GOOGLE_GMAIL_API_URL,
} from "./lib/googleAuth";
import { matchEmailToJob } from "./lib/emailMatcher";
import {
  buildJobFlowInboxQuery,
  syncMatchedEmailsToJobFlowLabel,
  JOBFLOW_GMAIL_LABEL_NAME,
} from "./lib/gmailLabels";
import { decodeEmailBody, headerValue, isRecentJobEmail, mapDemoEmail, ParsedEmail } from "./lib/gmailMessages";
import { readLocalStorage, useLocalStorageState } from "./hooks/useLocalStorageState";

import ProjectExport from "./components/ProjectExport";

export default function App() {
  useEffect(() => {
    // Google OAuth web clients only accept configured JavaScript origins. Normalize local usage to localhost.
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    if (!isLocalHost) {
      const next = `http://localhost:${window.location.port || "3000"}${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.replace(next);
    }
  }, []);

  const [faction, setFaction] = useLocalStorageState<"alliance" | "horde">("jobflow_faction_theme", "alliance");

  const handleToggleFaction = (nextFaction: "alliance" | "horde") => {
    setFaction(nextFaction);
  };

  const [activeTab, setActiveTab] = useLocalStorageState<"dashboard" | "tailor" | "emails" | "extension" | "config" | "export" | "gemini">("jobflow_active_tab", "dashboard");
  const [jobs, setJobs, clearCachedJobs] = useLocalStorageState<Job[]>("jobflow_jobs", []);
  const [deletedJobs, setDeletedJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<CandidateProfile>({
    name: "Michael Burson",
    email: "mburson99@gmail.com",
    phone: "740.755.0345",
    website: "https://github.com/mburson99-arch",
    resumeText: "",
  });
  const [emails, setEmails] = useState<EmailAlert[]>([]);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Hoisted Gmail/Auth States
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isDemoMode, setIsDemoMode, clearDemoMode] = useLocalStorageState<boolean>("jobflow_is_demo_mode", false);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [gmailEmails, setGmailEmails] = useState<ParsedEmail[]>([]);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Persistent email deletion state ("delete from sight")
  const [hiddenEmailIds, setHiddenEmailIds, clearHiddenEmailIds] = useLocalStorageState<string[]>("jobflow_hidden_email_ids", []);

  // Hoisted state from Tracking Hub to enable direct deep-link filter paths
  const [selectedCompanyJob, setSelectedCompanyJob] = useState<string | null>("all");

  // Toggle to stagnate/stay (Observer Mode) vs Active sync and auto-trash (Fetch and delete mode)
  const [isSyncActive, setIsSyncActive] = useLocalStorageState<boolean>("jobflow_sync_active", true);

  const handleToggleSync = () => {
    setIsSyncActive((prev) => {
      const nextVal = !prev;
      return nextVal;
    });
  };

  // Keep track of when unmatched/uncategorized emails are first seen in this workspace
  const [firstSeenUncategorized, setFirstSeenUncategorized] = useLocalStorageState<Record<string, number>>("jobflow_uncat_first_seen", {});

  // Search input query inside the sidebar Trash Bin
  const [trashSearch, setTrashSearch] = useState("");

  // Response tracker panel tab state: "feed" (Live Filing Feed) vs "trash" (Trash Bin)
  const [asideTab, setAsideTab] = useState<"feed" | "trash">("feed");

  // Local active persistent state for closed subcategories and their last known snapshot data
  const [closedSubcategories, setClosedSubcategories] = useLocalStorageState<Record<string, string>>("jobflow_closed_subcategories", {});

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
    }
  }, [jobs, closedSubcategories]);

  // Gmail live fetch
  const fetchLiveEmails = async (accessToken: string) => {
    setIsLoadingEmails(true);
    setEmailError(null);
    try {
      const inboxQuery = encodeURIComponent(buildJobFlowInboxQuery());
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${inboxQuery}&maxResults=100`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          const promises = data.messages.map(async (msg: any) => {
            try {
              const mRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });
              if (mRes.ok) {
                const mData = await mRes.json();
                const headers = mData.payload.headers;
                
                return {
                  id: mData.id,
                  threadId: mData.threadId,
                  snippet: mData.snippet,
                  subject: headerValue(headers, "subject", "No Subject"),
                  from: headerValue(headers, "from", "Unknown Sender"),
                  date: headerValue(headers, "date", ""),
                  bodyText: decodeEmailBody(mData.payload),
                } as ParsedEmail;
              }
            } catch (err) {
              console.error(`Error resolving email metadata for ${msg.id}:`, err);
            }
            return null;
          });

          const resolved = await Promise.all(promises);
          const parsed = resolved.filter((e): e is ParsedEmail => e !== null);
          
          // Strict Date Filter: Only pull data on or after May 20, 2026.
          const filtered = parsed.filter(isRecentJobEmail);

          setGmailEmails(filtered);
          setEmailError(null);

          if (jobs.length > 0) {
            syncMatchedEmailsToJobFlowLabel(accessToken, filtered, jobs).catch((err) => {
              console.warn("[JobFlow] Gmail label sync:", err);
            });
          }
        } else {
          setGmailEmails([]);
        }
      } else {
        if (res.status === 401 || res.status === 403) {
          setEmailError("Filing Exception: Live Google Workspace session expired. Please re-sign in.");
        } else {
          setEmailError(`Filing Exception: Google API server responded with error status ${res.status}`);
        }
      }
    } catch (err: any) {
      console.error("Error fetching live emails", err);
      setEmailError(`Filing Exception: Failed to connect to Gmail inbox (${err.message || "Network Error"})`);
    } finally {
      setIsLoadingEmails(false);
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
        const mapped = data.map(mapDemoEmail);

        // Strict Date Filter: Only pull data on or after May 20, 2026.
        const filtered = mapped.filter(isRecentJobEmail);

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

  // Auth Hook
  useEffect(() => {
    const unsub = initAuth(
      (u, t) => {
        setUser(u);
        setToken(t);
        setNeedsAuth(false);
        setIsDemoMode(false);
        fetchLiveEmails(t);
      },
      () => {
        setUser(null);
        setToken(null);
        if (!isDemoMode) {
          setNeedsAuth(true);
        }
      }
    );
    return () => unsub();
  }, [isDemoMode]);

  // Periodic Email sync loop
  useEffect(() => {
    if (!isSyncActive) return; // Freeze polling / "stagnat and stay" representation
    if (isDemoMode) {
      fetchDemoEmails();
      const interval = setInterval(fetchDemoEmails, 8000);
      return () => clearInterval(interval);
    } else if (token) {
      fetchLiveEmails(token);
      const interval = setInterval(() => fetchLiveEmails(token), 8000);
      return () => clearInterval(interval);
    }
  }, [isDemoMode, token, isSyncActive]);

  // If jobs load after the first inbox pull, file any matches into the Gmail label.
  useEffect(() => {
    if (isDemoMode || !token || gmailEmails.length === 0 || jobs.length === 0) return;
    syncMatchedEmailsToJobFlowLabel(token, gmailEmails, jobs).catch((err) => {
      console.warn("[JobFlow] Gmail label sync:", err);
    });
  }, [jobs.length, token, isDemoMode]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setEmailError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
        setIsDemoMode(false);
        fetchLiveEmails(result.accessToken);
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      const message = err?.message || String(err);
      if (message.includes("GOOGLE_CLIENT_ID")) {
        setEmailError(
          "Auth Error: Google login failed (missing GOOGLE_CLIENT_ID). Add your OAuth Web Client ID to .env, then restart the app."
        );
      } else if (message.toLowerCase().includes("access_denied") || message.toLowerCase().includes("test users")) {
        setEmailError(
          "Auth Error: Google blocked sign-in (403 access_denied). In Google Cloud: OAuth consent screen > Test users — add the exact Gmail you use to sign in. Then sign out of Google in the browser and try again."
        );
      } else if (message.toLowerCase().includes("origin") || message.toLowerCase().includes("redirect")) {
        setEmailError(
          "Auth Error: Google login failed (origin not allowed). In Google Cloud OAuth credentials, add http://localhost:3000 under Authorized JavaScript origins."
        );
      } else {
        setEmailError(`Auth Error: Google login failed (${message})`);
      }
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
    clearDemoMode();
  };

  const handleStartDemoMode = () => {
    setIsDemoMode(true);
    setNeedsAuth(false);
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

    if (isDemoMode) return;
    if (!token) return;
    try {
      fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/trash`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      console.error("Failed to trash email in live inbox background:", e);
    }
  };

  const handleRestoreFromTrash = (emailId: string) => {
    const newHidden = hiddenEmailIds.filter(id => id !== emailId);
    setHiddenEmailIds(newHidden);

    const newFirstSeen = { ...firstSeenUncategorized };
    if (newFirstSeen[emailId]) {
      // Refresh its seen timestamp to give user a fresh 45 second window
      newFirstSeen[emailId] = Date.now();
      setFirstSeenUncategorized(newFirstSeen);
    }
  };

  // Filing classifier logic to compile activity feed for Response Tracker
  const filingEvents = useMemo(() => {
    const events: any[] = [];
    if (emailError) {
      events.push({
        id: "err-auth",
        type: "error",
        desc: emailError,
        timestamp: new Date().toISOString(),
      });
    }

    gmailEmails.forEach((email) => {
      const match = matchEmailToJob(email, jobs);

      if (match) {
        events.push({
          id: `filed-${email.id}`,
          type: "filed",
          company: match.job.company,
          title: match.job.title,
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
  }, [emailError, gmailEmails, jobs]);

  const trashedEmails = useMemo(() => {
    return gmailEmails
      .filter(email => hiddenEmailIds.includes(email.id))
      .map(email => {
        const originalEvent = filingEvents.find(e => e.emailId === email.id);
        const isMatched = originalEvent?.type === "filed";

        return {
          id: email.id,
          threadId: email.threadId,
          fromName: email.from.split("<")[0].replace(/"/g, '').trim(),
          fromEmail: email.from,
          subject: email.subject,
          date: email.date,
          matchedCompany: isMatched ? originalEvent.company : "Unassigned Feed",
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
  }, [filingEvents, gmailEmails, hiddenEmailIds, trashSearch]);

  const getFilingEvents = () => filingEvents;
  const getTrashedEmails = () => trashedEmails;

  // Synchronously record "first seen" timestamps for any active, visible unmatched elements
  useEffect(() => {
    const uncatEvents = getFilingEvents().filter(e => e.type === "unmatched");
    const now = Date.now();
    let updated = false;
    const newFirstSeen = { ...firstSeenUncategorized };

    uncatEvents.forEach(e => {
      if (!newFirstSeen[e.emailId]) {
        newFirstSeen[e.emailId] = now;
        updated = true;
      }
    });

    if (updated) {
      setFirstSeenUncategorized(newFirstSeen);
    }
  }, [gmailEmails, jobs]);

  // Periodic clock ticks: Move unmatched emails to trash bin after 45 seconds of continuous sight
  useEffect(() => {
    if (!isSyncActive) return; // Halt auto-trash timers in Observer/Stagnant Mode
    const interval = setInterval(() => {
      const now = Date.now();
      let updated = false;
      const newHidden = [...hiddenEmailIds];

      Object.entries(firstSeenUncategorized).forEach(([id, seenTime]) => {
        // If 45 seconds have passed and it's not yet hidden
        if (now - seenTime >= 45000 && !newHidden.includes(id)) {
          // Verify that this email is still in our active list to avoid garbage values
          const exists = gmailEmails.some(email => email.id === id);
          if (exists) {
            newHidden.push(id);
            updated = true;
            console.log(`⏳ Auto-deleting uncategorized email ${id} after 45 seconds to Trash Bin.`);
          }
        }
      });

      if (updated) {
        setHiddenEmailIds(newHidden);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [firstSeenUncategorized, hiddenEmailIds, gmailEmails, isSyncActive]);

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
      const profileRes = await fetch("/api/profile");
      if (profileRes.ok) {
        const loadedProfile = await profileRes.json();
        setProfile(loadedProfile);
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
        const deletedIds = readLocalStorage<string[]>("jobflow_deleted_jobs", []);
        const localJobs = readLocalStorage<Job[]>("jobflow_jobs", []);

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
      const deletedIds = readLocalStorage<string[]>("jobflow_deleted_jobs", []);
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
      const deletedIds = readLocalStorage<string[]>("jobflow_deleted_jobs", []);
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
    try {
      const resp = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedProfile),
      });
      if (resp.ok) {
        setProfile(updatedProfile);
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
      clearCachedJobs();
      localStorage.removeItem("jobflow_deleted_jobs");
      clearHiddenEmailIds();
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

  const handleSubmissionCompleted = (jobId: string) => {
    handleUpdateJobStatus(jobId, "submitted");
    setShowReviewModal(false);
  };

  const unreadEmails = emails.filter((e) => !e.isRead);
  const unreadCount = unreadEmails.length;

  return (
    <div className={`faction-${faction} flex flex-col h-screen w-full bg-faction-bg font-sans text-faction-text overflow-hidden`} id="jobflow-master-container">
      {/* Top Header Bar strictly following High Density theme specs */}
      <header className="flex items-center justify-between px-6 py-2 bg-faction-panel-header border-b border-faction-border backdrop-blur-md shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-faction-primary text-faction-text rounded-md flex items-center justify-center font-extrabold text-xs font-mono hover:rotate-12 transition-transform shadow-md border border-faction-accent-border/40">
            JF
          </div>
          <h1 className="text-sm font-black tracking-wider text-faction-text flex items-center gap-1.5 font-mono">
            JOBFLOW <span className="text-faction-accent font-bold uppercase text-[9px] bg-black/30 px-1.5 py-0.5 rounded border border-faction-border">Console</span>
          </h1>
        </div>

        <div className="flex items-center gap-6">
          {/* Faction crest switcher */}
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-faction-border font-mono text-[9px]">
            <button
              type="button"
              onClick={() => handleToggleFaction("alliance")}
              className={`px-2 py-0.5 rounded font-black flex items-center gap-1 cursor-pointer transition-all ${
                faction === "alliance"
                  ? "bg-blue-600 text-white border border-yellow-400/40 shadow"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/20"
              }`}
              title="Pledge allegiance to the Alliance Command Center"
            >
              🛡️ Alliance
            </button>
            <button
              type="button"
              onClick={() => handleToggleFaction("horde")}
              className={`px-2 py-0.5 rounded font-black flex items-center gap-1 cursor-pointer transition-all ${
                faction === "horde"
                  ? "bg-red-700 text-white border border-red-500/40 shadow"
                  : "text-slate-400 hover:text-slate-205 hover:bg-slate-800/20"
              }`}
              title="Join the mighty Horde War Council"
            >
              🪓 Horde
            </button>
          </div>

          <div className="flex items-center gap-2 bg-emerald-950/40 px-3 py-1 rounded border border-emerald-500/20 shadow-xs">
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-mono font-semibold text-emerald-400">SYNC AGENT: ONLINE (Indeed / LinkedIn)</span>
          </div>
          <div className="w-7 h-7 rounded bg-faction-panel border border-faction-border text-faction-text flex items-center justify-center font-mono font-bold text-xs shadow-md" title={profile.name}>
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
        <nav className="w-48 flex flex-col gap-1 shrink-0 bg-faction-panel border border-faction-border p-2 rounded" id="sidebar-nav">
          <div className="text-[9px] font-black font-mono text-faction-text-muted uppercase tracking-widest px-2 py-1">NAVIGATOR</div>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2.5 px-3 py-2 rounded font-mono font-bold text-xs text-left cursor-pointer transition-all border ${
              activeTab === "dashboard"
                ? "bg-faction-primary text-faction-text border-faction-accent-border/40 shadow-md"
                : "border-transparent text-faction-text-muted hover:bg-faction-panel-header/80 hover:text-faction-text"
            }`}
          >
            <span>📋 Pipeline Desk</span>
          </button>

          <button
            onClick={() => setActiveTab("gemini")}
            className={`flex items-center gap-2.5 px-3 py-2 rounded font-mono font-bold text-xs text-left cursor-pointer transition-all border ${
              activeTab === "gemini"
                ? "bg-faction-primary text-faction-text border-faction-accent-border/40 shadow-md"
                : "border-transparent text-faction-text-muted hover:bg-faction-panel-header/80 hover:text-faction-text"
            }`}
          >
            <span>🤖 AI Operations</span>
          </button>

          <button
            onClick={() => setActiveTab("tailor")}
            className={`flex items-center gap-2.5 px-3 py-2 rounded font-mono font-bold text-xs text-left cursor-pointer transition-all border ${
              activeTab === "tailor"
                ? "bg-faction-primary text-faction-text border-faction-accent-border/40 shadow-md"
                : "border-transparent text-faction-text-muted hover:bg-faction-panel-header/80 hover:text-faction-text"
            }`}
          >
            <span>✨ Resume Editor</span>
          </button>

          <button
            onClick={() => setActiveTab("emails")}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded font-mono font-bold text-xs text-left cursor-pointer transition-all border ${
              activeTab === "emails"
                ? "bg-faction-primary text-faction-text border-faction-accent-border/40 shadow-md"
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
                ? "bg-faction-primary text-faction-text border-faction-accent-border/40 shadow-md"
                : "border-transparent text-faction-text-muted hover:bg-faction-panel-header/80 hover:text-faction-text"
            }`}
          >
            <span>🔌 Extension Port</span>
          </button>

          <button
            onClick={() => setActiveTab("config")}
            className={`flex items-center gap-2.5 px-3 py-2 rounded font-mono font-bold text-xs text-left cursor-pointer transition-all border ${
              activeTab === "config"
                ? "bg-faction-primary text-faction-text border-faction-accent-border/40 shadow-md"
                : "border-transparent text-faction-text-muted hover:bg-faction-panel-header/80 hover:text-faction-text"
            }`}
          >
            <span>⚙️ Configuration</span>
          </button>

          <button
            onClick={() => setActiveTab("export")}
            className={`flex items-center gap-2.5 px-3 py-2 rounded font-mono font-bold text-xs text-left cursor-pointer transition-all border ${
              activeTab === "export"
                ? "bg-faction-primary text-faction-text border-faction-accent-border/40 shadow-md"
                : "border-transparent text-faction-text-muted hover:bg-faction-panel-header/80 hover:text-faction-text"
            }`}
          >
            <span>📁 GitHub Sync</span>
          </button>

          <div className="mt-auto p-2.5 bg-black/25 border border-faction-border rounded">
            <p className="text-[9px] uppercase font-bold font-mono text-faction-text-muted mb-1">AI Linker State</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] text-faction-text font-mono font-bold">Port 3000 Active</span>
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
            onTailoringComplete={fetchData}
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
            hiddenEmailIds={hiddenEmailIds}
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

        {activeTab === "export" && <ProjectExport />}

        {/* Right Sidebar Notification Alert System Panel when active on dashboard/emails */}
        {(activeTab === "dashboard" || activeTab === "emails") && (() => {
          const filingEvents = getFilingEvents().filter(e => e.type === "error" || !hiddenEmailIds.includes(e.emailId));
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
                  FEED ({filingEvents.length})
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
                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-black/10 scrollbar-thin scrollbar-thumb-faction-border" id="aside-scroller">
                  {filingEvents.length > 0 ? (
                    filingEvents.map((event) => {
                      const gmailLink = `https://mail.google.com/mail/u/0/#inbox/${event.threadId || event.emailId}`;
                      
                      if (event.type === "error") {
                        const showOAuthHelp =
                          typeof event.desc === "string" &&
                          event.desc.toLowerCase().includes("google login");

                        return (
                          <div key={event.id} className="p-2.5 border-l-4 border-rose-500 bg-[#221215] rounded border border-rose-950/40 flex flex-col gap-1 shadow-sm" id={`aside-notif-${event.id}`}>
                            <div className="flex justify-between items-center text-[8px] font-bold uppercase font-mono text-rose-400">
                              <span className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-500" /> FILE ERROR
                              </span>
                              <span>FAIL</span>
                            </div>
                            <p className="text-[10.5px] font-bold text-rose-200 mt-0.5 leading-snug">{event.desc}</p>
                            <p className="text-[9.5px] text-rose-400/90 leading-tight">
                              Verify security setup or status checks in Email Monitor.
                            </p>
                            {showOAuthHelp && (
                              <div className="mt-1.5 flex flex-wrap gap-2">
                                <a
                                  href={GOOGLE_OAUTH_CREDENTIALS_URL}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[9px] px-2 py-1 rounded border border-rose-500/40 text-rose-200 hover:bg-rose-900/30 transition-colors"
                                >
                                  Open Google OAuth Credentials
                                </a>
                                <a
                                  href={GOOGLE_GMAIL_API_URL}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[9px] px-2 py-1 rounded border border-rose-500/40 text-rose-200 hover:bg-rose-900/30 transition-colors"
                                >
                                  Enable Gmail API
                                </a>
                                <span className="text-[9px] text-rose-300/85">
                                  Add `GOOGLE_CLIENT_ID` to `.env` and set JavaScript origin to `http://localhost:3000`.
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (event.type === "unmatched") {
                        return (
                          <div key={event.id} className="p-2.5 border-l-4 border-amber-500 bg-[#221c12] rounded border border-amber-950/40 flex flex-col gap-1 shadow-sm" id={`aside-notif-${event.id}`}>
                            <div className="flex justify-between items-center text-[8px] font-bold uppercase font-mono text-amber-400">
                              <span className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-500" /> UNMATCHED MAIL
                              </span>
                              <span>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-[10px] font-bold text-amber-100 leading-snug truncate">
                              From: {event.fromName}
                            </p>
                            <p className="text-[9px] text-slate-400 italic truncate leading-tight">
                              "{event.subject}"
                            </p>
                            <p className="text-[8.5px] text-amber-400/90 font-mono bg-[#16120c] px-1 py-0.5 rounded leading-tight border border-amber-950/20">
                              No company directory match detected.
                            </p>
                            <div className="flex justify-between items-center mt-1.5 pt-1 border-t border-[#3b2b16]/30 text-[8.5px] font-bold uppercase">
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
                                className="text-faction-text-muted hover:text-faction-text cursor-pointer"
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
                        No deleted or auto-trashed unmatched messages matching searching filters.
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
