import React, { useState, useEffect, useRef } from "react";
import { LogMessage } from "../types";
import { Terminal, Trash2, Cpu, Filter, CheckCircle, Database } from "lucide-react";
import GeminiSearchAssistant from "./GeminiSearchAssistant";

interface AIConsoleProps {
  logs: LogMessage[];
  onClearLogs: () => void;
}

export default function AIConsole({ logs, onClearLogs }: AIConsoleProps) {
  const [filterSource, setFilterSource] = useState<"ALL" | "SYSTEM" | "LLM" | "PROMPT" | "PDF" | "CHROME">("ALL");
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of terminal whenever logs update
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, filterSource]);

  const filteredLogs = logs.filter((log) => {
    if (filterSource === "ALL") return true;
    return log.sender === filterSource;
  });

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 min-w-0 h-full overflow-hidden text-faction-text" id="ai-console-view">
      {/* Left Column: Interactive Gemini Search Keywords Generator */}
      <section className="flex-1 lg:w-1/2 flex flex-col bg-faction-panel border border-faction-border rounded shadow-xl overflow-hidden" id="gemini-assistant-panel">
        <div className="p-3.5 border-b border-faction-border bg-faction-panel-header/90 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-black uppercase font-mono tracking-wider text-slate-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-faction-accent font-bold" />
              <span>Gemini Keyword Assistant</span>
            </h2>
            <p className="text-[10px] text-slate-455 font-mono mt-0.5">Generate optimized Boolean strings and titles of your target jobs</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] bg-faction-accent/15 text-faction-accent border border-faction-accent-border/40 px-2.5 py-0.5 rounded font-black uppercase font-mono">
              Gemini-2.5-Flash
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-faction-bg">
          <GeminiSearchAssistant />
        </div>
      </section>

      {/* Right Column: Real-time Terminal Logger Console */}
      <section className="flex-1 lg:w-1/2 flex flex-col bg-slate-950 border border-slate-900 rounded-xl shadow-md overflow-hidden" id="automation-terminal-panel">
        {/* Terminal Header */}
        <div className="p-3.5 border-b border-slate-900 bg-slate-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="font-mono uppercase tracking-widest text-xs">AI Automation Logs</span>
            </h2>
            <p className="text-[10px] text-slate-450 font-mono mt-0.5">Continuous integration scraping and LLM pipeline diagnostic monitor</p>
          </div>
          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {/* Filter Logs */}
            <div className="flex items-center gap-1.5 bg-slate-900/85 border border-slate-800 rounded px-2 py-1">
              <Filter className="w-3 h-3 text-slate-400" />
              <label className="text-[9px] font-mono text-slate-400">Source:</label>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value as any)}
                className="bg-transparent text-slate-200 text-[10px] font-mono font-bold focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-955">ALL</option>
                <option value="SYSTEM" className="bg-slate-955">SYSTEM</option>
                <option value="LLM" className="bg-slate-955 font-bold">LLM</option>
                <option value="PROMPT" className="bg-slate-955">PROMPT</option>
                <option value="PDF" className="bg-slate-955">PDF</option>
                <option value="CHROME" className="bg-slate-955">CHROME</option>
              </select>
            </div>
            
            <button
              onClick={onClearLogs}
              className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-900/50 px-2 py-1 rounded flex items-center gap-1 cursor-pointer font-mono font-semibold transition-colors"
              title="Flush current pipeline logs"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>
        </div>

        {/* Console Log Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono scrollbar-thin scrollbar-thumb-slate-800" id="console-logs-scroller">
          <div className="flex items-center gap-1 py-1 border-b border-dashed border-slate-900 text-slate-500 text-[10px] md:text-[11px]">
            <Database className="w-3.5 h-3.5 text-blue-500" /> Local database environment ready. Listening for scraping tasks...
          </div>

          {filteredLogs.map((log) => {
            let color = "text-green-400";
            let iconText = "";
            switch (log.sender) {
              case "LLM":
                color = "text-blue-400";
                iconText = "🤖";
                break;
              case "PROMPT":
                color = "text-yellow-400 font-semibold";
                iconText = "✍️";
                break;
              case "PDF":
                color = "text-pink-400";
                iconText = "📄";
                break;
              case "CHROME":
                color = "text-indigo-400";
                iconText = "🌐";
                break;
              case "SYSTEM":
              default:
                color = "text-emerald-500";
                iconText = "⚙️";
                break;
            }

            return (
              <div key={log.id} className="text-[10.5px] leading-relaxed break-words hover:bg-slate-900/20 py-0.5 px-1 rounded transition-colors flex items-start gap-1">
                <span className="text-slate-600 shrink-0 select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{" "}
                <span className={`${color} font-bold shrink-0`}>
                  {iconText} [{log.sender}]
                </span>{" "}
                <span className="text-slate-300 select-all">{log.text}</span>
              </div>
            );
          })}

          {filteredLogs.length === 0 && (
            <div className="text-slate-600 italic text-center py-8 text-[11px]">
              No log statements recorded matching "{filterSource}".
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Status bar */}
        <div className="px-4 py-2 border-t border-slate-900 bg-slate-900/20 flex items-center justify-between text-[9px] font-mono text-slate-550 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Logger Socket Active</span>
          </div>
          <span>Total Records: {logs.length}</span>
        </div>
      </section>
    </div>
  );
}
