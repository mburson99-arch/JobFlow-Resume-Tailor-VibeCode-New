import React, { useState } from "react";
import { Job, LogMessage } from "../types";
import { Plus, Trash2, ArrowRight, Wand2, Mail, ExternalLink, FileText, CheckCircle, RefreshCcw, Download, Terminal, BadgeAlert } from "lucide-react";

interface DashboardProps {
  jobs: Job[];
  deletedJobs?: Job[];
  onRestoreJob?: (id: string) => void;
  onOpenTailor: (job: Job) => void;
  onOpenManualReview: (job: Job) => void;
  onDeleteJob: (id: string) => void;
  onAddManualJob: (jobData: { title: string; company: string; url: string; description: string }) => void;
  logs: LogMessage[];
  onClearLogs: () => void;
  onUpdateJobStatus: (id: string, status: Job["status"]) => void;
  onResetPipeline?: () => void;
}

export default function Dashboard({
  jobs,
  deletedJobs = [],
  onRestoreJob,
  onOpenTailor,
  onOpenManualReview,
  onDeleteJob,
  onAddManualJob,
  logs,
  onClearLogs,
  onUpdateJobStatus,
  onResetPipeline,
}: DashboardProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewTab, setViewTab] = useState<"active" | "deleted">("active");
  const [newTitle, setNewTitle] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newCompany) return;
    onAddManualJob({
      title: newTitle,
      company: newCompany,
      url: newUrl,
      description: newDesc,
    });
    setNewTitle("");
    setNewCompany("");
    setNewUrl("");
    setNewDesc("");
    setShowAddModal(false);
  };

  const exportCSV = () => {
    const headers = "Job Title,Company,URL,Date Captured,Status,Match Score\n";
    const rows = jobs
      .map(
        (j) =>
          `"${j.title}","${j.company}","${j.url}","${j.dateCaptured}","${j.status}",${j.matchScore || "N/A"}`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `captured_job_pipeline_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="flex-1 flex flex-col gap-3 min-w-0 min-h-0" id="pipeline-dashboard-view">
      {/* Active Jobs Spreadsheet View */}
      <section className="bg-faction-panel border border-faction-border rounded flex flex-col flex-1 min-h-0" id="job-spread-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border-b border-faction-border bg-faction-panel-header/90 rounded-t gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <h2 className="text-xs font-black uppercase font-mono tracking-wider text-slate-200">Captured Job Pipeline List</h2>
              <p className="text-[10px] text-slate-450 font-mono mt-0.5">Scraped or created entries saved securely from Indeed and LinkedIn</p>
            </div>

            {/* Soft-Tabs Selector */}
            <div className="flex border border-faction-border rounded p-0.5 bg-black/20 font-mono shadow-inner">
              <button
                onClick={() => setViewTab("active")}
                className={`px-3 py-1 text-[10px] font-bold rounded transition-all cursor-pointer ${
                  viewTab === "active"
                    ? "bg-faction-primary text-faction-text border border-faction-accent-border/40 shadow-xs"
                    : "text-faction-text-muted hover:text-faction-text font-medium"
                }`}
              >
                ACTIVE PIPELINE ({jobs.length})
              </button>
              <button
                onClick={() => setViewTab("deleted")}
                className={`px-3 py-1 text-[10px] font-bold rounded transition-all cursor-pointer flex items-center gap-1 ${
                  viewTab === "deleted"
                    ? "bg-faction-primary text-faction-text border border-faction-accent-border/40 shadow-xs"
                    : "text-faction-text-muted hover:text-faction-text font-medium"
                }`}
                id="deleted-jobs-tab-btn"
              >
                TRASHED / ARCHIVED ({deletedJobs.length})
              </button>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap font-mono">
            <button
              onClick={exportCSV}
              className="px-2.5 py-1.5 text-[10px] font-bold border border-faction-border text-faction-text rounded bg-black/20 hover:bg-black/45 cursor-pointer flex items-center gap-1.5 transition-colors"
              id="export-csv-btn"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> EXPORT CSV
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 text-[10px] font-bold bg-[#2563eb] border border-blue-500/40 text-white rounded hover:bg-blue-600 cursor-pointer flex items-center gap-1.5 transition-colors shadow-md"
              id="manual-entry-btn"
            >
              <Plus className="w-4 h-4" /> + ADD ENTRY
            </button>
          </div>
        </div>

        {/* Database Table Spreadsheet */}
        <div className="flex-1 overflow-auto min-h-[250px] scrollbar-thin scrollbar-thumb-faction-border" id="job-grid-scroller">
          {viewTab === "active" && jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-500 gap-3">
              <FileText className="w-10 h-10 text-slate-700" />
              <div>
                <p className="text-xs font-mono font-bold text-slate-400">PIPELINE SECURE & EMPTY</p>
                <p className="text-[11px] text-slate-500 max-w-sm mt-1">
                  Install our Chromium script or use manual entry to start tracking roles locally.
                </p>
              </div>
            </div>
          ) : viewTab === "deleted" && deletedJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 gap-3 h-full">
              <Trash2 className="w-10 h-10 text-slate-700" />
              <div>
                <p className="text-xs font-mono font-bold text-slate-400">NO DELETED ENTRIES FOUND</p>
                <p className="text-[11px] text-slate-500 max-w-sm mt-1">
                  Any job post deleted from your main desk can be restored instantly from this dashboard tab.
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse" id="job-spreadsheet-table">
              <thead className="bg-faction-panel-header sticky top-0 text-[10px] uppercase text-faction-text-muted font-bold border-b border-faction-border backdrop-blur-md z-10 font-mono tracking-wider">
                {viewTab === "active" ? (
                  <tr>
                    <th className="px-4 py-2 text-center w-12 text-[9px]">Delete</th>
                    <th className="px-4 py-2 text-center w-12 text-[9px]">ID</th>
                    <th className="px-4 py-2.5">POSITION & EMPLOYER</th>
                    <th className="px-4 py-2.5">SOURCE ATTACHMENT</th>
                    <th className="px-4 py-2.5">TAILOR LEVEL</th>
                    <th className="px-4 py-2.5 text-right pr-6">CONTROL ACTIONS</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-4 py-2 text-center w-12 text-[9px]">ID</th>
                    <th className="px-4 py-2.5">DELETED ROLE & COMPANY</th>
                    <th className="px-4 py-2.5">INFORMATION LINK</th>
                    <th className="px-4 py-2.5">PREVIOUS HEURISTIC</th>
                    <th className="px-4 py-2.5 text-right pr-6">RESTORE ACTIONS</th>
                  </tr>
                )}
              </thead>
              <tbody className="text-xs divide-y divide-slate-900 bg-transparent" id="job-spreadsheet-body">
                {viewTab === "active" ? (
                  jobs.map((job, index) => {
                    const dateStr = new Date(job.dateCaptured).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });

                    return (
                      <tr
                        key={job.id}
                        className={`hover:bg-[#1a2336]/40 transition-colors ${
                          job.hasUnreadEmailUpdate ? "bg-orange-550/10" : ""
                        }`}
                        id={`job-row-${job.id}`}
                      >
                        {/* Delete Left Button - unison with all rows */}
                        <td className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => onDeleteJob(job.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded cursor-pointer hover:bg-rose-950/20 transition-colors"
                            title="Delete role"
                            id={`delete-job-${job.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>

                        {/* Badge Count / Index */}
                        <td className="px-4 py-3.5 text-center text-[11px] font-mono text-slate-500">
                          {job.hasUnreadEmailUpdate ? (
                            <div className="relative inline-block">
                              <span className="flex h-2 w-2 absolute -top-1 -right-1 z-20">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                              </span>
                              <span className="text-orange-450 font-bold font-sans">!</span>
                            </div>
                          ) : (
                            index + 1
                          )}
                        </td>

                        {/* Job Title and Company */}
                        <td className="px-4 py-3.5 text-slate-300">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-100 leading-tight block font-sans">{job.title}</span>
                            {job.url && (
                              <a
                                href={job.url}
                                target="_blank"
                                referrerPolicy="no-referrer"
                                className="text-slate-500 hover:text-blue-400"
                                title="Open original job posting"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-450 flex items-center gap-1.5 mt-0.5">
                            <span className="font-bold text-slate-300 font-mono">{job.company}</span>
                            <span className="text-slate-700">•</span>
                            <span>Captured {dateStr}</span>
                          </div>
                        </td>

                        {/* URL or Scraping Source Preview */}
                        <td className="px-4 py-3.5 text-slate-400 max-w-[200px] truncate">
                          <span className="text-[10px] font-mono text-slate-300 bg-[#131a2a] border border-slate-800/80 px-2 py-0.5 rounded">
                            {job.url.includes("indeed") ? "Indeed Scraping" : job.url.includes("linkedin") ? "LinkedIn Web" : "Manual Entry"}
                          </span>
                        </td>

                        {/* Gemini Match Status */}
                        <td className="px-4 py-3.5">
                          {job.status === "captured" && (
                            <span className="px-2 py-0.5 bg-slate-900 text-slate-400 rounded text-[9px] font-bold font-mono border border-slate-800 inline-block uppercase tracking-wide">
                              Untailored
                            </span>
                          )}
                          {job.status === "analyzing" && (
                            <span className="px-2 py-0.5 bg-amber-950/45 text-amber-400 rounded text-[9px] font-bold font-mono border border-amber-900/30 inline-block animate-pulse uppercase tracking-wide">
                              Parsing...
                            </span>
                          )}
                          {job.status === "tailored" && (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 bg-emerald-950/50 text-emerald-400 rounded text-[9px] font-bold font-mono border border-emerald-900/30 inline-block uppercase tracking-wide">
                                Tailored ({job.matchScore || 90}% MATCH)
                              </span>
                            </div>
                          )}
                          {job.status === "manual_review" && (
                            <span className="px-2 py-0.5 bg-blue-950/60 text-blue-400 rounded text-[9px] font-bold font-mono border border-blue-900/30 inline-block uppercase tracking-wide">
                              Review Ready
                            </span>
                          )}
                          {(job.status === "submitted" || job.status === "denied" || job.status === "interviewing") && (
                            <select
                              value={job.status}
                              onChange={(e) => onUpdateJobStatus(job.id, e.target.value as any)}
                              className={`px-2 py-0.5 rounded text-[9.5px] font-bold font-mono cursor-pointer border outline-none ${
                                job.status === "submitted" ? "bg-slate-950 text-slate-300 border-slate-800" :
                                job.status === "denied" ? "bg-rose-950/60 text-rose-400 border-rose-900/30" :
                                "bg-indigo-950/60 text-indigo-400 border-indigo-900/30"
                              }`}
                            >
                              <option value="submitted">✓ Submitted</option>
                              <option value="interviewing">► Next Step</option>
                              <option value="denied">✕ Denied</option>
                            </select>
                          )}
                        </td>

                        {/* Interactive Submission Actions */}
                        <td className="px-4 py-3.5 text-right pr-6">
                          <div className="flex justify-end items-center gap-1.5 font-mono">
                            {job.status === "captured" && (
                              <button
                                onClick={() => onOpenTailor(job)}
                                className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600/20 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                id={`trigger-tailor-${job.id}`}
                              >
                                <Wand2 className="w-3 h-3" /> TAILOR
                              </button>
                            )}

                            {job.status === "analyzing" && (
                              <button
                                disabled
                                className="px-2.5 py-1 bg-slate-900 text-slate-600 border border-slate-800 rounded text-[10px] cursor-not-allowed font-bold"
                              >
                                WAITING
                              </button>
                            )}

                            {(job.status === "tailored" || job.status === "manual_review") && (
                              <button
                                onClick={() => onOpenManualReview(job)}
                                className="px-2.5 py-1 bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/25 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                id={`manual-review-${job.id}`}
                              >
                                <CheckCircle className="w-3 h-3" /> REVIEWS
                              </button>
                            )}

                            {(job.status === "submitted" || job.status === "denied" || job.status === "interviewing") && (
                              <button
                                onClick={() => onOpenManualReview(job)}
                                className="px-2 py-0.5 text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 rounded text-[10px] border border-slate-800 font-bold cursor-pointer"
                              >
                                PREVIEW
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  deletedJobs.map((job, index) => {
                    const dateStr = new Date(job.dateCaptured).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });

                    return (
                      <tr
                        key={job.id}
                        className="hover:bg-slate-900/30 transition-colors text-slate-400 bg-transparent"
                        id={`deleted-job-row-${job.id}`}
                      >
                        {/* No. */}
                        <td className="px-4 py-3.5 text-center text-[10px] font-mono text-slate-600">
                          {index + 1}
                        </td>

                        {/* Job Title and Company */}
                        <td className="px-4 py-3.5 text-slate-300">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-200 leading-tight block">{job.title}</span>
                            {job.url && (
                              <a
                                href={job.url}
                                target="_blank"
                                referrerPolicy="no-referrer"
                                className="text-slate-500 hover:text-blue-400"
                                title="Open original job posting"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-bold text-slate-400 font-mono">{job.company}</span>
                            <span className="text-slate-700">•</span>
                            <span>Originally Captured {dateStr}</span>
                          </div>
                        </td>

                        {/* URL or Scraping Source Preview */}
                        <td className="px-4 py-3.5 text-slate-400 max-w-[200px] truncate font-sans">
                          <span className="text-[10px] font-mono text-faction-text-muted bg-faction-panel/50 border border-faction-border px-2 py-0.5 rounded">
                            {job.url.includes("indeed") ? "Indeed Scraping" : job.url.includes("linkedin") ? "LinkedIn Web" : "Manual Scraped"}
                          </span>
                        </td>

                        {/* Status Prior to Deletion */}
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 bg-rose-950/20 text-rose-400 rounded text-[9px] font-bold font-mono border border-rose-900/20 inline-block uppercase tracking-wide">
                            DELETED IN STATUS: {job.status}
                          </span>
                        </td>

                        {/* Restore Button */}
                        <td className="px-4 py-3.5 text-right pr-6">
                          <button
                            onClick={() => onRestoreJob && onRestoreJob(job.id)}
                            className="px-3 py-1 bg-emerald-650/15 hover:bg-emerald-650/25 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-bold font-mono inline-flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-md"
                            id={`restore-job-${job.id}`}
                          >
                            RESTORE DATA
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Add Manual Job Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-faction-panel rounded shadow-2xl border border-faction-border max-w-lg w-full flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-4 border-b border-faction-border bg-faction-panel-header flex items-center justify-between">
              <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-slate-200 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" /> Add New Job Capture
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-450 hover:text-slate-200 text-sm font-bold cursor-pointer font-mono"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold font-mono text-slate-450 uppercase mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Full-Stack Engineer"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs p-2 bg-faction-bg border border-faction-border text-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans placeholder-slate-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold font-mono text-slate-450 uppercase mb-1">Company *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Google, Spotify"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full text-xs p-2 bg-faction-bg border border-faction-border text-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans placeholder-slate-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold font-mono text-slate-450 uppercase mb-1">Link / URL</label>
                <input
                  type="url"
                  placeholder="e.g. https://www.indeed.com/viewjob?..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full text-xs p-2 bg-faction-bg border border-faction-border text-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans placeholder-slate-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold font-mono text-slate-450 uppercase mb-1">Raw Job Description Content</label>
                <textarea
                  placeholder="Paste the full job description text or requirements from Indeed/LinkedIn..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={6}
                  className="w-full text-xs p-2 bg-faction-bg border border-faction-border text-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono placeholder-slate-600"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-faction-border font-mono text-[10px]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-slate-400 hover:bg-slate-900 rounded cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-bold bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/20 rounded cursor-pointer flex items-center gap-1 shadow-md"
                >
                  SAVE ENTRY
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
