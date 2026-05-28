import React, { useState } from "react";
import { Search, Sparkles, Loader2, Copy } from "lucide-react";

interface KeywordResult {
  coreKeywords: string[];
  relatedTitles: string[];
  booleanStrings: string[];
  advice: string;
}

export default function GeminiSearchAssistant() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<KeywordResult | null>(null);
  const [error, setError] = useState("");
  const [copiedText, setCopiedText] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    
    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/keywords/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        let errMessage = "Failed to fetch keywords";
        try {
          const errData = await response.json();
          if (errData.error) errMessage = errData.error;
        } catch (e) {}
        throw new Error(errMessage);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(""), 2000);
  };

  return (
    <div className="bg-faction-bg rounded p-4 border border-faction-border shadow-md">
      <div className="flex items-center gap-2 mb-4 border-b border-faction-border pb-2">
        <Sparkles className="w-4 h-4 text-faction-accent" />
        <span className="text-faction-accent font-bold uppercase tracking-widest text-[10px]">Gemini Search Keywords Assistant</span>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Form Section */}
        <div className="w-full md:w-1/3 space-y-3">
          <form onSubmit={handleSearch} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">What are you looking for?</label>
              <textarea
                placeholder="e.g. I do IT support and helpdesk stuff..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                required
                rows={3}
                className="w-full text-xs p-2 bg-faction-panel border border-faction-border text-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-faction-accent font-mono resize-none"
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !query}
              className="w-full py-2 bg-faction-accent hover:opacity-90 text-black font-bold rounded text-xs disabled:opacity-50 cursor-pointer flex justify-center items-center gap-1.5 transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" /> Ask Gemini
                </>
              )}
            </button>
            {error && <p className="text-red-400 text-[10px]">{error}</p>}
          </form>
        </div>

        {/* Results Section */}
        <div className="w-full md:w-2/3 border-l border-faction-border pl-0 md:pl-4">
          {!result && !isLoading && (
             <div className="h-full flex flex-col items-center justify-center text-slate-500 italic text-xs p-4">
                Describe the type of work you enjoy or want to do on the left. Gemini will generate optimized search queries, keywords, and alternative job titles to assist your hunt.
             </div>
          )}

          {isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-3">
               <Loader2 className="w-6 h-6 animate-spin text-faction-accent" />
               Consulting Gemini for the best recruiter keywords...
            </div>
          )}

          {result && !isLoading && (
            <div className="space-y-4 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
              {result.advice && (
                <div className="bg-black/20 border border-faction-border rounded p-2 text-xs text-faction-text">
                  <span className="font-bold text-faction-accent mr-1">Tip:</span> {result.advice}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1">Alternative Titles</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.relatedTitles.map((title, i) => (
                      <span key={i} className="px-2 py-0.5 bg-faction-panel border border-faction-border rounded text-[11px] text-slate-300">
                        {title}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1">Core Keywords</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.coreKeywords.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 bg-faction-panel border border-faction-border rounded text-[11px] text-slate-300">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1">Advanced Boolean Strings</h4>
                <div className="space-y-2">
                  {result.booleanStrings.map((str, i) => (
                    <div key={i} className="flex items-center gap-2 group">
                      <code className="flex-1 bg-black/30 border border-faction-border rounded p-1.5 text-[11px] text-slate-300 font-mono break-all line-clamp-2">
                        {str}
                      </code>
                      <button 
                        onClick={() => copyToClipboard(str)}
                        className="p-1.5 rounded bg-faction-panel border border-faction-border hover:bg-black/10 text-slate-400 text-xs shrink-0"
                        title="Copy to clipboard"
                      >
                        {copiedText === str ? <span className="text-green-400 font-bold px-1">Copied!</span> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
