import React, { useState, useEffect } from "react";
import { Job, CandidateProfile } from "../types";
import { CheckCircle, ExternalLink, FileText, Send, SquarePen, AlertTriangle, ArrowRight, UserPlus, FileCheck } from "lucide-react";

interface ManualReviewModalProps {
  job: Job | null;
  onClose: () => void;
  onSubmitCompleted: (jobId: string) => void;
  profile?: CandidateProfile;
}

export default function ManualReviewModal({
  job,
  onClose,
  onSubmitCompleted,
  profile,
}: ManualReviewModalProps) {
  const [pitchText, setPitchText] = useState("");
  const [checkedResumeFile, setCheckedResumeFile] = useState(false);
  const [checkedJobLink, setCheckedJobLink] = useState(false);
  const [checkedNitsReviewed, setCheckedNitsReviewed] = useState(false);

  useEffect(() => {
    if (job) {
      setPitchText(
        `Dear Hiring Team,\n\nI am writing to express my interest in the ${job.title} role at ${job.company}. My background aligns with the support, troubleshooting, documentation, and customer service needs described in the posting.\n\nThank you for your time and consideration.\n\nWarm regards,\n${profile?.name || "Michael Burson"}`
      );
      // Reset checkboxes
      setCheckedResumeFile(job.status === "submitted");
      setCheckedJobLink(job.status === "submitted");
      setCheckedNitsReviewed(job.status === "submitted");
    }
  }, [job]);

  if (!job) return null;

  const handleActionConfirm = () => {
    onSubmitCompleted(job.id);
    onClose();
  };

  const isAllChecked = checkedResumeFile && checkedJobLink && checkedNitsReviewed;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in" id="review-modal-mask">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-2xl w-full flex flex-col overflow-hidden max-h-[92vh]" id="review-panel-card">
        {/* Banner */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-xs font-black uppercase text-blue-600 tracking-wider">STAGE 4: APPLICATION GATEWAY</h3>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mt-0.5" id="review-header-title">
              <FileCheck className="w-5 h-5 text-emerald-600" /> Manual Submission Review Form
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer transition-all"
          >
            ✕
          </button>
        </div>

        {/* Content Box */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4" id="review-form-scroller">
          {/* Job Overview Metadata */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200" id="target-spec-banner">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Target Role</span>
                <h4 className="text-sm font-bold text-slate-800 mt-0.5">{job.title}</h4>
                <p className="text-xs font-semibold text-blue-600 mt-0.5">{job.company}</p>
              </div>
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  referrerPolicy="no-referrer"
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                >
                  Visit Direct Job Link <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            {job.matchScore && (
              <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Resume Match Rating:</span>
                <span className="font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                  {job.matchScore}% Match
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Checklist items */}
            <div className="space-y-3 p-4 bg-slate-50/50 rounded-lg border border-slate-150">
              <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2.5">Manual Validation Audit Checklist</h4>

              <label className="flex items-start gap-2.5 p-2 bg-white rounded border border-slate-250 cursor-pointer hover:bg-slate-50 transition-all">
                <input
                  type="checkbox"
                  checked={checkedResumeFile}
                  onChange={(e) => setCheckedResumeFile(e.target.checked)}
                  disabled={job.status === "submitted"}
                  className="mt-0.5 rounded cursor-pointer text-blue-600"
                />
                <div className="text-[11px]">
                  <span className="font-bold text-slate-800 block">Attach Tailored Resume File</span>
                  <p className="text-slate-500 mt-0.5">Ensure you download the structured resume output text or print PDF to your desktop disk.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 bg-white rounded border border-slate-250 cursor-pointer hover:bg-slate-50 transition-all">
                <input
                  type="checkbox"
                  checked={checkedJobLink}
                  onChange={(e) => setCheckedJobLink(e.target.checked)}
                  disabled={job.status === "submitted"}
                  className="mt-0.5 rounded cursor-pointer text-blue-600"
                />
                <div className="text-[11px]">
                  <span className="font-bold text-slate-800 block">Open Indeed/LinkedIn submission form</span>
                  <p className="text-slate-500 mt-0.5">Double check company form fields are open in your browser attachment views.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2 bg-white rounded border border-slate-255 cursor-pointer hover:bg-slate-50 transition-all">
                <input
                  type="checkbox"
                  checked={checkedNitsReviewed}
                  onChange={(e) => setCheckedNitsReviewed(e.target.checked)}
                  disabled={job.status === "submitted"}
                  className="mt-0.5 rounded cursor-pointer text-blue-600"
                />
                <div className="text-[11px]">
                  <span className="font-bold text-slate-800 block">Review notes addressed</span>
                  <p className="text-slate-500 mt-0.5">Confirm the resume is honest, readable, and aligned with the job posting.</p>
                </div>
              </label>
            </div>

            {/* Quick Introduction Pitches block */}
            <div className="flex flex-col">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Tailored Profile Short Introduction</label>
              <textarea
                value={pitchText}
                onChange={(e) => setPitchText(e.target.value)}
                disabled={job.status === "submitted"}
                placeholder="Write your email brief summary pitch accompanying candidate resume info..."
                className="flex-1 text-[11px] p-2 border border-slate-300 bg-white placeholder-slate-400 font-sans rounded focus:outline-none min-h-[140px] focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Guidelines info banner */}
          <div className="p-3 bg-amber-50 text-amber-900 border border-amber-200 text-[10.5px] rounded flex gap-2 font-sans shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Verify your application files match enterprise terms fully. Once complete, click <strong>Confirm Manual Submission Completed</strong> below. This moves the captured role to "Submitted" status, activating live background IMAP notifications monitors.
            </p>
          </div>
        </div>

        {/* Action Panel */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded border border-slate-200 transition-colors cursor-pointer font-bold"
          >
            Cancel Review
          </button>

          {job.status === "submitted" ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-150 px-3.5 py-1.5 rounded">
              <CheckCircle className="w-4 h-4 text-emerald-600" /> Submitted and Checked-In Successfully
            </div>
          ) : (
            <button
              onClick={handleActionConfirm}
              disabled={!isAllChecked}
              className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                isAllChecked
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
              }`}
              id="confirm-submission-btn"
            >
              <Send className="w-3.5 h-3.5" /> Confirm Manual Submission Completed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
