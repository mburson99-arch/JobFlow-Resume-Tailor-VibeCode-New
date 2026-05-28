import React, { useState, useEffect, useRef } from "react";
import { Job, CandidateProfile } from "../types";
import { Sparkles, Terminal, FileText, ArrowRight, Save, RotateCcw, AlertTriangle, Check, ChevronRight, HelpCircle, Eye, Printer, Download } from "lucide-react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { downloadResumePdf } from "../lib/downloadResumePdf";
import { EXPERT_POLISH_PROMPT } from "../lib/resumePrompts";

interface ResumeTailorProps {
  selectedJob: Job | null;
  jobs: Job[];
  profile: CandidateProfile;
  onUpdateProfile: (profile: CandidateProfile) => void;
  onTailoringComplete: () => void;
  onStatusUpdate: (jobId: string, status: 'captured' | 'analyzing' | 'tailored' | 'manual_review' | 'submitted') => void;
}

export default function ResumeTailor({
  selectedJob: initialSelectedJob,
  jobs,
  profile,
  onUpdateProfile,
  onTailoringComplete,
  onStatusUpdate,
}: ResumeTailorProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(initialSelectedJob);
  const [resumeText, setResumeText] = useState(profile.resumeText);
  const [jobDescription, setJobDescription] = useState("");
  const [isTailoring, setIsTailoring] = useState(false);
  const [activeTab, setActiveTab] = useState<"input" | "critique" | "tailored">("input");

  // Output response states
  const [critiqueMarkdown, setCritiqueMarkdown] = useState("");
  const [tailoredResumeText, setTailoredResumeText] = useState("");
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [aiResponseText, setAiResponseText] = useState("");
  
  const [isEditingResume, setIsEditingResume] = useState(false);
  const resumePrintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialSelectedJob) {
      setSelectedJob(initialSelectedJob);
    }
  }, [initialSelectedJob]);

  useEffect(() => {
    if (selectedJob) {
      setJobDescription(selectedJob.description);
      if (selectedJob.status === "tailored" || selectedJob.status === "manual_review" || selectedJob.status === "submitted") {
        setCritiqueMarkdown(selectedJob.critiqueMarkdown || "");
        setTailoredResumeText(selectedJob.tailoredResumeText || "");
        setMatchScore(selectedJob.matchScore || 0);
        setAiResponseText(selectedJob.aiResponse || "");
        setActiveTab("critique");
      } else {
        setCritiqueMarkdown("");
        setTailoredResumeText("");
        setMatchScore(null);
        setAiResponseText("");
        setActiveTab("input");
      }
    }
  }, [selectedJob]);

  useEffect(() => {
    setResumeText(profile.resumeText);
  }, [profile]);

  const handleJobSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const job = jobs.find((j) => j.id === e.target.value);
    setSelectedJob(job || null);
  };

  const saveProfileUpdates = () => {
    onUpdateProfile({
      ...profile,
      resumeText: resumeText,
    });
  };

  const handleTailorCall = async (overrideInstruction?: string) => {
    if (!selectedJob) {
      setErrorMsg("Please select an active target job listing from the captured pipeline.");
      return;
    }
    setErrorMsg("");
    setIsTailoring(true);
    setAiResponseText("");
    onStatusUpdate(selectedJob.id, "analyzing");

    const instructionToSend = typeof overrideInstruction === "string" ? overrideInstruction : customInstructions;

    try {
      const response = await fetch("/api/resume/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: selectedJob.id,
          resumeText: resumeText,
          jobDescription: jobDescription,
          customInstructions: instructionToSend,
          currentDraft: tailoredResumeText,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Tailoring request returned bad status.");
      }

      setCritiqueMarkdown(data.brutallyHonestCritique);
      setTailoredResumeText(data.tailoredResume);
      setMatchScore(data.matchScore);
      setSuggestedSkills(data.suggestedSkills || []);
      setAiResponseText(data.aiResponse || "");
      setCustomInstructions("");

      // Inform parent
      onTailoringComplete();
      setIsTailoring(false);
      setActiveTab("critique");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Something went wrong during the Gemini AI call. Please ensure your API key matches setting presets.");
      setIsTailoring(false);
      onStatusUpdate(selectedJob.id, "captured");
    }
  };

  const handleDownloadPDF = () => {
    // Generate an actual PDF file directly without natively printing
    if (isEditingResume) {
      setIsEditingResume(false);
      setTimeout(() => executeDownloadPDF(), 100);
    } else {
      executeDownloadPDF();
    }
  };

  const executeDownloadPDF = () => {
    const printNode = document.getElementById("tailored-resume-print-node");
    if (!printNode) {
       setErrorMsg("Could not find resume content to print.");
       return;
    }

    downloadResumePdf(printNode, { company: selectedJob?.company }).catch((err: any) => {
      console.error("PDF generation failed:", err);
      setErrorMsg("Failed to generate PDF automatically.");
    });
  };

  const handleExpertPolish = async () => {
    if (!selectedJob) {
      setErrorMsg("Please select an active target job listing first.");
      return;
    }
    
    await handleTailorCall(EXPERT_POLISH_PROMPT);
  };
  return (
    <div className="flex-1 flex flex-col gap-3.5 overflow-hidden" id="resume-tailoring-module">
      <div className="bg-faction-panel border border-faction-border rounded shadow-xl p-3 flex flex-col shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-faction-accent/15 rounded flex items-center justify-center text-faction-accent">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase font-mono tracking-wider text-slate-200">Resume Tailoring Workspace</h2>
              <p className="text-[10px] text-slate-450 font-mono">Compare the role, revise the resume, and review the output before applying.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-bold font-mono uppercase tracking-wider">Active Target Listing:</span>
            <select
              onChange={handleJobSelect}
              value={selectedJob?.id || ""}
              className="text-xs p-1.5 bg-faction-bg border border-faction-border rounded font-bold text-faction-text focus:outline-none focus:ring-1 focus:ring-faction-accent cursor-pointer"
              id="job-select-tailor"
            >
              <option value="">-- Choose Captured Role --</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.company} - {j.title} ({j.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!selectedJob ? (
        <div className="flex-1 bg-faction-panel border border-faction-border rounded flex flex-col items-center justify-center p-8 text-center shadow-xl" id="no-job-selected-view">
          <FileText className="w-12 h-12 text-slate-700 mb-2 animate-bounce" />
          <p className="text-xs font-bold font-mono uppercase text-slate-400 tracking-widest">No Job Selected to Tailor</p>
          <p className="text-[11px] text-slate-500 max-w-sm mt-1">
            Pick an existing captured or scraped job role using the dropdown selector above.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden" id="tailor-workspace-columns">
          {/* Left Column: Input Data */}
          <div className="flex-1 bg-faction-panel border border-faction-border rounded flex flex-col overflow-hidden shadow-xl" id="inputs-column">
            <div className="bg-faction-panel-header/80 p-2.5 border-b border-faction-border flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold font-mono text-faction-text-muted uppercase tracking-widest">Candidate & Job Specifications</span>              <button
                onClick={saveProfileUpdates}
                className="text-[9.5px] bg-black/20 hover:bg-black/45 border border-faction-border text-faction-text px-2.5 py-1 rounded cursor-pointer flex items-center gap-1 font-mono font-bold transition-all"
                title="Save updates to basic candidate resume text"
              >
                <Save className="w-3.5 h-3.5 text-blue-400" /> SAVE BASE RESUME
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/10" id="inputs-scroller">
              <div>
                <div className="flex justify-between items-center mb-1 flex-wrap gap-1.5 font-mono">
                  <label className="block text-[10px] font-bold text-slate-450 uppercase">Your Base Resume Template (Raw Text)</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Replace your current editor text with the default resume from Settings?")) {
                        setResumeText(profile.resumeText || "");
                      }
                    }}
                    className="text-[9.5px] text-blue-400 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 px-2 py-0.5 rounded cursor-pointer font-bold flex items-center gap-1 shadow-xs transition-colors"
                    title="Load the persistent candidate resume text from your System Settings"
                  >
                    📂 Sync/Load Default Resume from Settings
                  </button>
                </div>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  rows={9}
                  className="w-full text-xs p-2 bg-faction-bg border border-faction-border text-slate-100 rounded font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-faction-accent focus:border-transparent"
                  placeholder="Paste your standard text resume here (include contact data, summary, skills and chronological work blocks)..."
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold font-mono text-slate-450 uppercase mb-1">Target Job Description (JD Context)</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={6}
                  className="w-full text-xs p-2 bg-faction-bg border border-faction-border text-slate-100 rounded font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-faction-accent focus:border-transparent"
                  placeholder="Paste core requirements or metadata copy-pasted directly from Indeed / Linkedin..."
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold font-mono text-blue-450 uppercase flex items-center gap-1 mb-1">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  AI Refinement Prompt (Optional)
                </label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={3}
                  className="w-full text-xs p-2 bg-blue-950/10 border border-blue-900/30 text-blue-200 rounded font-mono placeholder-blue-900/40 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                  placeholder="E.g. Remove any mention of Python, or make the summary shorter, or focus on my customer service skills..."
                />
              </div>
            </div>

            <div className="p-3 bg-faction-panel border-t border-faction-border flex justify-between items-center shrink-0">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-450 font-mono">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-550" />
                <span>Prepares draft matching tech stack accurately</span>
              </div>
              <button
                type="button"
                onClick={() => handleTailorCall()}
                disabled={isTailoring || !resumeText || !jobDescription}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md transition-all animate-pulse font-mono"
                id="execute-tailor-btn"
              >
                {isTailoring ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" /> TAILORING WITH GEMINI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 animate-bounce" /> COMPILE & TAILOR
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: AI Output */}
          <div className="flex-1 bg-faction-panel border border-faction-border rounded flex flex-col overflow-hidden shadow-xl" id="outputs-column">
            {/* Tab Switches */}
            <div className="bg-faction-panel-header/80 border-b border-faction-border flex items-center justify-between p-1 shrink-0">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("critique")}
                  disabled={!critiqueMarkdown}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all cursor-pointer font-mono border ${
                    activeTab === "critique"
                      ? "bg-faction-primary text-faction-text border-faction-accent-border/40 font-bold"
                      : "border-transparent hover:bg-black/10 text-faction-text-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  }`}
                  id="tab-critique"
                >
                  BRUTAL CRITIQUE
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("tailored")}
                  disabled={!tailoredResumeText}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all cursor-pointer font-mono border ${
                    activeTab === "tailored"
                      ? "bg-faction-primary text-faction-text border-faction-accent-border/40 font-bold"
                      : "border-transparent hover:bg-black/10 text-faction-text-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  }`}
                  id="tab-tailored"
                >
                  TAILORED PREVIEW
                </button>
              </div>

              <div className="flex items-center gap-2 pr-2">
                {activeTab === "tailored" && tailoredResumeText && (
                  <button
                    type="button"
                    onClick={() => handleTailorCall("Remove any commentary that is not part of the resume. Restore standard Markdown section headers using '## ' and return only the resume text.")}
                    disabled={isTailoring}
                    className="px-2.5 py-1 bg-[#111827] hover:bg-slate-900 border border-slate-800 text-slate-300 rounded cursor-pointer flex items-center gap-1 font-bold font-mono text-[9px] transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> {isTailoring ? "Refining..." : "RE-OPTIMIZE RESUME"}
                  </button>
                )}
                {matchScore !== null && (
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-[9px] font-bold text-slate-505 uppercase tracking-widest hidden sm:inline">MATCH SCALE:</span>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded ${matchScore >= 90 ? "bg-emerald-950 text-emerald-400 border border-emerald-900/35" : "bg-amber-955 text-amber-405 border border-amber-900/35"}`}>
                      {matchScore}% ATS
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Error Message Box */}
            {errorMsg && (
              <div className="p-3 bg-rose-950/20 text-rose-450 text-xs border-b border-rose-900/35 flex items-start gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="font-mono font-semibold">{errorMsg}</p>
              </div>
            )}
            
            {/* Relocation Warning Box */}
            {selectedJob?.requiresRelocation && (
              <div className="p-3 bg-blue-950/10 text-blue-450 text-xs border-b border-blue-900/30 flex items-start gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="font-semibold text-[11px] font-mono leading-relaxed">
                  <strong>LOCATION WARNING:</strong> The AI noted that this job description specifically requires relocation/onsite attendance.
                </p>
              </div>
            )}

            {/* Response Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-black/10" id="output-content-area font-mono">
              {isTailoring ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
                  <Terminal className="w-10 h-10 text-blue-405 animate-spin mb-3" />
                  <p className="text-xs font-bold font-mono uppercase text-slate-300">Analyzing resume and job requirements...</p>
                  <p className="text-[10px] text-slate-500 font-mono max-w-xs mt-1">
                    Comparing the resume against the target role and preparing a focused revision.
                  </p>
                </div>
              ) : activeTab === "critique" && critiqueMarkdown ? (
                <div className="space-y-4 font-sans text-xs text-slate-350 leading-relaxed" id="critique-markdown-box">
                  <div className="p-3.5 bg-amber-950/20 border border-amber-900/35 text-amber-200 rounded flex gap-3 shadow-sm font-mono">
                    <AlertTriangle className="w-5 h-5 text-amber-555 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <h4 className="font-bold text-[11px] uppercase tracking-wider text-amber-300 font-mono">Recruiter Nitpick Warnings</h4>
                      <p className="text-[10px] text-slate-400 mt-1 leading-normal font-mono">
                        Read this feedback carefully to digest why standard resumes crash out during initial evaluation pipelines.
                      </p>
                    </div>
                  </div>
                  <div className="bg-faction-bg rounded p-4 border border-faction-border shadow-md prose prose-invert max-w-none text-[11.5px] font-mono leading-relaxed text-faction-text">
                    <div style={{ whiteSpace: "pre-wrap" }}>{critiqueMarkdown}</div>
                  </div>
                </div>
              ) : activeTab === "tailored" && tailoredResumeText ? (
                <div className="space-y-3" id="tailored-resume-viewer">
                  <div className="flex flex-wrap items-center justify-between bg-slate-900 border border-slate-850 p-2 rounded-lg text-[10px] text-slate-300 font-mono gap-2">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Check className="w-4 h-4 text-emerald-450 animate-pulse" /> Use the formatting selectors to print or back up this document
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsEditingResume(!isEditingResume)}
                        className="px-2.5 py-1 bg-[#161f30] hover:bg-slate-850 text-slate-250 rounded border border-slate-800 cursor-pointer flex items-center gap-1 font-bold text-[9px]"
                      >
                        <Eye className="w-3.5 h-3.5" /> {isEditingResume ? "PREVIEW TYPE" : "EDIT TEXT"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadPDF}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer flex items-center gap-1 font-bold text-[9px]"
                      >
                        <Download className="w-3.5 h-3.5" /> EXPORT PDF
                      </button>
                      <button
                        type="button"
                        onClick={handleExpertPolish}
                        disabled={isTailoring}
                        className="px-2.5 py-1 bg-indigo-650/15 border border-indigo-900/40 text-indigo-400 hover:bg-indigo-600/20 rounded cursor-pointer flex items-center gap-1 font-bold text-[9px]"
                        title="Rewrite currently tailored draft into a rigorous, non-robotic Second Draft with professional help desk alignments"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-405 animate-pulse" /> POLISH COGNITIVE DRAFT
                      </button>
                    </div>
                  </div>

                  <div className="bg-faction-bg rounded border border-faction-border shadow-sm p-4 text-[12px] min-h-[400px] text-faction-text font-mono select-text" id="tailored-resume-print-node-outer">
                    {isEditingResume ? (
                      <textarea
                        value={tailoredResumeText}
                        onChange={(e) => setTailoredResumeText(e.target.value)}
                        rows={18}
                        className="w-full text-xs font-mono p-1 bg-transparent text-[#e6edf3] focus:outline-none resize-y border-0 focus:ring-0 rounded"
                        placeholder="Edit markdown resume visually here..."
                        id="tailored-resume-edit-text"
                      />
                    ) : (
                      <div ref={resumePrintRef} className="resume-preview-document px-4 py-3 select-all" id="tailored-resume-print-node">
                        <Markdown remarkPlugins={[remarkBreaks]}>{tailoredResumeText}</Markdown>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 mt-4">
                    {aiResponseText && (
                      <div className="bg-faction-panel-header/40 rounded p-3 border border-faction-border flex gap-3 shadow-inner">
                        <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-[10px] text-slate-400 leading-normal font-medium animate-pulse">
                          {aiResponseText}
                        </div>
                      </div>
                    )}
                    <div className="bg-black/40 rounded p-2 border border-faction-border flex gap-2 items-center shadow-inner font-mono">
                      <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                      <input 
                        type="text" 
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder="Ask Gemini to refine (e.g. 'Make summary shorter', 'Highlight AWS')..."
                        className="flex-1 text-xs px-2 py-1.5 border border-slate-800 rounded bg-[#0a0f1d] text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-slate-605"
                        onKeyDown={(e) => {
                           if (e.key === 'Enter') {
                             e.preventDefault();
                             handleTailorCall();
                           }
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => handleTailorCall()}
                        disabled={isTailoring || !customInstructions}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold disabled:opacity-50 cursor-pointer shadow-md transition-colors whitespace-nowrap"
                      >
                        {isTailoring ? "..." : "REFINE DRAFT"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-500 font-mono">
                  <FileText className="w-10 h-10 text-slate-700 mb-2" />
                  <p className="text-[10px] text-slate-450 max-w-xs leading-normal">
                    Once tailored, Gemini's nitpicks and customized outputs will display here. Click "Compile & Tailor" to trigger the process.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
