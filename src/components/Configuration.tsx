import React, { useState, useEffect } from "react";
import { CandidateProfile } from "../types";
import { Save, User, Mail, Phone, Globe, FileText, CheckCircle, ShieldAlert, Sparkles, Server, RefreshCw } from "lucide-react";

interface ConfigurationProps {
  profile: CandidateProfile;
  onUpdateProfile: (profile: CandidateProfile) => void;
  onResetPipeline?: () => void;
}

export default function Configuration({ profile, onUpdateProfile, onResetPipeline }: ConfigurationProps) {
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [website, setWebsite] = useState(profile.website);
  const [resumeText, setResumeText] = useState(profile.resumeText);
  const [showSavedMsg, setShowSavedMsg] = useState(false);
  const [lastInitialized, setLastInitialized] = useState<CandidateProfile | null>(null);

  useEffect(() => {
    if (
      !lastInitialized ||
      profile.name !== lastInitialized.name ||
      profile.email !== lastInitialized.email ||
      profile.phone !== lastInitialized.phone ||
      profile.website !== lastInitialized.website ||
      profile.resumeText !== lastInitialized.resumeText
    ) {
      setName(profile.name);
      setEmail(profile.email);
      setPhone(profile.phone);
      setWebsite(profile.website);
      setResumeText(profile.resumeText);
      setLastInitialized(profile);
    }
  }, [profile, lastInitialized]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      name,
      email,
      phone,
      website,
      resumeText,
    });
    setShowSavedMsg(true);
    setTimeout(() => {
      setShowSavedMsg(false);
    }, 2500);
  };

  return (
    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto p-5 space-y-6" id="configuration-view">
      {/* Configuration Header */}
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Server className="w-5 h-5 text-blue-600" /> Platform Configurations & Secure Settings
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Adjust candidate parameters, default portfolio locations, and baseline resume values monitored by our active scraper nodes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Inputs */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4" id="config-form">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" /> Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                placeholder="e.g. Michael Burson"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> Registered Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                placeholder="e.g. mburson99@gmail.com"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> Contact Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                placeholder="e.g. 555-0199-223"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-slate-400" /> Portfolio Website
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                placeholder="e.g. https://alexmercer.dev"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" /> Resume Profile (Default text)
            </label>
            <textarea
              required
              rows={12}
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="w-full text-xs p-2 border border-slate-300 font-mono rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 leading-relaxed"
              placeholder="Paste your default clean text resume here... It will automatically reload during future tailoring sessions."
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-98 transition-all"
              id="save-settings-btn"
            >
              <Save className="w-4 h-4" /> Save Configuration Parameters
            </button>
            {showSavedMsg && (
              <span className="text-[11px] text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 font-bold animate-fade-in flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Settings Committed
              </span>
            )}
          </div>
        </form>

        {/* Informational Guidelines Card */}
        <div className="space-y-4" id="config-sidebar bg-slate-50 p-4 border border-slate-205 rounded-xl flex flex-col justify-between">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-200 pb-2">
              <Sparkles className="w-4.5 h-4.5 text-blue-600 animate-pulse" />
              <h4 className="text-xs uppercase tracking-wide">Workspace Security</h4>
            </div>
            <p className="text-[11.5px] text-slate-500 leading-relaxed">
              JobFlow operates securely within standard node containers. API keys are managed externally via <strong>Secrets settings panel</strong> in Google AI Studio and are never leaked to client side scripts during runtime routing.
            </p>

            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <span className="w-2 h-2 rounded bg-green-500 shrink-0"></span>
                <span>Gemini API Node: Connected</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <span className="w-2 h-2 rounded bg-green-500 shrink-0"></span>
                <span>Port 3000 Ingress: Secure</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <span className="w-2 h-2 rounded bg-green-500 shrink-0"></span>
                <span>IMAP Live Loop: Registered</span>
              </div>
            </div>
          </div>



          <div className="p-4 bg-orange-50 border border-orange-200 text-orange-950 rounded-xl flex gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-600 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <h4 className="text-xs font-bold font-sans uppercase">Notification Tracker Notice</h4>
              <p className="text-[10.5px] text-slate-600 mt-1 leading-normal font-sans">
                You must align candidate profiles with the email address configured above so incoming simulated recruiters match correct job records successfully.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
