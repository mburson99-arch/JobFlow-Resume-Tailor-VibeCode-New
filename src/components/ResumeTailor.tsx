import React, { useState, useEffect, useRef } from "react";
import { Job, CandidateProfile } from "../types";
import { Sparkles, Terminal, FileText, ArrowRight, Save, RotateCcw, AlertTriangle, Check, ChevronRight, HelpCircle, Eye, Printer, Download } from "lucide-react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
// @ts-ignore
import html2pdf from "html2pdf.js";

interface ResumeTailorProps {
  selectedJob: Job | null;
  jobs: Job[];
  profile: CandidateProfile;
  onUpdateProfile: (profile: CandidateProfile) => void;
  onTailoringComplete: (updatedJob?: Job) => void;
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
  const activeTargetJobs = jobs.filter((job) => job.status !== "submitted");

  useEffect(() => {
    if (initialSelectedJob && !isTailoring) {
      setSelectedJob(initialSelectedJob);
    }
  }, [initialSelectedJob, isTailoring]);

  useEffect(() => {
    if (selectedJob) {
      setJobDescription(selectedJob.description);
      if (selectedJob.status === "tailored" || selectedJob.status === "manual_review" || selectedJob.status === "submitted") {
        setCritiqueMarkdown(selectedJob.critiqueMarkdown || "");
        setTailoredResumeText(selectedJob.tailoredResumeText || "");
        setMatchScore(selectedJob.matchScore || 0);
        setAiResponseText(selectedJob.aiResponse || "");
        setActiveTab((current) => current === "tailored" ? "tailored" : "critique");
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
    const previousStatus = selectedJob.status;
    onStatusUpdate(selectedJob.id, "analyzing");

    const instructionToSend = typeof overrideInstruction === "string" ? overrideInstruction : customInstructions;
    const isDraftRefinement = Boolean(tailoredResumeText && instructionToSend.trim());

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

      const updatedJob: Job = {
        ...selectedJob,
        status: "tailored",
        matchScore: data.matchScore,
        originalResume: resumeText,
        tailoredResumeText: data.tailoredResume,
        critiqueMarkdown: data.brutallyHonestCritique,
        requiresRelocation: data.requiresRelocation,
        aiResponse: data.aiResponse || "",
      };
      setSelectedJob(updatedJob);

      // Inform parent with the fresh draft so future refinements use the newest resume.
      onTailoringComplete(updatedJob);
      setIsTailoring(false);
      setActiveTab(isDraftRefinement ? "tailored" : "critique");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Something went wrong during the Gemini AI call. Please ensure your API key matches setting presets.");
      setIsTailoring(false);
      onStatusUpdate(selectedJob.id, previousStatus);
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

    const opt = {
      margin:       15,
      filename:     `Tailored_Resume_${selectedJob?.company || "employer"}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' as const },
      pagebreak:    { mode: ['css', 'legacy'] }
    };

    html2pdf().set(opt).from(printNode).save().catch((err: any) => {
      console.error("PDF generation failed:", err);
      setErrorMsg("Failed to generate PDF automatically.");
    });
  };

  const handleExpertPolish = async () => {
    if (!selectedJob) {
      setErrorMsg("Please select an active target job listing first.");
      return;
    }
    
    const prompt = `You are an expert resume editor and professional writing coach. Your task is to humanize and refine the provided resume draft.

Please do the following:

1. Rewrite overly formal or robotic-sounding language into natural, confident, first-person professional tone that reflects a real person's voice.

2. Remove or rephrase AI-generated patterns, including:
- Overused buzzwords such as "leverage", "spearhead", "utilize", "dynamic", and "results-driven"
- Generic filler phrases that add no real value
- Repetitive sentence structures or bullet point formats
- Exaggerated superlatives or vague claims

3. Add personality and authenticity by ensuring the language sounds like it was written by the candidate themselves: confident, grounded, and genuine.

4. Preserve all factual content. Do not invent, add, or remove any job titles, dates, companies, accomplishments, skills, contact details, certifications, tools, or metrics.

5. Maintain professional formatting standards appropriate for the candidate's industry.

6. Enforce resume length: the polished resume should read like a complete 1.5 to 2.5 page resume. Do not cut it down into a short one-page summary. Preserve enough concrete detail from the current draft to stay at least about 1.5 pages, while keeping it concise enough to stay under about 2.5 pages.

7. If the draft is too short, expand by restoring truthful existing detail from the current resume draft and base resume context. If the draft is too long, tighten wording without deleting real roles, projects, certifications, or useful job-aligned bullets.

Additional JobFlow formatting rules:
- Keep section headers clean Markdown: # Name, ## PROFESSIONAL SUMMARY, ## TECHNICAL SKILLS, ## TECHNICAL PROJECTS, ## PROFESSIONAL EXPERIENCE, ## EDUCATION & CERTIFICATIONS.
- Format job title/company/date lines as level-three headings, like "### Operations & Logistics Coordinator | Company | Location | 2020 - Present". The app will bold and underline those job title/location lines only.
- Never put a bullet/star/asterisk before job titles, company lines, date lines, or section headings.
- Use plain hyphen bullets only for actual resume points, like "- Remote Support: resolved customer-facing issues...".
- Do not use asterisk bullets or Markdown bold markers such as "**Remote Support:**". Do not bold, underline, or highlight bullet key-point labels.
- Return the fully revised resume, ready for submission, in the tailoredResume field only. Do not put commentary, analysis, or explanations inside the resume.`;

    await handleTailorCall(prompt);
  };
  return (
    <div className="flex-1 flex flex-col gap-3.5 overflow-hidden" id="resume-tailoring-module">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 flex flex-col shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 border border-blue-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-950">AI Resume Tailoring Workstation</h2>
              <p className="text-xs text-slate-600">Auto-craft focused resume modifications based on frank industry criticism</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-700 font-semibold">Active target listing:</span>
            <select
              onChange={handleJobSelect}
              value={selectedJob?.id || ""}
              className="text-xs p-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              id="job-select-tailor"
            >
              <option value="">-- Choose Captured Role --</option>
              {activeTargetJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.company} - {j.title} ({j.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!selectedJob ? (
        <div className="flex-1 bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center p-8 text-center shadow-sm" id="no-job-selected-view">
          <FileText className="w-12 h-12 text-slate-400 mb-2" />
          <p className="text-sm font-bold text-slate-900">No Job Selected to Tailor</p>
          <p className="text-[11px] text-slate-500 max-w-sm mt-1">
            Pick an existing captured or scraped job role using the dropdown selector above to feed into the Gemini critique compiler system.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden" id="tailor-workspace-columns">
          {/* Left Column: Input Data */}
          <div className="flex-1 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-sm" id="inputs-column">
            <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-900">Candidate & Job Specifications</span>
              <button
                onClick={saveProfileUpdates}
                className="text-xs bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 font-semibold transition-all shadow-sm"
                title="Save updates to basic candidate resume text"
              >
                <Save className="w-3.5 h-3.5 text-blue-600" /> Save Base Resume
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50" id="inputs-scroller">
              <div>
                <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1.5">
                  <label className="block text-xs font-bold text-slate-800">Your Base Resume Template</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Replace your current editor text with the default resume from Settings?")) {
                        setResumeText(profile.resumeText || "");
                      }
                    }}
                    className="text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg cursor-pointer font-semibold flex items-center gap-1 shadow-xs transition-colors"
                    title="Load the persistent candidate resume text from your System Settings"
                  >
                    📂 Sync/Load Default Resume from Settings
                  </button>
                </div>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  rows={9}
                  className="w-full text-sm p-3 bg-white border border-slate-300 text-slate-950 rounded-lg font-sans placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 leading-relaxed shadow-inner"
                  placeholder="Paste your standard text resume here (include contact data, summary, skills and chronological work blocks)..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Target Job Description</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={6}
                  className="w-full text-sm p-3 bg-white border border-slate-300 text-slate-950 rounded-lg font-sans placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 leading-relaxed shadow-inner"
                  placeholder="Paste core requirements or metadata copy-pasted directly from Indeed / Linkedin..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-blue-700 flex items-center gap-1 mb-1.5">
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  AI Refinement Prompt (Optional)
                </label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={3}
                  className="w-full text-sm p-3 bg-white border border-blue-200 text-slate-950 rounded-lg font-sans placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 leading-relaxed shadow-inner"
                  placeholder="E.g. Remove any mention of Python, or make the summary shorter, or focus on my customer service skills..."
                />
              </div>
            </div>

            <div className="p-3 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Prepares draft matching tech stack accurately</span>
              </div>
              <button
                onClick={() => handleTailorCall()}
                disabled={isTailoring || !resumeText || !jobDescription}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm transition-all"
                id="execute-tailor-btn"
              >
                {isTailoring ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" /> Tailoring...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> Compile & Tailor
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: AI Output */}
          <div className="flex-1 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-sm" id="outputs-column">
            {/* Tab Switches */}
            <div className="bg-slate-50 border-b border-slate-200 flex items-center justify-between p-2 shrink-0">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("critique")}
                  disabled={!critiqueMarkdown}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer border ${
                    activeTab === "critique"
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                      : "border-transparent hover:bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  }`}
                  id="tab-critique"
                >
                  Critique
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("tailored")}
                  disabled={!tailoredResumeText}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer border ${
                    activeTab === "tailored"
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                      : "border-transparent hover:bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  }`}
                  id="tab-tailored"
                >
                  Tailored Preview
                </button>
              </div>

              <div className="flex items-center gap-2 pr-2">
                {activeTab === "tailored" && tailoredResumeText && (
                  <button
                    onClick={() => handleTailorCall("FORMAT REPAIR ONLY: Rebuild the current draft into clean resume formatting. Preserve the same truthful content and contact details, but restore line breaks, blank lines, section spacing, bullet spacing, and standard headers. Use '# Name' at the top, then '## PROFESSIONAL SUMMARY', '## TECHNICAL SKILLS', '## TECHNICAL PROJECTS', '## PROFESSIONAL EXPERIENCE', and '## EDUCATION & CERTIFICATIONS' where applicable. Format job title/company/date lines as level-three headings like '### Operations & Logistics Coordinator | Company | Location | 2020 - Present'; the app will bold and underline those lines only. Use plain hyphen bullets only for actual resume points, like '- Remote Support: resolved customer-facing issues...'. Do not use asterisk bullets or Markdown bold markers like '**Label:**'. Do not bold, underline, or highlight bullet key-point labels. Do not collapse headings into paragraphs. Do not run sections together. Do not add conversational text, pleasantries, analysis, or feedback inside the resume. Return a polished resume document only.")}
                    disabled={isTailoring}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-lg cursor-pointer flex items-center gap-1 font-semibold text-xs transition-colors shadow-sm"
                  >
                    <RotateCcw className="w-3 h-3" /> {isTailoring ? "Refining..." : "Re-Optimize"}
                  </button>
                )}
                {matchScore !== null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-600 hidden sm:inline">Match Scale:</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${matchScore >= 90 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                      {matchScore}% ATS
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Error Message Box */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs border-b border-rose-200 flex items-start gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="font-semibold">{errorMsg}</p>
              </div>
            )}
            
            {/* Relocation Warning Box */}
            {selectedJob?.requiresRelocation && (
              <div className="p-3 bg-blue-50 text-blue-700 text-xs border-b border-blue-200 flex items-start gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="font-semibold text-[11px] leading-relaxed">
                  <strong>LOCATION WARNING:</strong> The AI noted that this job description specifically requires relocation/onsite attendance.
                </p>
              </div>
            )}

            {/* Response Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50" id="output-content-area">
              {isTailoring ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-600">
                  <Terminal className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                  <p className="text-sm font-bold text-slate-900">Invoking Gemini-Flash Analyzer Engine...</p>
                  <p className="text-xs text-slate-600 max-w-xs mt-1">
                    Analyzing raw resume formats against target company needs. Running brutal critique sequence and optimizing years of achievements in real-time.
                  </p>
                </div>
              ) : activeTab === "critique" && critiqueMarkdown ? (
                <div className="space-y-4 font-sans text-sm text-slate-800 leading-relaxed" id="critique-markdown-box">
                  <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg flex gap-3 shadow-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-amber-800">Recruiter Nitpick Warnings</h4>
                      <p className="text-xs text-slate-700 mt-1 leading-normal">
                        Read this feedback carefully to digest why standard resumes crash out during initial evaluation pipelines.
                      </p>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm max-w-none text-sm leading-relaxed text-slate-900">
                    <div style={{ whiteSpace: "pre-wrap" }}>{critiqueMarkdown}</div>
                  </div>
                </div>
              ) : activeTab === "tailored" && tailoredResumeText ? (
                <div className="space-y-3" id="tailored-resume-viewer">
                  <div className="flex flex-wrap items-center justify-between bg-white border border-slate-200 p-2 rounded-lg text-xs text-slate-700 gap-2 shadow-sm">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Check className="w-4 h-4 text-emerald-600" /> Use the formatting selectors to print or back up this document
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setIsEditingResume(!isEditingResume)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 rounded-lg border border-slate-300 cursor-pointer flex items-center gap-1 font-semibold text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" /> {isEditingResume ? "Preview" : "Edit Text"}
                      </button>
                      <button
                        onClick={handleDownloadPDF}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer flex items-center gap-1 font-semibold text-xs"
                      >
                        <Download className="w-3.5 h-3.5" /> Export PDF
                      </button>
                      <button
                        onClick={handleExpertPolish}
                        disabled={isTailoring}
                        className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg cursor-pointer flex items-center gap-1 font-semibold text-xs"
                        title="Rewrite currently tailored draft into a rigorous, non-robotic Second Draft with professional help desk alignments"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-600" /> Polish Draft
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 text-sm min-h-[400px] text-slate-900 font-sans select-text" id="tailored-resume-print-node-outer">
                    {isEditingResume ? (
                      <textarea
                        value={tailoredResumeText}
                        onChange={(e) => setTailoredResumeText(e.target.value)}
                        rows={18}
                        className="w-full text-sm font-sans p-2 bg-white text-slate-950 focus:outline-none resize-y border border-slate-200 focus:ring-2 focus:ring-blue-500 rounded-lg"
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
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 flex gap-3 shadow-inner">
                        <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-xs text-slate-700 leading-normal font-medium">
                          {aiResponseText}
                        </div>
                      </div>
                    )}
                    <div className="bg-white rounded-lg p-2 border border-slate-200 flex gap-2 items-center shadow-inner">
                      <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                      <input 
                        type="text" 
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder="Ask Gemini to refine, e.g. 'Add Google Workspace to technical skills; I have used it.'"
                        className="flex-1 text-sm px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-950 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-400"
                        onKeyDown={(e) => {
                           if (e.key === 'Enter') handleTailorCall();
                        }}
                      />
                      <button 
                        onClick={() => handleTailorCall()}
                        disabled={isTailoring || !customInstructions}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer shadow-sm transition-colors whitespace-nowrap"
                      >
                        {isTailoring ? "..." : "Refine Draft"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-500">
                  <FileText className="w-10 h-10 text-slate-400 mb-2" />
                  <p className="text-xs text-slate-600 max-w-xs leading-normal">
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
