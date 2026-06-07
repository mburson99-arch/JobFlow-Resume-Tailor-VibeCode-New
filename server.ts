import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { GoogleGenAI, Type } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON parsing
app.use(express.json());

// Enable CORS for Chrome Extension requests (Indeed/LinkedIn cross-origin fetches)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Initialize Gemini SDK with Telemetry User-Agent
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn("WARNING: GEMINI_API_KEY environment variable is not set. AI features will fallback to simulation.");
}

// Initialize Anthropic Claude client for keyword assistant
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;
if (!anthropicApiKey) {
  console.warn("WARNING: ANTHROPIC_API_KEY not set. Keyword assistant will use fallback mode.");
}

const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const openRouterModel = process.env.OPENROUTER_MODEL || "qwen/qwen3-235b-a22b:free";
const openRouterReferer = process.env.OPENROUTER_REFERER || "http://localhost:3000";
const openRouterTitle = process.env.OPENROUTER_TITLE || "JobFlow";
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";
if (!openRouterApiKey) {
  console.warn("WARNING: OPENROUTER_API_KEY not set. AI features will use Gemini when available.");
}

function extractJsonObject(text: string): string {
  const trimmed = (text || "").trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1);
  }
  return trimmed;
}

async function generateJsonWithOpenRouter<T>(prompt: string): Promise<T> {
  if (!openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": openRouterReferer,
      "X-Title": openRouterTitle,
    },
    body: JSON.stringify({
      model: openRouterModel,
      messages: [
        {
          role: "system",
          content: "You are JobFlow's resume and job-search assistant. Always return valid JSON only. Do not wrap JSON in Markdown.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.25,
      response_format: { type: "json_object" },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || response.statusText;
    throw new Error(`OpenRouter ${response.status}: ${message}`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }
  return JSON.parse(extractJsonObject(content)) as T;
}

async function generateJsonWithGemini<T>(prompt: string, responseSchema: any): Promise<T> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const responseText = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join("").trim() || "";
  if (!responseText) {
    throw new Error("Gemini returned an empty response.");
  }
  return JSON.parse(extractJsonObject(responseText)) as T;
}

async function generateJson<T>(prompt: string, responseSchema: any): Promise<T> {
  if (ai) {
    addLog("SYSTEM", `Running AI request through Gemini model ${geminiModel}.`);
    try {
      return await generateJsonWithGemini<T>(prompt, responseSchema);
    } catch (geminiError: any) {
      if (!openRouterApiKey) throw geminiError;
      addLog("SYSTEM", `Gemini request failed (${geminiError?.message || geminiError}); falling back to OpenRouter model ${openRouterModel}.`);
    }
  }
  if (!openRouterApiKey) {
    addLog("SYSTEM", "Gemini is not configured and OpenRouter is not configured.");
    throw new Error("No AI provider is configured.");
  }
  addLog("SYSTEM", `Running AI request through OpenRouter model ${openRouterModel}.`);
  return generateJsonWithOpenRouter<T>(prompt);
}

// Data storage paths
const dataDir =
  process.env.JOBFLOW_DATA_DIR ||
  process.env.DATA_DIR ||
  process.cwd() ||
  os.homedir();

const assetsDir =
  process.env.JOBFLOW_ASSETS_DIR ||
  process.env.ASSETS_DIR ||
  path.join(process.cwd(), "dist");

const JOBS_FILE = path.join(dataDir, "jobs_db.json");
const EMAILS_FILE = path.join(dataDir, "emails_db.json");
const PROFILE_FILE = path.join(dataDir, "profile_db.json");
const LOGS_FILE = path.join(dataDir, "logs_db.json");
const DELETED_JOBS_FILE = path.join(dataDir, "deleted_jobs_db.json");

fs.mkdirSync(dataDir, { recursive: true });

const DEFAULT_PROFILE = {
  name: "Michael Burson",
  email: "mburson99@gmail.com",
  phone: "740.755.0345",
  website: "https://github.com/mburson99-arch",
  githubProfileUrl: "https://github.com/mburson99-arch",
  githubProfileSummary: "",
  resumeText: "",
};

// Helper to safely read files
function readJSONFile<T>(filePath: string, defaultData: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as T;
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return defaultData;
}

// Helper to safely write files
function writeJSONFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
  }
}

function sanitizeTailoredResumeOutput(text: string, baseResume: string): string {
  let sanitized = text || "";
  const lowerBase = (baseResume || "").toLowerCase();
  const bannedUnverifiedEmployers = [
    "TechSolutions",
    "IT Support Specialist Co-op",
    "99% SLA",
    "2 years of direct help desk experience",
  ];

  bannedUnverifiedEmployers.forEach((phrase) => {
    if (!lowerBase.includes(phrase.toLowerCase())) {
      sanitized = sanitized.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
    }
  });

  return sanitized
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function repairResumeMarkdownLayout(text: string): string {
  let repaired = text || "";
  const sectionHeaders = [
    "PROFESSIONAL SUMMARY",
    "TECHNICAL SKILLS",
    "TECHNICAL PROJECTS",
    "PROFESSIONAL EXPERIENCE",
    "EDUCATION & CERTIFICATIONS",
    "WORK EXPERIENCE",
    "EXPERIENCE",
    "CERTIFICATIONS",
    "EDUCATION",
  ];

  // Gemini sometimes collapses Markdown into one paragraph. Restore structural breaks.
  repaired = repaired
    .replace(/\r\n/g, "\n")
    .replace(/([^\n])(#{1,3}\s+)/g, "$1\n\n$2")
    .replace(/([^\n])(\*\s+\*\*)/g, "$1\n$2")
    .replace(/([^\n])(\*\s+)/g, "$1\n$2")
    .replace(/([^\n])(###\s+)/g, "$1\n\n$2");

  sectionHeaders.forEach((header) => {
    const pattern = new RegExp(`##\\s*${header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?=[A-Z*#])`, "gi");
    repaired = repaired.replace(pattern, `## ${header}\n`);
  });

  repaired = repaired
    .replace(/^#\s+(PROFESSIONAL SUMMARY|TECHNICAL SKILLS|TECHNICAL PROJECTS|PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EXPERIENCE|EDUCATION & CERTIFICATIONS|CERTIFICATIONS|EDUCATION)\s*$/gim, "## $1")
    .replace(/^##\s+(WORK EXPERIENCE|EXPERIENCE)\s*$/gim, "## PROFESSIONAL EXPERIENCE")
    .replace(/^\*\s+(#{1,3}\s+.+)$/gm, "$1")
    .replace(/^\*\s+(\*\*[^*\n]+\*\*\s+\|.+)$/gm, "$1")
    .replace(/^\*\s+(\*\*[^*\n]+\*\*\s*$)/gm, "$1")
    .replace(/^\*\s+([^*\n|]+(?:\s+\|\s+[^|\n]+){1,4}.*(?:Present|Current|\d{4}).*)$/gim, "$1")
    .replace(/^\*\s+([^*\n]+(?:Coordinator|Specialist|Investigator|Manager|Technician|Analyst|Engineer|Administrator|Support|Associate|Representative|Consultant|Lead|Supervisor)\b[^\n]*)$/gim, "$1")
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*/g, "")
    .replace(/(### [^\n]+(?:Present|\d{4}|Self-Directed))(?=[A-Z])/g, "$1\n")
    .replace(/(-\s+[^:\n]+:[^.\n]*\.)(?=[A-Z])/g, "$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return repaired;
}

function sanitizeBaseResumeText(text: string): string {
  return (text || "")
    .replace(/IT Support Specialist Co-op \| TechSolutions \| June 2024 - Present[\s\S]*?(?=\nTECHNICAL PROJECTS|\n## TECHNICAL PROJECTS|\nEDUCATION|\nCERTIFICATIONS|$)/gi, "")
    .replace(/Dedicated and results-oriented IT Support Specialist leveraging 2 years of direct help desk experience and a robust 5-year background in remote operations and logistics[\s\S]*?Sentinel Technologies\./gi, "Career-changing IT support candidate with 5+ years of remote operations, logistics coordination, claims documentation, and customer-facing problem resolution. Strong habits around SLA discipline, written documentation, independent troubleshooting, and calm communication under pressure. Technical foundation built through self-hosted enterprise service desk lab work, Active Directory/RBAC practice, GPO troubleshooting simulations, VM-based systems work, Splunk exposure, and active CompTIA A+ study.")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const HARD_SKILL_TERMS = [
  ["active directory", "aduc", "directory services"],
  ["group policy", "gpo"],
  ["windows server", "server administration"],
  ["windows 10", "windows 11", "windows os", "windows workstation"],
  ["microsoft 365", "office 365", "exchange online", "sharepoint", "onedrive"],
  ["vpn", "remote access"],
  ["dns", "domain name system"],
  ["dhcp"],
  ["tcp/ip", "tcp ip"],
  ["network troubleshooting", "connectivity troubleshooting", "network connectivity"],
  ["ticketing", "service desk", "help desk", "incident tracking"],
  ["servicenow", "jira", "zendesk", "connectwise", "autotask"],
  ["sccm", "intune", "autopilot", "endpoint management", "patch management"],
  ["splunk", "log analysis", "monitoring"],
  ["powershell", "scripting"],
  ["sql", "database"],
  ["python"],
  ["javascript", "typescript"],
  ["linux"],
  ["vmware", "virtual machine", "virtualization", "multi-vm"],
  ["mfa", "multi-factor authentication"],
  ["cybersecurity", "security"],
  ["hardware troubleshooting", "printer", "desktop", "laptop", "mobile device"],
  ["apple ios", "ios", "android"],
  ["google workspace", "g-suite", "gmail admin"],
];

const CERTIFICATION_TERMS = [
  ["comptia a+", "a+"],
  ["comptia network+", "network+"],
  ["comptia security+", "security+"],
  ["google cybersecurity", "cybersecurity professional certificate"],
  ["high school diploma"],
  ["ged"],
  ["associate degree", "associate's degree"],
  ["bachelor degree", "bachelor's degree", "bachelors"],
  ["certification", "certified"],
  ["microsoft certified", "azure fundamentals", "az-900"],
];

const CONTEXT_KEYWORD_TERMS = [
  ["customer service", "customer support", "client support"],
  ["documentation", "documented", "case notes", "knowledge base"],
  ["sla", "service level agreement", "response time"],
  ["troubleshooting", "diagnose", "root cause", "problem solving"],
  ["escalation", "escalate", "handoff", "escalation routing"],
  ["remote", "remote support", "remote work"],
  ["communication", "non-technical users", "technical translation"],
  ["multi-task", "multitask", "multiple tickets", "prioritize", "fast-paced"],
  ["training", "user guidance", "walkthrough"],
  ["field technical resolution", "field resolution", "field support"],
  ["logistics", "operations", "dispatch", "routing"],
  ["claims", "investigation", "audit"],
];

function normalizeMatchText(text: string): string {
  return ` ${(text || "").toLowerCase().replace(/[^a-z0-9+#./\s-]/g, " ").replace(/\s+/g, " ")} `;
}

function normalizeResumeForChangeCheck(text: string): string {
  return (text || "")
    .replace(/\s+/g, " ")
    .replace(/[•●]/g, "*")
    .trim()
    .toLowerCase();
}

function hasMatchTerm(source: string, aliases: string[]): boolean {
  return aliases.some((alias) => source.includes(` ${alias.toLowerCase()} `) || source.includes(alias.toLowerCase()));
}

function getRequestedResumeTerms(customInstructions?: string) {
  const rawInstructions = customInstructions || "";
  const instructionText = normalizeMatchText(customInstructions || "");
  if (!instructionText.trim()) return [] as Array<{ label: string; aliases: string[] }>;
  if (/\b(format repair only|do not|don't|remove|delete|without|no conversational)\b/i.test(rawInstructions)) {
    return [] as Array<{ label: string; aliases: string[] }>;
  }

  const editIntent = /\b(add|include|mention|insert|put|place|highlight)\b/i.test(rawInstructions);
  if (!editIntent) return [] as Array<{ label: string; aliases: string[] }>;

  const knownTerms = HARD_SKILL_TERMS
    .filter((aliases) => hasMatchTerm(instructionText, aliases))
    .map((aliases) => ({ label: labelTerm(aliases), aliases }));

  const extractedTerms: Array<{ label: string; aliases: string[] }> = [];
  const extractionPatterns = [
    /\b(?:add|include|mention|insert|put|place|highlight)\s+["']?([^"'.\n\r]+?)["']?\s+(?:to|in|into|under|within)\s+(?:the\s+)?(?:technical\s+skills?|skills?|professional\s+summary|summary|projects?|experience|education|certifications?)(?:\s+section)?\b/gi,
    /\b(?:add|include|mention|insert|put|place|highlight)\s+["']?([^"'.\n\r]{2,80})["']?(?:[.\n\r]|$)/gi,
  ];

  extractionPatterns.forEach((pattern) => {
    for (const match of rawInstructions.matchAll(pattern)) {
      const phrase = String(match[1] || "")
        .replace(/\b(as|because|since)\b[\s\S]*$/i, "")
        .replace(/\b(section|technical skills?|skills?)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      if (phrase.length >= 2 && phrase.length <= 80) {
        extractedTerms.push({ label: phrase, aliases: [phrase] });
      }
    }
  });

  const merged = [...knownTerms, ...extractedTerms];
  const seen = new Set<string>();
  return merged.filter((term) => {
    const key = normalizeMatchText(term.label).trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getMissingRequestedResumeTerms(resumeText: string, customInstructions?: string) {
  const resumeSource = normalizeMatchText(resumeText || "");
  return getRequestedResumeTerms(customInstructions).filter(({ aliases }) => !hasMatchTerm(resumeSource, aliases));
}

function getSignificantTokens(text: string): string[] {
  const stopWords = new Set([
    "the", "and", "for", "with", "this", "that", "from", "will", "you", "are", "our", "your", "job",
    "role", "work", "team", "support", "technical", "technician", "specialist", "required", "preferred",
    "experience", "skills", "ability", "including", "using", "such", "must", "have", "into", "within",
  ]);

  return Array.from(new Set(
    normalizeMatchText(text)
      .trim()
      .split(/\s+/)
      .filter((word) => word.length >= 5 && !stopWords.has(word) && !/^\d+$/.test(word))
  )).slice(0, 80);
}

function labelTerm(aliases: string[]): string {
  return aliases[0].replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRequiredTerms(jobSource: string, termGroups: string[][]): string[][] {
  return termGroups.filter((aliases) => hasMatchTerm(jobSource, aliases));
}

function calculateTermScore(requiredTerms: string[][], resumeSource: string) {
  if (requiredTerms.length === 0) {
    return { score: 100, matched: [] as string[], missing: [] as string[] };
  }

  const matched: string[] = [];
  const missing: string[] = [];

  requiredTerms.forEach((aliases) => {
    const label = labelTerm(aliases);
    if (hasMatchTerm(resumeSource, aliases)) matched.push(label);
    else missing.push(label);
  });

  return {
    score: Math.round((matched.length / requiredTerms.length) * 100),
    matched,
    missing,
  };
}

function getExperienceRequirement(jobDescription: string) {
  const sentences = jobDescription.split(/(?<=[.!?])\s+|\n+/).map((line) => line.trim()).filter(Boolean);
  const experienceSentences = sentences.filter((sentence) =>
    /\b(years?|yrs?)\b/i.test(sentence) &&
    /\b(experience|background|minimum|required|preferred|support|it|technical|operations|logistics|customer)\b/i.test(sentence)
  );

  let requiredYears = 0;
  experienceSentences.forEach((sentence) => {
    const matches = sentence.matchAll(/\b(\d+)\+?\s*(?:-|to\s*\d+\s*)?(?:years?|yrs?)\b/gi);
    for (const match of matches) requiredYears = Math.max(requiredYears, Number(match[1]));
  });

  let domain = "general";
  const joined = experienceSentences.join(" ").toLowerCase();
  if (/\b(logistics|operations|dispatch|claims)\b/.test(joined)) domain = "operations/logistics";
  if (/\b(help desk|service desk|it support|technical support|desktop support|systems?|network)\b/.test(joined)) domain = "IT/support";
  if (/\b(customer|client|call center)\b/.test(joined) && domain === "general") domain = "customer support";

  return {
    requiredYears,
    domain,
    hardRequirementText: experienceSentences.slice(0, 4),
  };
}

function getResumeExperienceYears(resumeText: string, domain: string) {
  const sentences = resumeText.split(/(?<=[.!?])\s+|\n+/).map((line) => line.trim()).filter(Boolean);
  const domainPattern =
    domain === "IT/support"
      ? /\b(it support|help desk|service desk|technical|active directory|windows|network|ticketing|lab|support)\b/i
      : domain === "operations/logistics"
        ? /\b(operations|logistics|dispatch|claims|project manager|coordination)\b/i
        : domain === "customer support"
          ? /\b(customer|client|support|communication|de-escalation)\b/i
          : /\b(experience|background|operations|support|customer|technical)\b/i;

  let resumeYears = 0;
  sentences.filter((sentence) => domainPattern.test(sentence)).forEach((sentence) => {
    const matches = sentence.matchAll(/\b(\d+)\+?\s*(?:-|to\s*\d+\s*)?(?:years?|yrs?)\b/gi);
    for (const match of matches) resumeYears = Math.max(resumeYears, Number(match[1]));
  });

  return resumeYears;
}

function calculateExperienceScore(baseResume: string, tailoredResume: string, jobDescription: string) {
  const requirement = getExperienceRequirement(jobDescription);
  if (!requirement.requiredYears) {
    return {
      score: 100,
      requiredYears: 0,
      resumeYears: 0,
      domain: requirement.domain,
      hardRequirementText: requirement.hardRequirementText,
    };
  }

  const resumeYears = getResumeExperienceYears(`${baseResume}\n${tailoredResume}`, requirement.domain);
  return {
    score: Math.min(100, Math.round((resumeYears / requirement.requiredYears) * 100)),
    requiredYears: requirement.requiredYears,
    resumeYears,
    domain: requirement.domain,
    hardRequirementText: requirement.hardRequirementText,
  };
}

function formatHardRequirements(scoreDetails: {
  requiredSkills: string[];
  missingSkills: string[];
  requiredCerts: string[];
  missingCerts: string[];
  experience: ReturnType<typeof calculateExperienceScore>;
}) {
  const lines: string[] = [];
  scoreDetails.requiredSkills.forEach((skill) => {
    lines.push(`- ${skill}${scoreDetails.missingSkills.includes(skill) ? " (not clearly found in resume)" : " (matched)"}`);
  });
  scoreDetails.requiredCerts.forEach((cert) => {
    lines.push(`- ${cert}${scoreDetails.missingCerts.includes(cert) ? " (not clearly found in resume)" : " (matched)"}`);
  });
  if (scoreDetails.experience.requiredYears) {
    lines.push(`- ${scoreDetails.experience.requiredYears}+ years of ${scoreDetails.experience.domain} experience (${scoreDetails.experience.resumeYears || 0} years clearly found)`);
  }
  scoreDetails.experience.hardRequirementText.forEach((text) => lines.push(`- ${text}`));

  return Array.from(new Set(lines)).slice(0, 18);
}

function calculateResumeMatchScore(baseResume: string, tailoredResume: string, jobDescription: string) {
  const resumeSource = normalizeMatchText(`${baseResume}\n${tailoredResume}`);
  const jobSource = normalizeMatchText(jobDescription);
  const skillTerms = getRequiredTerms(jobSource, HARD_SKILL_TERMS);
  const certTerms = getRequiredTerms(jobSource, CERTIFICATION_TERMS);
  const contextTerms = getRequiredTerms(jobSource, CONTEXT_KEYWORD_TERMS);
  const skills = calculateTermScore(skillTerms, resumeSource);
  const certifications = calculateTermScore(certTerms, resumeSource);
  const keywords = calculateTermScore(contextTerms, resumeSource);
  const experience = calculateExperienceScore(baseResume, tailoredResume, jobDescription);

  const jdTokens = getSignificantTokens(jobDescription);
  const matchedTokenCount = jdTokens.filter((token) => resumeSource.includes(` ${token} `)).length;
  const keywordScore = contextTerms.length
    ? keywords.score
    : jdTokens.length
      ? Math.round((matchedTokenCount / jdTokens.length) * 100)
      : 100;

  const score = Math.round(
    (0.40 * skills.score) +
    (0.30 * experience.score) +
    (0.20 * certifications.score) +
    (0.10 * keywordScore)
  );
  const hardRequirements = formatHardRequirements({
    requiredSkills: skills.matched.concat(skills.missing),
    missingSkills: skills.missing,
    requiredCerts: certifications.matched.concat(certifications.missing),
    missingCerts: certifications.missing,
    experience,
  });

  return {
    score: Math.max(0, Math.min(100, score)),
    matchedTerms: Array.from(new Set([...skills.matched, ...certifications.matched, ...keywords.matched])).slice(0, 10),
    missingTerms: Array.from(new Set([...skills.missing, ...certifications.missing, ...keywords.missing])).slice(0, 10),
    hardRequirements,
    breakdown: {
      skills: skills.score,
      experience: experience.score,
      certifications: certifications.score,
      keywords: keywordScore,
    },
    explanation: `Likelihood to Apply = (0.40 x Skills ${skills.score}) + (0.30 x Experience ${experience.score}) + (0.20 x Certifications/Education ${certifications.score}) + (0.10 x Keywords ${keywordScore}) = ${Math.max(0, Math.min(100, score))}%.`,
  };
}

// Log utility
function addLog(sender: "SYSTEM" | "LLM" | "PROMPT" | "PDF" | "CHROME", text: string): void {
  const logs = readJSONFile<any[]>(LOGS_FILE, []);
  const newLog = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    sender,
    text,
  };
  logs.push(newLog);
  // Keep only last 100 logs
  if (logs.length > 100) logs.shift();
  writeJSONFile(LOGS_FILE, logs);
}

// Initialize databases if they do not exist
if (!fs.existsSync(PROFILE_FILE)) {
  writeJSONFile(PROFILE_FILE, {
    ...DEFAULT_PROFILE,
    resumeText: `MICHAEL BURSON
IT Support Specialist | Help Desk Technician | Ohio

Mobile: 740.755.0345 | Email: mburson99@gmail.com | Portfolio: https://github.com/mburson99-arch | LinkedIn: https://linkedin.com/in/michaelburson

PROFESSIONAL SUMMARY
Career-changing IT support candidate with 5+ years of remote operations, logistics coordination, claims documentation, and customer-facing problem resolution. Strong habits around SLA discipline, written documentation, independent troubleshooting, and calm communication under pressure. Technical foundation built through a self-hosted enterprise service desk lab with Active Directory/RBAC practice, GPO troubleshooting simulations, VM-based systems work, Splunk exposure, and active CompTIA A+ study.

TECHNICAL SKILLS
* Operating Systems: Windows 10/11, Windows Server, macOS, Apple iOS, Android OS
* Networking: DNS, DHCP, VPN, LAN/WAN, Cisco Meraki, TCP/IP
* Directory Services: Active Directory, Group Policy Objects (GPO)
* Microsoft Ecosystem: Microsoft 365 Administration Suite (user/license management), OneDrive, SharePoint
* Endpoint Management: SCCM, Intune, Autopilot (lab experience)
* Help Desk & Ticketing: Jira, ServiceNow (familiarity), Zendesk
* Monitoring & Tools: Splunk (log analysis), PowerShell, Git, VS Code, Google Workspace (G-Suite familiarity)
* Security Concepts: Multi-Factor Authentication (MFA) implementation, Workstation & Server Patching

TECHNICAL PROJECTS & LAB ENVIRONMENTS
* Self-Hosted Enterprise Service Desk Lab: Designed, deployed, and administered a 4-VM virtualized IT environment mimicking an enterprise network, including Windows Server, Active Directory Domain Services, DNS, DHCP, and a fully functional ticketing system. Configured Role-Based Access Control (RBAC) and simulated GPO failures to troubleshoot and harden domain policies.
* Splunk Integration for Security Monitoring: Integrated Splunk for real-time system log analysis, network traffic monitoring, and security event correlation within the lab environment, enhancing threat detection and troubleshooting capabilities.
* Endpoint Management Exploration: Gained hands-on experience with Microsoft Intune and Autopilot for cloud-based device management, deployment, and patching processes within a lab setting.
* MFA Solution Deployment: Researched and simulated the implementation of Multi-Factor Authentication (MFA) solutions for enhanced account security across various services.
* Apple & Android Device Support Practice: Configured and troubleshot virtualized Apple iOS and Android OS devices, including common network and application issues.

EDUCATION
B.S. in Information Technology | Ohio University | Graduated May 2024

CERTIFICATIONS
* Google Cybersecurity Professional Certificate (Completed)
* CompTIA A+ (In Progress, expected 2026)`,
  });
}

if (!fs.existsSync(JOBS_FILE)) {
  writeJSONFile(JOBS_FILE, [
    {
      id: "job-9xfrz5y",
      title: "IT Support Specialist - job post",
      company: "Mercer Bucks Technology",
      url: "https://www.indeed.com/jobs?q=it+support&l=Remote&radius=25&from=searchOnDesktopSerp%2Cwhereautocomplete&vjk=13a1127297189f0e",
      description: `Job Overview
We are seeking a dynamic and motivated IT Support Specialist to join our technology team! In this role, you will be the frontline hero for resolving technical issues, supporting users across various platforms, and maintaining our IT infrastructure. Your energetic approach and problem-solving skills will ensure seamless technology operations, empowering our organization to achieve its goals efficiently. This paid position offers an exciting opportunity to develop your expertise in a fast-paced, innovative environment while delivering exceptional customer service and technical support.

Responsibilities

Provide prompt and effective technical support to end-users via help desk tickets, phone, or in-person interactions.
Troubleshoot software issues across multiple operating systems including Windows, macOS, and Linux, ensuring quick resolution.
Manage computer hardware components such as desktops, laptops, mobile devices, printers, and peripherals to optimize performance.
Support network administration tasks including configuring and maintaining LAN (Local Area Network), WAN (Wide Area Network), VPN (Virtual Private Network), DNS (Domain Name System), and firewall settings like Meraki devices.
Assistant with software deployment, updates, and patch management using tools such as SCCM (System Center Configuration Manager) and GPO (Group Policy Objects).
Monitor and maintain IT infrastructure components including Windows Server environments, Active Directory, TCP/IP protocols, and network security measures.
Utilize service management tools like ServiceNow, Jira, BMC Remedy, or similar platforms for incident tracking and resolution documentation.
Collaborate with team members on network administration tasks including TCP/UDP analysis, DNS configuration, and troubleshooting connectivity issues.
Support remote users by configuring VPN access and troubleshooting connectivity problems on mobile devices and laptops.

Requirements

Proven experience providing technical support in a fast-paced environment with excellent customer service skills.
Strong troubleshooting skills across software applications and hardware components.
Hands-on experience managing computer networks including LAN/WAN setup, TCP/IP protocols, DNS configuration, firewalls (e.g., Meraki), and VPNs.
Familiarity with operating systems such as Windows (including Windows Server), macOS, and Linux distributions.
Knowledge of IT support tools like SCCM for software deployment and GPO for policy management.
Experience with help desk ticketing systems such as ServiceNow or BMC Remedy is highly desirable.
Ability to communicate complex technical information clearly to non-technical users.
Analysis skills to diagnose issues quickly and implement effective solutions efficiently. Join us to be part of a vibrant team dedicated to leveraging technology to drive success! Your expertise will help create a resilient IT environment that supports innovation while delivering outstanding service to all users.

Pay: $26.45 - $31.85 per hour

Benefits:

Dental insurance
Paid time off

Work Location: Remote`,
      dateCaptured: "2026-05-26T04:08:29.267Z",
      status: "submitted",
      matchScore: 78,
      originalResume: `MICHAEL BURSON New Concord, OH | 740.755.0345 | Mburson99@gmail.com LinkedIn:
www.linkedin.com/in/mjburson | Portfolio: github.com/mburson99-arch/AD-splunk-lab
PROFESSIONAL SUMMARY Disciplined, customer-focused professional with over 5 years of
remote operational experience transitioning into IT. Proven expertise managing strict SLAs,
handling high-stakes client escalations, and maintaining productivity in self-directed
environments. Armed with practical IT infrastructure expertise in Windows OS, Active Directory
(Password Resets/Unlocks), and VPN troubleshooting built through enterprise simulations.
Ready to provide first-line support to enterprise employees and ensure minimal downtime.
TECHNICAL SKILLS
● Systems Administration: Active Directory (ADUC), Group Policy Objects (GPOs),
RBAC (Role-Based Access Control), Windows Server/Client OS
● Network & Security Support: Multi-VM Architecture, VPN Troubleshooting, DNS/DHCP
Configuration, Remote Desktop Protocol (RDP)
● Operations & Diagnostics: Enterprise Incident Simulation, SLA Management, Remote
Software Deployment, Root-Cause Documentation
● Soft Skills: High-Pressure Communication, Incident Resolution, Technical Translation,
Team Collaboration
FEATURED TECHNICAL PROJECT Enterprise Service Desk & Identity Management Lab |
Self-Hosted | Dec 2024 – Present Engineered a virtualized sandbox environment to master
Level 1 Helpdesk operations, systems administration, and live infrastructure troubleshooting.
● Multi-VM Architecture: Successfully built and networked a 4-Virtual Machine topology
to run in tandem, simulating an enterprise server-client environment on the first iteration.
● Access Control & RBAC: Created users and applied Role-Based Access Controls to
enforce the principle of least privilege, successfully granting distinct "supervisor powers"
and administrative tiers across the network.
● GPO Troubleshooting: Intentionally broke Active Directory policies and forced update
failures within the VMs to simulate real-world service disruptions, successfully
troubleshooting and resolving the registry/policy blocks.
● Bulk Deployment: Leveraged Group Policy Objects (GPOs) to deploy simultaneous
remote software updates and configurations across all connected client endpoints
post-remediation.
● Documentation & Visibility: Logged simulated incidents in a local tracking system,
detailing the root cause of the broken configurations and the step-by-step resolution path
verified via GitHub project repositories.
PROFESSIONAL EXPERIENCE Operations & Logistics Coordinator (Roadie & Spark) |
Hotshot Hauling | Jan 2022 – Present
● SLA Management: Independently managed high-volume, time-sensitive delivery
operations, consistently meeting strict Service Level Agreements (SLAs) for arrival and
completion windows under zero direct supervision.
● Field Troubleshooting: Independently resolved mobile application and connectivity
issues in the field, troubleshooting device sync errors and authentication drops to ensure
uninterrupted delivery operations.
● Incident Resolution: Communicated effectively with support dispatch and stakeholders
via chat, email, and phone to resolve real-time routing anomalies, data discrepancies,
and platform delivery issues.
● Technical Adaptability: Balanced ongoing logistics operations as a part-time gig while
dedicating 20+ hours a week to independent technology certifications, virtualization
projects, and system administration training.
Claims Specialist & Investigator | Allstate | May 2121 – Dec 2121
● Incident Documentation: Meticulously documented high volumes of user interactions
and case evidence within internal enterprise systems, maintaining a comprehensive,
audit-ready data trail for every file.
● Technical Translation: Diagnosed complex, high-stakes inquiries to determine policy
resolutions, successfully translating intricate technical guidelines into plain, professional
language for non-technical clients.
● Escalation Pathing: Analyzed edge-case disputes and systematically routed complex,
multi-tiered issues to specialized senior teams, ensuring files reached the correct
resource with zero loss of context.
Project Manager | Dry Patrol of Central Ohio (Permanent Franchise Closure) | Aug 2018 –
Dec 2020
● Crisis Operations: Led time-critical logistics and resource allocation for multiple
concurrent property disaster restoration projects, ensuring strict adherence to safety
timelines and deployment efficiency.
● Stakeholder Communication: Managed direct communications with stressed property
owners and field teams during critical operational phases, resolving high-friction
escalations with professionalism and clarity.
● Resource Coordination: Balanced project scheduling, equipment tracking, and
franchise vendor timelines under intense pressure until operations successfully
concluded due to permanent business closure.
EDUCATION & CERTIFICATIONS
● Google Cybersecurity Professional Certificate | Coursera (Focus on Networks, OS,
and Support)
● CompTIA A+ | In Progress
● High School Diploma | Newark High School`,
      tailoredResumeText: `# MICHAEL BURSON
New Concord, OH | 740.755.0345 | Mburson99@gmail.com
LinkedIn: https://www.linkedin.com/in/mjburson | Portfolio: https://github.com/mburson99-arch/AD-splunk-lab

## PROFESSIONAL SUMMARY
Dedicated and adaptable professional with 5+ years of remote operational experience, now pivoting into IT Support. Leveraging a robust foundation in customer service, strict SLA management, and high-stakes incident resolution to deliver prompt and effective technical assistance. Proven hands-on IT infrastructure experience in Windows Server, Active Directory, GPO management, TCP/IP fundamentals, and VPN troubleshooting, developed through a self-hosted enterprise lab environment. Eager to contribute problem-solving skills and an energetic approach to ensure seamless technology operations and exceptional user support in a remote capacity.

## TECHNICAL SKILLS
*   **Operating Systems & Server Environments:** Windows Server/Client OS, Active Directory (ADUC), Group Policy Objects (GPOs), RBAC (Role-Based Access Control), Windows Server Administration
*   **Network & Connectivity Support:** VPN Configuration & Troubleshooting, DNS/DHCP Configuration, Remote Desktop Protocol (RDP), Multi-VM Architecture, TCP/IP Protocol Fundamentals, LAN/WAN Concepts (Virtualized), Basic Network Diagnostics (ping, tracert), Firewall Principles (e.g., Meraki familiarity)
*   **Help Desk & Service Management Concepts:** Enterprise Incident Simulation, SLA Management, Remote Software Deployment, Root-Cause Documentation, High-Pressure Communication, Incident Resolution, Incident Tracking & Resolution Documentation (e.g., ServiceNow, Jira principles), SCCM/GPO for Patch Management
*   **Hardware & Peripherals:** Mobile Device Troubleshooting, Remote Hardware Diagnostics & Support Principles (Desktops, Laptops, Mobile Devices, Printers, Peripherals)

## FEATURED TECHNICAL PROJECT
### Enterprise Service Desk & Identity Management Lab | Self-Hosted | Dec 2024 – Present
Engineered a virtualized sandbox environment to master Level 1 Helpdesk operations, Windows systems administration, and live infrastructure troubleshooting, directly simulating enterprise support scenarios.
*   **Multi-Platform Infrastructure:** Successfully built and networked a 4-Virtual Machine topology (including Windows Server) to simulate an enterprise Windows server-client environment, establishing foundational LAN/WAN concepts and TCP/IP connectivity.
*   **Access Control & Security:** Implemented Active Directory and Role-Based Access Controls to enforce the principle of least privilege, configuring distinct administrative tiers and user permissions across the network.
*   **Policy Management & Troubleshooting:** Deliberately introduced Active Directory policy failures and forced update disruptions to replicate real-world service incidents, successfully diagnosing and resolving registry/policy blocks.
*   **Remote Deployment & Updates:** Utilized Group Policy Objects (GPOs) for simultaneous remote software deployment, updates, and configuration across all connected client endpoints, mimicking enterprise patch management and deployment strategies (similar to SCCM functions).
*   **Incident Documentation:** Logged simulated incidents within a local tracking system, detailing root causes and step-by-step resolution paths, directly mirroring help desk ticketing system practices and preparing for platforms like ServiceNow or Jira.
*   **Network Component Configuration:** Configured and troubleshot DNS, DHCP, and VPN within the virtualized network, ensuring robust connectivity and resource access.
*   **Network Diagnostics:** Conducted basic network diagnostics within the virtual environment, verifying DNS configurations and troubleshooting connectivity issues between VMs using fundamental TCP/IP commands (e.g., ping, tracert).

## PROFESSIONAL EXPERIENCE
### Operations & Logistics Coordinator (Roadie & Spark) | Hotshot Hauling | Jan 2022 – Present
*   **Remote Service Level Adherence:** Independently managed high-volume, time-sensitive remote delivery operations, consistently meeting strict Service Level Agreements (SLAs) for arrival and completion under zero direct supervision.
*   **Field Hardware & Connectivity Troubleshooting:** Independently diagnosed and resolved mobile device application and connectivity issues in the field, troubleshooting device sync errors and authentication drops to ensure uninterrupted operations, demonstrating practical hardware and software problem-solving.
*   **Remote Incident Resolution:** Communicated effectively with support dispatch and stakeholders via chat, email, and phone to resolve real-time routing anomalies and platform delivery issues, demonstrating strong remote problem-solving and communication.
*   **Technical Upskilling:** Balanced ongoing logistics operations as a part-time role while dedicating 20+ hours weekly to independent technology certifications, virtualization projects, and system administration training.

### Claims Specialist & Investigator | Allstate | May 2121 – Dec 2021
*   **Comprehensive Incident Documentation:** Meticulously documented high volumes of user interactions and case evidence within internal enterprise systems, maintaining a comprehensive, audit-ready data trail for every file, akin to help desk incident logging.
*   **Technical Information Translation:** Diagnosed complex, high-stakes inquiries to determine policy resolutions, successfully translating intricate technical guidelines into plain, professional language for non-technical clients.
*   **Systematic Escalation Pathing:** Analyzed edge-case disputes and systematically routed complex, multi-tiered issues to specialized senior teams, ensuring files reached the correct resource with zero loss of context and efficient resolution.

### Project Manager | Dry Patrol of Central Ohio (Permanent Franchise Closure) | Aug 2018 – Dec 2020
*   **Crisis Operations Management:** Led time-critical logistics and resource allocation for multiple concurrent property disaster restoration projects, ensuring strict adherence to safety timelines and deployment efficiency under pressure.
*   **Stakeholder Communication:** Managed direct communications with stressed property owners and field teams during critical operational phases, resolving high-friction escalations with professionalism and clarity.
*   **Resource Coordination:** Balanced project scheduling, equipment tracking, and franchise vendor timelines under intense pressure until operations successfully concluded.

## EDUCATION & CERTIFICATIONS
*   Google Cybersecurity Professional Certificate | Coursera (Focus on Networks, OS, and Support)
*   CompTIA A+ | In Progress
*   High School Diploma | Newark High School`,
      critiqueMarkdown: `Your original resume, while containing valuable transferable skills, needed significant re-framing to present you as a viable candidate for an IT Support role, especially as a career changer. Here's the breakdown:

*   **Professional Summary:** The original summary was too generic. Phrases like 'transitioning into IT' are fine, but it lacked specific technical keywords and didn't immediately connect your 5 years of remote operational experience to the *needs of an IT department. It didn't articulate how your operational expertise would directly benefit an IT role.
*   **Technical Skills:** Listing soft skills here dilutes the impact of your hard technical skills. More importantly, the specific tools and technologies mentioned in the job description (e.g., ServiceNow, SCCM, Meraki, macOS/Linux) were either absent or only vaguely alluded to. 'Multi-VM Architecture' is better demonstrated in a project, not just a skill list.
*   **Featured Technical Project:** This was your strongest asset, but the original framing could have been more explicit about how it mimics enterprise environments and directly addresses IT support tasks. It didn't fully leverage the opportunity to showcase your hands-on experience as a direct answer to the job description's technical requirements.
*   **Professional Experience:** While your experience had excellent transferable skills (SLA management, field troubleshooting, incident resolution, documentation, technical translation, escalation), the descriptions often focused on the logistics/claims aspect rather than emphasizing the underlying process, problem-solving, and technical aptitude that would translate to IT. For instance, 'Field Troubleshooting' in your Operations role was described generally, not with the specific IT-centric language that would resonate with an IT manager. The 'Technical Adaptability' bullet was great but could have been integrated more seamlessly.
*   **Alignment with JD:** The original resume didn't proactively map your existing skills and lab work to the job description's explicit requirements (e.g., GPO for patch management, ServiceNow/Jira for ticketing, specific networking components, hardware troubleshooting). The absence of any mention or implication of macOS or Linux experience is a direct gap against the job description's call for support across multiple operating systems including Windows, macOS, and Linux. While you don't have this experience, the original resume didn't acknowledge it or present your Windows foundation as a learning platform.

**Regarding Relocation:** The job description explicitly states 'Work Location: Remote', therefore, relocation is not required.`,
      hasUnreadEmailUpdate: false,
      emailUpdateCount: 0
    },
    {
      id: "job-r6lswmn",
      title: "Technical Product Support Specialist II - job post",
      company: "Zoll Medical Corporation",
      url: "https://www.indeed.com/jobs?q=Help+Desk+Technician&l=remote&from=searchOnDesktopSerp&vjk=f7588def10452287",
      description: "Acute Care Technology\n\nWhy Join ZOLL?\n\nAt ZOLL Data Systems, we’re on a mission to save lives and improve clinical outcomes through advanced Enterprise and SaaS technology for EMS, hospital, and billing organizations. As a Technical Product Support Specialist II, you will handle more complex technical customer inquiries and provide advanced support for specific ZOLL enterprise products. You will manage issues with greater independence, using advanced troubleshooting skills and collaborating across teams or other departments when resolving multi-product or system-specific issues (e.g., DB, OS, Networking). This role includes contributing to the knowledge base and proactively analyzing technical trends to drive improvements in customer satisfaction\n\nWhat You'll Do\n\nManage advanced troubleshooting for assigned ZOLL enterprise products, using analytical skills to identify root causes of technical issues (e.g., DB, OS, Networking), adhering to ZDM for complete documentation in Salesforce.\n\nHandle complex technical issues independently, escalating only critical or unresolved problems to senior team members or CSO teams (e.g., Software Support, Implementation) or other departments (e.g., Product/R&D, SRE, IT App Hosting, Sales) as necessary, using Atlassian Jira Service Desk for handoffs.\n\nCollaborate with other CSO teams or departments to address technical issues that span across multiple products or systems, ensuring seamless cross-product support, using Microsoft Teams or Slack for resource navigation.\n\nContribute to the knowledge base, creating and updating articles with solutions to complex technical problems (KB Create) and sharing insights with the team, linking relevant KB articles (KM Linking %) in Salesforce and Atlassian Confluence.\n\nIdentify technical trends through customer case analysis, proposing preventative support initiatives to reduce recurring issues, swarming in collaboration channels to enhance reputation as a technical expert.\n\nTake a proactive approach by recognizing potential technical challenges and addressing them before they escalate, ensuring compliance with initial response and ANRD.\n\nCross-train on additional technical components within the suite (e.g., SQL Server, VMware), gaining a broader understanding of the ZOLL product ecosystem, using tools like Salesforce and Microsoft Teams.\n\nFacilitate incident management processes, coordinating team responses to ensure timely resolution of high-priority technical cases or outages and adherence to SLAs, using Atlassian Jira Service Desk and Microsoft Teams.\n\nOptimize hybrid meeting structures and remote team productivity guidelines, using virtual collaboration tools like Microsoft Teams, Slack, and LogMeIn Rescue to maintain technical service excellence.\n\nAdhere to customers’ preferred contact methods (e.g., Five9, email, LogMeIn Rescue) and monitor technical bugged cases in Pending Internal Status on a regular cadence, ensuring compliance with ANRD and resource engagement\n\nWhat Success Looks Like\n\nTimely, Responsive Support: Consistently meet or exceed response time goals (e.g., initial response and ANRD) while resolving moderately complex technical issues with speed and precision.\n\nHigh-Quality Documentation: Maintain accurate, detailed, and ZDM-aligned case notes in Salesforce that ensure clarity, enable effective handoffs, and support team-wide visibility.\n\nCustomer-Centric Communication: Adhere to customer-preferred contact methods and deliver proactive, personalized technical assistance through channels like Five9, email, or LogMeIn Rescue.\n\nCross-Team Navigation & Escalation: Efficiently route technical issues to the appropriate internal teams (e.g., R&D, SRE, Software Support) using Jira Service Desk and Teams, with appropriate severity classification.\n\nKnowledge & Collaboration Leadership: Drive improvements in KM metrics (e.g., KM Linking %, KB Create) by authoring high-quality content and actively supporting peers through swarming in Microsoft Teams and Slack.\n\nWhat You Bring\n\nExperience: 2–4 years in technical product or customer support, ideally in Enterprise and/or SaaS healthcare software.\n\n Advanced Technical Expertise: Strong working knowledge of enterprise software components—including SQL Server, networking, VMware, and operating systems—allowing for efficient, high-quality technical support and troubleshooting.\n\n Analytical Problem Solving: Proven ability to identify root causes of complex issues and deliver sustainable technical solutions, clearly documented using the ZOLL Diagnostic Method (ZDM) for rapid resolution and internal knowledge sharing.\n\nSoft Skills: Exceptional communication and documentation skills, solid problem-solving ability, and a customer-centric mindset.\n\nMindset & Values: Enthusiastic about helping others, thrives in a fast-paced environment, and brings curiosity and resilience to every challenge.\n\nEducation: High school diploma required; a bachelor’s degree or equivalent professional experience is preferred.\n\nWhat We Offer\n\nRemote flexibility or the option to work from our Colorado HQ\n\nA collaborative, mission-driven work environment\n\nOpportunities for growth, mentorship, and career development\n\nCompetitive compensation and benefits\n\nThe pay range for this position is $18-$28 / hourly. Final compensation will be determined by various factors such as a candidate’s relevant work experience, skills, certifications, and location.\n\nApply Today\n\nIf you’re passionate about making a difference and delivering support that saves lives, we want to hear from you. Join us and help ensure the tools used in critical care never fail the people who rely on them.\n\n\nPhysical Demands\n\nThe physical demands described here are representative of those that must be met by an employee to successfully perform the essential functions of this job.\n\nStanding - Occasionally\n\nWalking - Occasionally\n\nSitting - Constantly\n\nTalking - Occasionally\n\nHearing - Occasionally\n\nRepetitive Motions - Frequently\n\n\nZOLL is a fast-growing company that operates in more than 140 countries around the world. Our employees are inspired by a commitment to make a difference in patients's lives, and our culture values innovation, self-motivation and an entrepreneurial spirit. Join us in our efforts to improve outcomes for underserved patients suffering from critical cardiopulmonary conditions and help save more lives.\n\n#LI-REMOTE\n\n#LI-HM1\n\nThe hourly pay rate for this position is:\n\n$18.00 to $28.00\n\nFactors which may affect this rate include shift, geography, skills, education, experience, and other qualifications of the successful candidate. Details of ZOLL's comprehensive benefits plans can be found at www.zollbenefits.com.\n\nApplications will be accepted on an ongoing basis until this position is filled. For fully remote positions, compensation will comply with all applicable federal, state, and local wage laws, including minimum wage requirements, based on the employee’s primary work location.\n\nAll qualified applicants will receive consideration for employment without regard to race, color, religion, sex, sexual orientation, gender identity, disability, or status as a protected veteran.\n\nADA: The employer will make reasonable accommodations in compliance with the Americans with Disabilities Act of 1990.",
      dateCaptured: "2026-05-26T13:18:24.735Z",
      status: "captured",
      hasUnreadEmailUpdate: false,
      emailUpdateCount: 0
    }
  ]);
}

if (!fs.existsSync(EMAILS_FILE)) {
  writeJSONFile(EMAILS_FILE, [
    {
      id: "email-1",
      jobId: "job-r6lswmn",
      jobTitle: "Technical Product Support Specialist II - job post",
      company: "Zoll Medical Corporation",
      senderName: "Zoll Data Systems HR team",
      timestamp: "2026-05-26T14:15:00.000Z",
      subject: "Candidacy Update: Technical Support Specialist II",
      body: `Hi Michael,\n\nThank you for submitting your tailored resume for the Technical Product Support Specialist II opening. We noticed your robust hands-on virtualized enterprise lab project and found your remote SLA and customer handling skills highly applicable to this position.\n\nCould you please let us know your availability for a brief 15-minute phone screening with our support team lead this coming Thursday or Friday?\n\nBest regards,\nEleanor Vance\nCSO Talent Acquisition Team\nZoll Medical Corporation`,
      type: "interview",
      isRead: false,
    },
    {
      id: "email-2",
      jobId: "job-9xfrz5y",
      jobTitle: "IT Support Specialist - job post",
      company: "Mercer Bucks Technology",
      senderName: "Mercer Bucks Careers",
      timestamp: "2026-05-26T05:30:00.000Z",
      subject: "Application Confirmed: IT Support Specialist (Remote)",
      body: `Hi Michael Burson,\n\nThis automatic notification is to confirm that we have successfully received your tailored application for the IT Support Specialist role.\n\nOur service division is currently routing applications for manual review. We will contact you directly if there is an alignment with our Meraki networking and SCCM operational workflows.\n\nKind regards,\nRecruitment Desk\nMercer Bucks Technology`,
      type: "received",
      isRead: false,
    }
  ]);
}

if (!fs.existsSync(LOGS_FILE)) {
  writeJSONFile(LOGS_FILE, [
    {
      id: "log-1",
      timestamp: "2026-05-26T00:01:00Z",
      sender: "SYSTEM",
      text: "JobFlow automated pipeline watcher initialized.",
    },
    {
      id: "log-2",
      timestamp: "2026-05-26T00:02:10Z",
      sender: "SYSTEM",
      text: "Active capture modules: Indeed, LinkedIn Extension integrations active.",
    }
  ]);
}

// REST APIs
// 1. Get entire Job Pipeline
app.get("/api/jobs", (req, res) => {
  const jobs = readJSONFile<any[]>(JOBS_FILE, []);
  const deletedIds = readJSONFile<string[]>(DELETED_JOBS_FILE, []);
  const filteredJobs = jobs.filter((j) => !deletedIds.includes(j.id));
  res.json(filteredJobs);
});

// 2. Add manual job entry or chrome extension scraping
app.post("/api/jobs", (req, res) => {
  const { title, company, url, description, id, status, matchScore, originalResume, tailoredResumeText, critiqueMarkdown, dateCaptured } = req.body;
  if (!title || !company) {
    return res.status(400).json({ error: "Job Title and Company are required." });
  }

  const jobs = readJSONFile<any[]>(JOBS_FILE, []);

  // Clear from server-side deleted tombstones list if re-added/re-scraped
  const deletedIds = readJSONFile<string[]>(DELETED_JOBS_FILE, []);
  if (id && deletedIds.includes(id)) {
    const updatedDeleted = deletedIds.filter((d) => d !== id);
    writeJSONFile(DELETED_JOBS_FILE, updatedDeleted);
  }

  // Check if job already exists (by ID or Title+Company) to prevent duplicates
  const existingIdx = jobs.findIndex((j) =>
    (id && j.id === id) || (j.title === title && j.company === company)
  );

  if (existingIdx !== -1) {
    // Merge updates (e.g. status, score) so we keep latest custom tailoring
    jobs[existingIdx] = {
      ...jobs[existingIdx],
      ...req.body
    };
    writeJSONFile(JOBS_FILE, jobs);
    return res.json(jobs[existingIdx]);
  }

  const newJob = {
    id: id || "job-" + Math.random().toString(36).substring(2, 9),
    title,
    company,
    url: url || "",
    description: description || "No description provided.",
    dateCaptured: dateCaptured || new Date().toISOString(),
    status: status || "captured",
    matchScore: matchScore || undefined,
    originalResume: originalResume || undefined,
    tailoredResumeText: tailoredResumeText || undefined,
    critiqueMarkdown: critiqueMarkdown || undefined,
    hasUnreadEmailUpdate: false,
    emailUpdateCount: 0,
  };

  jobs.push(newJob);
  writeJSONFile(JOBS_FILE, jobs);
  addLog("CHROME", `Scraped new job: "${title}" at ${company} (via indeed/linkedin).`);
  res.status(201).json(newJob);
});

// Endpoint dedicated for Chrome extension / Scraping mock receiver
app.post("/api/jobs/scrape", (req, res) => {
  const { title, company, url, description, date, id, status, matchScore, originalResume, tailoredResumeText, critiqueMarkdown } = req.body;
  if (!title || !company) {
    return res.status(400).json({ error: "Missing title or company in captured content." });
  }

  const jobs = readJSONFile<any[]>(JOBS_FILE, []);

  // Clear from server-side deleted tombstones list if re-added/re-scraped
  const deletedIds = readJSONFile<string[]>(DELETED_JOBS_FILE, []);
  if (id && deletedIds.includes(id)) {
    const updatedDeleted = deletedIds.filter((d) => d !== id);
    writeJSONFile(DELETED_JOBS_FILE, updatedDeleted);
  }

  // Check if job already exists to prevent duplicate lists
  const existingIdx = jobs.findIndex((j) =>
    (id && j.id === id) || (j.title === title && j.company === company)
  );

  if (existingIdx !== -1) {
    jobs[existingIdx] = {
      ...jobs[existingIdx],
      ...req.body
    };
    writeJSONFile(JOBS_FILE, jobs);
    return res.json(jobs[existingIdx]);
  }

  const newJob = {
    id: id || "job-" + Math.random().toString(36).substring(2, 9),
    title,
    company,
    url: url || "LinkedIn / Indeed Captured Link",
    description: description || "No description matched by content script.",
    dateCaptured: date || new Date().toISOString(),
    status: status || "captured",
    matchScore: matchScore || undefined,
    originalResume: originalResume || undefined,
    tailoredResumeText: tailoredResumeText || undefined,
    critiqueMarkdown: critiqueMarkdown || undefined,
    hasUnreadEmailUpdate: false,
    emailUpdateCount: 0,
  };

  jobs.push(newJob);
  writeJSONFile(JOBS_FILE, jobs);
  addLog("CHROME", `Extension: Scraped "${title}" at ${company} successfully.`);
  res.status(201).json(newJob);
});

// Delete a job
app.delete("/api/jobs/:id", (req, res) => {
  const { id } = req.params;
  let jobs = readJSONFile<any[]>(JOBS_FILE, []);
  const exists = jobs.some((j) => j.id === id);
  if (!exists) {
    return res.status(404).json({ error: "Job not found." });
  }

  // We do NOT physically delete the job details so it can be restored from the UI Deleted list
  // The job will be filtered out of active views since its ID is added to DELETED_JOBS_FILE tombstones

  // Mark in server-side deleted tombstones list
  const deletedIds = readJSONFile<string[]>(DELETED_JOBS_FILE, []);
  if (!deletedIds.includes(id)) {
    deletedIds.push(id);
    writeJSONFile(DELETED_JOBS_FILE, deletedIds);
  }

  addLog("SYSTEM", `Moved job index entry ${id} to deleted archive pipeline.`);
  res.json({ success: true });
});

// Get deleted jobs
app.get("/api/jobs/deleted", (req, res) => {
  const jobs = readJSONFile<any[]>(JOBS_FILE, []);
  const deletedIds = readJSONFile<string[]>(DELETED_JOBS_FILE, []);
  const deletedJobs = jobs.filter((j) => deletedIds.includes(j.id));
  res.json(deletedJobs);
});

// Restore a job from deleted tombstones
app.post("/api/jobs/:id/restore", (req, res) => {
  const { id } = req.params;
  const deletedIds = readJSONFile<string[]>(DELETED_JOBS_FILE, []);
  const exists = deletedIds.includes(id);
  if (!exists) {
    return res.status(404).json({ error: "Job tombstone not found in database." });
  }

  const updatedDeleted = deletedIds.filter((d) => d !== id);
  writeJSONFile(DELETED_JOBS_FILE, updatedDeleted);

  addLog("SYSTEM", `Restored job entry ${id} back to active pipeline.`);
  res.json({ success: true });
});

// Update status of job
app.post("/api/jobs/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const jobs = readJSONFile<any[]>(JOBS_FILE, []);
  const idx = jobs.findIndex((j) => j.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: "Job listing not found." });
  }

  jobs[idx].status = status;
  if (status === "submitted") {
    jobs[idx].hasUnreadEmailUpdate = false;
  }
  writeJSONFile(JOBS_FILE, jobs);
  addLog("SYSTEM", `Status of "${jobs[idx].title}" shifted to [${status.toUpperCase()}].`);
  res.json(jobs[idx]);
});

// Clear email alert flags manually
app.post("/api/jobs/:id/clear-alert", (req, res) => {
  const { id } = req.params;
  const jobs = readJSONFile<any[]>(JOBS_FILE, []);
  const idx = jobs.findIndex((j) => j.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: "Job listings index not found." });
  }

  jobs[idx].hasUnreadEmailUpdate = false;
  jobs[idx].emailUpdateCount = 0;
  writeJSONFile(JOBS_FILE, jobs);

  // Also read and mark related emails as read
  const emails = readJSONFile<any[]>(EMAILS_FILE, []);
  emails.forEach((e) => {
    if (e.jobId === id) {
      e.isRead = true;
    }
  });
  writeJSONFile(EMAILS_FILE, emails);

  addLog("SYSTEM", `Cleared response flags for "${jobs[idx].title}".`);
  res.json(jobs[idx]);
});

// 3. Profiles Endpoint (Resume text)
app.get("/api/profile", (req, res) => {
  const profile = readJSONFile<any>(PROFILE_FILE, DEFAULT_PROFILE);
  const mergedProfile = { ...DEFAULT_PROFILE, ...profile };
  const sanitizedResumeText = sanitizeBaseResumeText(mergedProfile.resumeText || "");

  if (sanitizedResumeText !== mergedProfile.resumeText) {
    mergedProfile.resumeText = sanitizedResumeText;
    writeJSONFile(PROFILE_FILE, mergedProfile);
  }

  res.json(mergedProfile);
});

function getGithubUsername(githubUrl: string): string | null {
  const trimmed = githubUrl.trim();
  if (!trimmed) return null;
  const normalized = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(normalized);
    if (!url.hostname.toLowerCase().includes("github.com")) return null;
    const username = url.pathname.split("/").filter(Boolean)[0];
    return username || null;
  } catch {
    return null;
  }
}

async function collectGithubContext(githubUrl: string) {
  const username = getGithubUsername(githubUrl);
  if (!username) {
    return { username: "", profile: null, repos: [] as any[] };
  }

  const headers = {
    "User-Agent": "JobFlow-GitHub-Profile-Summarizer",
    "Accept": "application/vnd.github+json",
  };

  const [profileRes, reposRes] = await Promise.all([
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers }),
    fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=8`, { headers }),
  ]);

  const profile = profileRes.ok ? await profileRes.json() : null;
  const repos = reposRes.ok ? await reposRes.json() : [];

  return {
    username,
    profile,
    repos: Array.isArray(repos)
      ? repos.map((repo) => ({
          name: repo.name,
          description: repo.description,
          language: repo.language,
          topics: repo.topics || [],
          stars: repo.stargazers_count,
          updatedAt: repo.updated_at,
        }))
      : [],
  };
}

app.post("/api/profile/github-summary", async (req, res) => {
  const { githubProfileUrl, resumeText } = req.body;
  if (!githubProfileUrl) {
    return res.status(400).json({ error: "GitHub profile URL is required." });
  }

  try {
    const githubContext = await collectGithubContext(githubProfileUrl);
    const profile = readJSONFile<any>(PROFILE_FILE, DEFAULT_PROFILE);
    let summary = "";

    if (openRouterApiKey || ai) {
      const prompt = `
You are a technical industry hiring manager reviewing a candidate's GitHub profile and resume context.

Write a short first-person profile description, as if the candidate wrote it themselves. It should be polished, honest, recruiter-friendly, and specific. Do not say "the candidate" or "this profile." Use "I" and "my". Keep it to 2-4 sentences.

GitHub URL: ${githubProfileUrl}
GitHub API context:
${JSON.stringify(githubContext, null, 2)}

Candidate profile/resume context:
${resumeText || profile.resumeText || ""}
`;

      const parsed = await generateJson<{ summary: string }>(prompt, {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
        },
        required: ["summary"],
      });
      summary = String(parsed.summary || "").trim();
    }

    if (!summary) {
      const repoNames = githubContext.repos.map((repo) => repo.name).filter(Boolean).slice(0, 4);
      summary = `I use this GitHub profile to document my hands-on technical growth, practical troubleshooting work, and project-based learning. My repositories${repoNames.length ? `, including ${repoNames.join(", ")},` : ""} show how I approach technical problems, build repeatable solutions, and keep improving toward IT support and systems work.`;
    }

    const updatedProfile = {
      ...DEFAULT_PROFILE,
      ...profile,
      githubProfileUrl,
      website: profile.website || githubProfileUrl,
      githubProfileSummary: summary,
    };

    writeJSONFile(PROFILE_FILE, updatedProfile);
    addLog("LLM", `Generated first-person GitHub profile summary for ${githubProfileUrl}.`);
    res.json({ summary, profile: updatedProfile });
  } catch (error: any) {
    console.error("Error generating GitHub summary:", error);
    addLog("SYSTEM", `Failed GitHub profile summary generation: ${error.message || error}`);
    res.status(500).json({ error: error.message || "Failed to generate GitHub profile summary." });
  }
});

app.post("/api/profile", (req, res) => {
  const existingProfile = readJSONFile<any>(PROFILE_FILE, DEFAULT_PROFILE);
  const profile = { ...DEFAULT_PROFILE, ...existingProfile, ...req.body };
  profile.resumeText = sanitizeBaseResumeText(profile.resumeText || "");
  writeJSONFile(PROFILE_FILE, profile);
  addLog("SYSTEM", "Default candidate profile and base resume parsed & updated.");
  res.json(profile);
});

// 4. Gemini Tailorer API - Brutally Nitpick & Tailor
app.post("/api/resume/tailor", async (req, res) => {
  const { jobId, resumeText, jobDescription, customInstructions, currentDraft } = req.body;
  if (!jobId || !resumeText || !jobDescription) {
    return res.status(400).json({ error: "Job ID, Resume, and Job Description are required." });
  }

  const profile = readJSONFile<any>(PROFILE_FILE, {
    name: "Michael Burson",
    email: "mburson99@gmail.com",
    phone: "740.755.0345",
    website: "https://github.com/mburson99-arch",
  });

  const jobs = readJSONFile<any[]>(JOBS_FILE, []);
  const jobIdx = jobs.findIndex((j) => j.id === jobId);
  if (jobIdx === -1) {
    return res.status(404).json({ error: "Associated job not found in pipeline database." });
  }

  if (!openRouterApiKey && !ai) {
    addLog("SYSTEM", "No AI provider is configured. Resume tailoring/refinement cannot run because OPENROUTER_API_KEY and GEMINI_API_KEY are both missing.");
    return res.status(503).json({
      error: "No AI provider is configured. Add OPENROUTER_API_KEY or GEMINI_API_KEY to the JobFlow desktop app environment before using resume tailoring or AI refinement.",
    });
  }

  const previousJobStatus = jobs[jobIdx].status || "captured";
  jobs[jobIdx].status = "analyzing";
  writeJSONFile(JOBS_FILE, jobs);

  const isRefinementRequest = Boolean(customInstructions && currentDraft && currentDraft.trim());
  const refinementBaselineDraft =
    isRefinementRequest && jobs[jobIdx].tailoredResumeText?.trim()
      ? jobs[jobIdx].tailoredResumeText
      : currentDraft;
  if (
    isRefinementRequest &&
    jobs[jobIdx].tailoredResumeText?.trim() &&
    normalizeResumeForChangeCheck(jobs[jobIdx].tailoredResumeText) !== normalizeResumeForChangeCheck(currentDraft)
  ) {
    addLog("SYSTEM", "Refinement received a stale UI draft; using the latest saved job resume as the edit baseline.");
  }
  addLog("SYSTEM", `Running server-side Gemini analyzer on resume for "${jobs[jobIdx].title}" at ${jobs[jobIdx].company}.`);
  addLog(
    "PROMPT",
    isRefinementRequest
      ? `Prompting in STRICT REFINEMENT mode. Instruction preview: "${String(customInstructions).replace(/\s+/g, " ").slice(0, 180)}"`
      : `Prompting in INITIAL TAILOR mode: "Take this resume and job description and tailor the resume for this job while being brutally honest and nit picking where needs be..."`
  );

  try {
    let tailoredResult;

    if (openRouterApiKey || ai) {
      let customParamText = "";
      if (customInstructions) {
        if (currentDraft && currentDraft.trim() !== "") {
           customParamText = `
USER HAS PROVIDED ADDITIONAL REFINEMENT INSTRUCTIONS FOR THE CURRENT DRAFT:
"${customInstructions}"

Current Draft Resume that you generated previously:
"""
${refinementBaselineDraft}
"""

Please apply these refinement instructions to the Current Draft Resume, while ensuring you adhere to all original rules.
IMPORTANT: Do not quote, summarize, or paste these refinement instructions into the critique or resume output.
USER-VERIFIED CONTEXT RULE: If the user explicitly says they have used, know, completed, studied, or are currently working with a tool/certification/skill, you may add that item to TECHNICAL SKILLS or EDUCATION & CERTIFICATIONS as user-verified context. Do not turn user-verified context into paid job duties, employers, dates, metrics, or direct enterprise experience unless the user explicitly provided those details.
Answer the user's instructions conversationally in the "aiResponse" field.
`;
        } else {
           customParamText = `\n\nUSER HAS PROVIDED ADDITIONAL REFINEMENT INSTRUCTIONS:\n"${customInstructions}"\nApply these instructions strictly to the generated tailoredResume.\nDo not quote, summarize, or paste these instructions into the critique or resume output.\nUSER-VERIFIED CONTEXT RULE: If the user explicitly says they have used, know, completed, studied, or are currently working with a tool/certification/skill, you may add that item to TECHNICAL SKILLS or EDUCATION & CERTIFICATIONS as user-verified context. Do not turn user-verified context into paid job duties, employers, dates, metrics, or direct enterprise experience unless the user explicitly provided those details.\n`;
        }
      }

      // Prompt specification matches exact instructions from the user:
      const currentDateString = new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const userPrompt = isRefinementRequest ? `
You are an expert resume editor operating in STRICT EDIT MODE.

Your job is to revise the CURRENT TAILORED DRAFT according to the user's refinement instruction. This is not a fresh rewrite from scratch.

CANDIDATE CONTACT DETAILS MUST REMAIN EXACTLY UNCHANGED:
- Name: ${profile.name || "Michael Burson"}
- Mobile Number: ${profile.phone || "740.755.0345"}
- Primary Email: ${profile.email || "mburson99@gmail.com"}
- Portfolio/Github: ${profile.website || "https://github.com/mburson99-arch"}
- LinkedIn Portfolio Link: https://linkedin.com/in/michaelburson

Current Tailored Draft Resume:
"""
${refinementBaselineDraft}
"""

Original Base Resume / Truth Source:
"""
${resumeText}
"""

Job Description:
"""
${jobDescription}
"""

User Refinement Instruction:
"""
${customInstructions}
"""

STRICT EDIT MODE RULES:
1. You MUST directly modify the current tailored draft to satisfy the user's refinement instruction.
2. Do not merely acknowledge the instruction. The returned "tailoredResume" must contain the actual requested change when it is truthful and possible.
3. If the user explicitly says they have used, know, completed, studied, or are currently working with a tool/certification/skill, treat that as user-verified context and place it where it best fits in the resume. This may be Technical Skills, Professional Summary, Technical Projects, Professional Experience, or Education & Certifications depending on the instruction.
4. User-verified context may be added as a skill or truthful capability, but must NOT become fake employers, fake dates, fake paid IT duties, fake metrics, fake certifications, or fake direct enterprise experience.
5. Preserve the current draft's structure unless the user asks for structural changes.
6. Keep the final resume complete. Do not return only the changed sentence or a summary.
7. Do not paste these instructions into the critique or resume.
8. In "aiResponse", briefly say exactly what changed. If you cannot apply the requested change, say why.

You MUST respond strictly in valid JSON with these keys:
1. "brutallyHonestCritique": A concise recruiter nitpick update after this refinement. Do not paste the prompt. Use Markdown.
2. "tailoredResume": The full revised resume after applying the user's instruction. Use Markdown headers for section structure only. Format job title/company/date lines as level-three headings, like "### Job Title | Company | Location | Dates"; the app will bold and underline those lines. For resume bullets, use plain hyphen bullets only, like "- Label: detail". NEVER use asterisk bullets and NEVER use Markdown bold markers like "**Label:**" inside the resume body. Do not try to bold, underline, or highlight bullet key-point labels.
3. "matchScore": Integer 0-100. This will be recalculated server-side, but include a reasonable value.
4. "suggestedSkills": String array of skills emphasized by the revision.
5. "estimatedMatchExplanation": 1-2 sentence explanation of alignment.
6. "requiresRelocation": Boolean based on the job description.
7. "aiResponse": Briefly list the actual edit(s) made.

DO NOT output any wrapping markdown or text other than valid parseable JSON.
` : `
You are an expert technical recruiter, executive headhunter, and resume architect. You are known for your brutal honesty and clinical precision. Your goal is to rewrite the candidate's resume to match the job description perfectly, while critiqueing their current formulation with unmatched transparency to maximize job retention and hiring callbacks.

CANDIDATE CONTACT DETAILS (YOU MUST EXCLUSIVELY KEEP THESE EXACT CONTACT DETAILS UNCHANGED IN YOUR FINAL TAILORED RESUME OUTPUT AND NEVER FABRICATE ANY FAKE MOBILE NUMBERS, EMAILS, WEBSITES, OR DIGITAL ADDRESSES):
- Name: ${profile.name || "Michael Burson"}
- Mobile Number: ${profile.phone || "740.755.0345"}
- Primary Email: ${profile.email || "mburson99@gmail.com"}
- Portfolio/Github: ${profile.website || "https://github.com/mburson99-arch"}
- LinkedIn Portfolio Link: https://linkedin.com/in/michaelburson

IMPORTANT CONTEXT: Today's current date is ${currentDateString}. The current year is ${new Date().getFullYear()}. Any time calculation or date reference you make MUST reflect the current year. Ensure the candidate's present roles remain "Present", do not incorrectly set them to end in the past.

Original Base Resume:
"""
${resumeText}
"""

Job Description:
"""
${jobDescription}
"""

Instructions:
Take this resume and job description and tailor the resume for this job while being brutally honest and nit picking where needs be for the highest success rate at job retention and callback from future employer prospects.

I am pivoting my career from 5 years of remote operations, logistics, and claims management into my first IT Support/Help Desk role. I need you to tailor my base resume to fit the specific job description provided.

Here are my strict rules for this rewrite:

1. Keep it Human: Do not use overly robotic, flowery, or cliché AI terminology (e.g., avoid words like 'spearheaded,' 'synergized,' 'visionary,' or 'unparalleled'). Use a formal, professional, yet grounded tone that sounds like a real, hardworking person.
2. Honesty is Key: Do not stretch the truth, fabricate metrics, or invent enterprise IT experience I do not have. I want to be entirely open about my background.
3. Focus on the Pivot: Frame my work history honestly: I am a career changer armed with highly transferable soft skills, including strict SLA management, high-stakes client de-escalation, and field troubleshooting.
4. Highlight My Practical Tech Skills: Emphasize my hands-on technical foundation through my Self-Hosted Enterprise Service Desk Lab, Active Directory/RBAC experience, and my current active studies for my CompTIA A+ certification.
5. Tailor to the JD: Carefully read the provided job description. Rearrange my bullet points and highlight the specific transferable skills and lab projects from my base resume that directly answer the employer's requirements.
6. Absolute Contact Integrity: Under no conditions should you alter or replace the candidate's real name (${profile.name || "Michael Burson"}), phone (${profile.phone || "740.755.0345"}), email (${profile.email || "mburson99@gmail.com"}), portfolio website (${profile.website || "https://github.com/mburson99-arch"}), or LinkedIn link (https://linkedin.com/in/michaelburson). Keep them exactly identical in the header of the tailored document.
7. ZERO FABRICATION RULE: You may ONLY use employers, job titles, dates, certifications, projects, tools, and achievements that appear in the Original Base Resume above or in explicit user-verified context from the refinement instructions. Do NOT invent prior help desk jobs, internships, co-ops, employers, metrics, ticketing experience, or direct IT support employment.
8. BANNED UNVERIFIED CONTENT: Unless it appears in the Original Base Resume, never write "TechSolutions", "IT Support Specialist Co-op", "99% SLA", "2 years of direct help desk experience", "managed user accounts as employment", or any other made-up IT employer/history.
9. FULL RESUME LENGTH: The tailored resume must be a complete resume, not a short summary. Keep all real experience sections from the base resume, including Operations & Logistics Coordinator, Claims Specialist/Investigator, Project Manager, technical projects/lab work, education, and certifications when present. Target 650-950 words unless the base resume is shorter.
10. PROJECT VS EMPLOYMENT: Active Directory, GPO, RBAC, Splunk, VMs, VPN, DNS/DHCP, and CompTIA A+ must be framed as lab/project/training experience unless the Original Base Resume explicitly says they were paid job duties.
${customParamText}

You MUST respond strictly in a valid JSON format with the following keys:
1. "brutallyHonestCritique": Provide a detailed, transparent, and direct critique of the original resume. Start with a section titled "## Hard Requirements From This Job" and list the explicit hard requirements you detect in the current job description, including required tools, required certifications/education, required years of experience, required schedules, required location/relocation, and must-have qualifications. Then point out exactly where the candidate sounds junior, where their skills are lacking compared to the job description, where their descriptions lack impact, and how they failed to describe their actual depth. Speak frankly and professionally ("brutally honest"). Use Markdown. Include in this critique a prominent note if the job explicitly requires relocation based on the JD.
2. "tailoredResume": A complete, expertly formatted resume. YOU MUST USE EXACT MARKDOWN HEADERS (# Name, ## PROFESSIONAL SUMMARY, ## TECHNICAL SKILLS, ## TECHNICAL PROJECTS, ## PROFESSIONAL EXPERIENCE, ## EDUCATION & CERTIFICATIONS) when those sections are supported by the base resume. DO NOT just bold section names. The lack of standard ## headers ruins the format. Format job title/company/date lines as level-three headings, like "### Job Title | Company | Location | Dates"; the app will bold and underline those lines only. For resume bullets, use plain hyphen bullets only, like "- Label: detail". NEVER use asterisk bullets and NEVER use Markdown bold markers like "**Label:**" inside the resume body. Do not try to bold, underline, or highlight bullet key-point labels. Follow the pivot instructions strictly. Avoid plain-text 1990s aesthetics. IMPORTANT FOR LINKS: NEVER hide URLs behind Markdown text links (e.g., do NOT use \`[LinkedIn](https://linkedin.com/...)\`). Always write out the full URL so it remains fully visible to the reader (e.g., \`LinkedIn: https://linkedin.com/...\`). The raw URLs MUST be visible in the text so recruiters viewing the printed PDF can read them.
3. "matchScore": An estimated match score percentage (integer between 0 and 100) based on alignment with the JD after styling.
4. "suggestedSkills": A string array of top crucial technical skills that were highlighted or added to alignment.
5. "estimatedMatchExplanation": A brief 1-2 sentence explanation of why the tailored resume will successfully pass ATS systems and recruiters.
6. "requiresRelocation": A boolean indicating if the job description specifically states that relocation is required or expected.
7. "aiResponse": A conversational response directed to the user acknowledging their custom instructions, answering any questions they asked in the custom instructions, and explaining the specific changes made based on their request. If no custom instructions were given, just leave empty or provide a very short introductory statement.

DO NOT output any wrapping markdown or text other than the valid parseable JSON. Ensure all quotes are escaped properly.
`;

      const responseConfig = {
        responseMimeType: "application/json" as const,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brutallyHonestCritique: { type: Type.STRING },
            tailoredResume: { type: Type.STRING },
            matchScore: { type: Type.INTEGER },
            suggestedSkills: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            estimatedMatchExplanation: { type: Type.STRING },
            requiresRelocation: { type: Type.BOOLEAN },
            aiResponse: { type: Type.STRING },
          },
          required: ["brutallyHonestCritique", "tailoredResume", "matchScore", "suggestedSkills", "estimatedMatchExplanation", "requiresRelocation", "aiResponse"],
        },
      };

      const coerceAiTextField = (value: unknown): string => {
        if (typeof value === "string") return value;
        if (value === null || value === undefined) return "";
        if (Array.isArray(value)) {
          return value.map((item) => coerceAiTextField(item)).filter(Boolean).join("\n");
        }
        if (typeof value === "object") {
          return Object.values(value as Record<string, unknown>).map((item) => coerceAiTextField(item)).filter(Boolean).join("\n");
        }
        return String(value);
      };

      const normalizeResumeAiResult = (result: any) => ({
        ...result,
        brutallyHonestCritique: coerceAiTextField(result?.brutallyHonestCritique),
        tailoredResume: coerceAiTextField(result?.tailoredResume),
        estimatedMatchExplanation: coerceAiTextField(result?.estimatedMatchExplanation),
        aiResponse: coerceAiTextField(result?.aiResponse),
        suggestedSkills: Array.isArray(result?.suggestedSkills)
          ? result.suggestedSkills.map((skill: unknown) => coerceAiTextField(skill)).filter(Boolean)
          : [],
      });

      const runResumePrompt = async (promptText: string) => {
        return normalizeResumeAiResult(await generateJson<any>(promptText, responseConfig.responseSchema));
      };

      tailoredResult = await runResumePrompt(userPrompt);

      if (
        isRefinementRequest &&
        normalizeResumeForChangeCheck(tailoredResult.tailoredResume) === normalizeResumeForChangeCheck(refinementBaselineDraft)
      ) {
        addLog("SYSTEM", "Gemini refinement returned an unchanged resume. Retrying once with an edit-failure correction prompt.");
        const retryPrompt = `
You are still in STRICT EDIT MODE.

Your previous response failed because the returned "tailoredResume" was unchanged from the current draft.

You MUST now return a full revised resume that visibly applies this user instruction:
"""
${customInstructions}
"""

Current Tailored Draft Resume:
"""
${refinementBaselineDraft}
"""

Truth Source / Base Resume:
"""
${resumeText}
"""

Rules:
1. Apply the user's instruction directly in the most appropriate resume section.
2. If the instruction adds a user-verified skill or tool, place it naturally where it strengthens the resume. Do not force every change into Technical Skills if another section is better.
3. Do not invent employers, dates, paid IT duties, metrics, certifications, or tools not supported by the base resume or explicit user instruction.
4. Return the COMPLETE revised resume in "tailoredResume", not a summary.
5. Use plain hyphen bullets only, like "- Label: detail". Do not use asterisk bullets or Markdown bold markers like "**Label:**" anywhere in "tailoredResume". Do not bold, underline, or highlight bullet key-point labels; only job title/company/date lines should be level-three headings.
6. In "aiResponse", state the exact location and wording area changed.
7. If you cannot apply the instruction, explain why in "aiResponse"; do not return an unchanged resume while claiming success.

Respond only as valid JSON with the required schema.
`;
        tailoredResult = await runResumePrompt(retryPrompt);
      }

      const missingRequestedTerms = isRefinementRequest
        ? getMissingRequestedResumeTerms(tailoredResult.tailoredResume, customInstructions)
        : [];
      if (missingRequestedTerms.length) {
        const missingLabels = missingRequestedTerms.map((term) => term.label).join(", ");
        addLog("SYSTEM", `Gemini refinement omitted requested resume term(s): ${missingLabels}. Retrying once with required-term correction.`);
        const requiredTermRetryPrompt = `
You are in STRICT EDIT MODE and your previous response failed validation.

The user asked for these term(s) to be added or mentioned in the resume:
${missingRequestedTerms.map((term) => `- ${term.label}`).join("\n")}

The returned resume did not contain those term(s). You MUST revise the current draft so the requested term(s) appear naturally in the best matching section.

User instruction:
"""
${customInstructions}
"""

Current Tailored Draft Resume:
"""
${refinementBaselineDraft}
"""

Truth Source / Base Resume:
"""
${resumeText}
"""

Rules:
1. Add the requested term(s) naturally, without inventing fake employers, dates, paid IT duties, metrics, or certifications.
2. If the user asked for a specific section, use that section. Otherwise choose the most appropriate section.
3. Return the COMPLETE revised resume in "tailoredResume".
4. Use plain hyphen bullets only, like "- Label: detail". Do not use asterisk bullets or Markdown bold markers like "**Label:**" anywhere in "tailoredResume". Do not bold, underline, or highlight bullet key-point labels; only job title/company/date lines should be level-three headings.
5. In "aiResponse", identify exactly where the requested term(s) were added.
6. Do not claim success unless the returned resume actually contains the requested term(s).

Respond only as valid JSON with the required schema.
`;
        tailoredResult = await runResumePrompt(requiredTermRetryPrompt);
      }

      const stillMissingRequestedTerms = isRefinementRequest
        ? getMissingRequestedResumeTerms(tailoredResult.tailoredResume, customInstructions)
        : [];
      if (stillMissingRequestedTerms.length) {
        const missingLabels = stillMissingRequestedTerms.map((term) => term.label).join(", ");
        addLog("SYSTEM", `Gemini refinement failed validation after retry. Missing requested term(s): ${missingLabels}.`);
        throw new Error(`Gemini did not apply the requested refinement. Missing requested term(s): ${missingLabels}.`);
      }

      if (
        isRefinementRequest &&
        normalizeResumeForChangeCheck(tailoredResult.tailoredResume) === normalizeResumeForChangeCheck(refinementBaselineDraft)
      ) {
        addLog("SYSTEM", "Gemini refinement retry still returned an unchanged resume. The response will be saved, but this indicates the model ignored the edit instruction.");
      } else if (isRefinementRequest) {
        addLog("SYSTEM", "Gemini refinement produced a changed resume draft.");
      }
    } else {
      // Simulated Fallback
      console.log("No Gemini API key found, playing back rich mock simulation.");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      tailoredResult = {
        brutallyHonestCritique: `### Brutally Honest Critique & Nitpicks for ${profile.name || "Michael Burson"}:

1. **Do not invent direct IT employment.** The resume must be honest about a career pivot and frame IT skills through labs, certifications, and transferable work history.
2. **Keep the real experience.** The strongest resume keeps operations, claims, and project management experience while translating it into support-relevant documentation, troubleshooting, SLA discipline, and customer communication.
3. **Use the technical lab as proof.** Active Directory, GPO, RBAC, Splunk, and VM work should be framed as hands-on lab/project experience unless the base resume says otherwise.`,
        tailoredResume: `# ${profile.name || "Michael Burson"}
IT Support Specialist | Help Desk Technician | Ohio

Mobile: ${profile.phone || "740.755.0345"} | Email: ${profile.email || "mburson99@gmail.com"} | Portfolio: ${profile.website || "https://github.com/mburson99-arch"} | LinkedIn: https://linkedin.com/in/michaelburson

## PROFESSIONAL SUMMARY
Career-changing IT support candidate with 5+ years of remote operations, logistics coordination, claims documentation, and customer-facing problem resolution. I bring strong habits around SLA discipline, written documentation, independent troubleshooting, and calm communication under pressure. My technical foundation comes from hands-on lab work with a self-hosted enterprise service desk environment, including Active Directory/RBAC practice, GPO troubleshooting simulations, VM-based systems work, Splunk exposure, and ongoing CompTIA A+ study.

## TECHNICAL SKILLS
* **Operating Systems & Support:** Windows 10/11, Windows Server lab exposure, mobile app/device troubleshooting, remote support workflows
* **Directory & Systems Lab:** Active Directory, RBAC concepts, GPO troubleshooting simulations, multi-VM architecture
* **Networking Foundations:** DNS, DHCP, VPN concepts, TCP/IP fundamentals, basic connectivity troubleshooting
* **Security & Monitoring:** Google Cybersecurity Professional Certificate, Splunk lab exposure, MFA concepts, audit-ready documentation
* **Documentation & Workflow:** Incident notes, escalation context, customer communication, SLA tracking, remote self-management

## TECHNICAL PROJECTS
### Self-Hosted Enterprise Service Desk Lab | Self-Directed
* Built and practiced within a 4-VM lab environment to simulate help desk and systems administration scenarios.
* Practiced Active Directory user/group concepts, RBAC structure, and GPO troubleshooting workflows.
* Used lab troubleshooting exercises to build comfort with documentation, root-cause thinking, and repeatable support steps.
* Explored Splunk for system log review and security-monitoring concepts in a controlled lab environment.

## PROFESSIONAL EXPERIENCE
**Operations & Logistics Coordinator** | Hotshot Hauling | *Jan 2022 - Present*
* Independently managed high-volume, time-sensitive delivery operations, meeting strict SLAs with zero direct supervision.
* Troubleshot mobile application, syncing, routing, and connectivity issues in the field to keep work moving.
* Communicated clearly with support teams, dispatch, and stakeholders while resolving time-sensitive operational issues.

**Claims Specialist & Investigator** | Allstate | *May 2021 - Dec 2021*
* Documented customer interactions and case evidence with attention to accuracy, chronology, and audit readiness.
* Translated complex policy and case details into clear language for non-technical users.
* Escalated edge-case issues with enough context for senior teams to continue resolution without losing key details.

**Project Manager** | Dry Patrol of Central Ohio | *Aug 2018 - Dec 2020*
* Coordinated schedules, resources, customer communications, and field constraints across active restoration projects.
* Managed high-pressure conversations with customers and field teams during urgent service situations.
* Kept work organized through changing priorities, vendor timelines, and time-sensitive project needs.

## EDUCATION & CERTIFICATIONS
* Google Cybersecurity Professional Certificate
* CompTIA A+ | In Progress
* High School Diploma`,
        matchScore: 78,
        suggestedSkills: ["Active Directory lab practice", "GPO troubleshooting", "SLA discipline", "Documentation", "Customer support"],
        estimatedMatchExplanation: `Directly tailored your real profile values for ${profile.name || "Michael Burson"}, preserving your real phone number and contact links seamlessly.`,
        requiresRelocation: false,
        aiResponse: customInstructions ? "I have reviewed your custom instructions and successfully updated your tailored resume!" : "Here is your tailored resume preview, safely loaded with your personalized profile data.",
      };
    }

    tailoredResult.tailoredResume = repairResumeMarkdownLayout(
      sanitizeTailoredResumeOutput(tailoredResult.tailoredResume, resumeText)
    );
    const calculatedMatch = calculateResumeMatchScore(resumeText, tailoredResult.tailoredResume, jobDescription);
    const hardRequirementSection = `## Hard Requirements From This Job\n${calculatedMatch.hardRequirements.length ? calculatedMatch.hardRequirements.join("\n") : "- No explicit hard requirements were detected in the job description."}`;
    tailoredResult.matchScore = calculatedMatch.score;
    tailoredResult.suggestedSkills = calculatedMatch.matchedTerms.length
      ? calculatedMatch.matchedTerms
      : (tailoredResult.suggestedSkills || []);
    tailoredResult.estimatedMatchExplanation = calculatedMatch.explanation;
    tailoredResult.brutallyHonestCritique = `${hardRequirementSection}\n\n## Math Score Breakdown\n- Skills: ${calculatedMatch.breakdown.skills}% x 40%\n- Experience: ${calculatedMatch.breakdown.experience}% x 30%\n- Certifications/Education: ${calculatedMatch.breakdown.certifications}% x 20%\n- Keywords/Context: ${calculatedMatch.breakdown.keywords}% x 10%\n\n${tailoredResult.brutallyHonestCritique || ""}`.trim();

    // Update job pipeline
    const jobsRef = readJSONFile<any[]>(JOBS_FILE, []);
    const refIdx = jobsRef.findIndex((j) => j.id === jobId);
    if (refIdx !== -1) {
      jobsRef[refIdx].status = "tailored";
      jobsRef[refIdx].matchScore = tailoredResult.matchScore;
      jobsRef[refIdx].originalResume = resumeText;
      jobsRef[refIdx].tailoredResumeText = tailoredResult.tailoredResume;
      jobsRef[refIdx].critiqueMarkdown = tailoredResult.brutallyHonestCritique;
      jobsRef[refIdx].requiresRelocation = tailoredResult.requiresRelocation;
      jobsRef[refIdx].aiResponse = tailoredResult.aiResponse;
      writeJSONFile(JOBS_FILE, jobsRef);
    }

    addLog("LLM", `Tailored successfully using ${ai ? `Gemini ${geminiModel}` : `OpenRouter ${openRouterModel}`}. Estimated match score: ${tailoredResult.matchScore}%.`);
    addLog("SYSTEM", `Automated resume file preview ready for: "Tailored resume for ${jobs[jobIdx].title} at ${jobs[jobIdx].company}.txt".`);

    res.json({ success: true, ...tailoredResult });
  } catch (error: any) {
    console.error("Error tailoring resume:", error);
    const jobsRef = readJSONFile<any[]>(JOBS_FILE, []);
    const refIdx = jobsRef.findIndex((j) => j.id === jobId);
    if (refIdx !== -1) {
      jobsRef[refIdx].status = previousJobStatus;
      writeJSONFile(JOBS_FILE, jobsRef);
    }
    addLog("SYSTEM", `Failed during AI resume tailoring sequence: ${error.message || error}`);
    res.status(500).json({ error: error.message || "Failed during resume tailoring process." });
  }
});

// 4.5 AI Keyword Search API
app.post("/api/keywords/search", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query is required for keyword generation." });
  }

  addLog("SYSTEM", `Running AI to generate job search keywords for query: "${query}"`);
  addLog("PROMPT", `Prompting: "Generate search keywords and boolean string for ${query}..."`);

  try {
    let result;
    const userPrompt = `You are an expert recruiter and career coach. The user is searching for jobs but might not know the exact titles or terminology.
Provide a list of highly effective keywords, related job titles, and a few boolean search strings they can use on Indeed, LinkedIn, or Google based on their description.

User's Query: "${query}"

Return ONLY a valid JSON object with these exact keys:
- "coreKeywords": array of 5-8 primary skills or keywords to search for
- "relatedTitles": array of 3-5 alternative job titles they should search for
- "booleanStrings": array of 2-3 boolean search strings (e.g., "(Title A OR Title B) AND (Skill C OR Skill D)")
- "advice": a conversational 1-2 sentence tip on how to best search for these jobs

No markdown, no explanation — raw JSON only.`;

    const keywordSchema = {
      type: Type.OBJECT,
      properties: {
        coreKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        relatedTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
        booleanStrings: { type: Type.ARRAY, items: { type: Type.STRING } },
        advice: { type: Type.STRING },
      },
      required: ["coreKeywords", "relatedTitles", "booleanStrings", "advice"],
    };

    if (openRouterApiKey || ai) {
      try {
        result = await generateJson(userPrompt, keywordSchema);
      } catch (aiError: any) {
        console.error("AI keyword API error, falling back to mock:", aiError?.message || aiError);
        result = {
          coreKeywords: ["skill 1", "skill 2", "skill 3", "helpdesk"],
          relatedTitles: ["IT Support Specialist", "System Administrator", "Desktop Support"],
          booleanStrings: [`("IT Support" OR "Helpdesk") AND ("Active Directory" OR "Networking")`],
          advice: "The AI service is currently busy. Using these fallback boolean strings in LinkedIn's search bar to narrow down roles related to your query.",
        };
      }
    } else if (anthropic) {
      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [{ role: "user", content: userPrompt }],
        });

        const responseText = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
        result = JSON.parse(extractJsonObject(responseText));
      } catch (aiError: any) {
        console.error("Claude API error, falling back to mock:", aiError?.message || aiError);
        result = {
          coreKeywords: ["skill 1", "skill 2", "skill 3", "helpdesk"],
          relatedTitles: ["IT Support Specialist", "System Administrator", "Desktop Support"],
          booleanStrings: [`("IT Support" OR "Helpdesk") AND ("Active Directory" OR "Networking")`],
          advice: "The AI service is currently busy. Using these fallback boolean strings in LinkedIn's search bar to narrow down roles related to your query.",
        };
      }
    } else {
      // Mock result if AI is not configured
      result = {
        coreKeywords: ["skill 1", "skill 2", "skill 3", "helpdesk"],
        relatedTitles: ["IT Support Specialist", "System Administrator", "Desktop Support"],
        booleanStrings: [`("IT Support" OR "Helpdesk") AND ("Active Directory" OR "Networking")`],
        advice: "Use these boolean strings in LinkedIn's search bar to narrow down roles related to your query.",
      };
    }

    addLog("LLM", `Generated keywords and search phrases for: ${query}`);

    res.json(result);
  } catch (error: any) {
    console.error("Error generating keywords:", error);
    addLog("SYSTEM", `Failed to generate keywords: ${error.message || error}`);
    res.status(500).json({ error: error.message || "Failed to generate keywords." });
  }
});

// 5. Simulated Incoming Email Trigger API (Manual or timed simulation)
app.post("/api/jobs/:id/simulate-email", (req, res) => {
  const { id } = req.params;
  const { subject, body, type, sender } = req.body;

  const jobs = readJSONFile<any[]>(JOBS_FILE, []);
  const job = jobs.find((j) => j.id === id);
  if (!job) {
    return res.status(404).json({ error: "Job corresponding index not found." });
  }

  // Set the job unread reply indicator to true
  job.hasUnreadEmailUpdate = true;
  job.emailUpdateCount = (job.emailUpdateCount || 0) + 1;
  writeJSONFile(JOBS_FILE, jobs);

  // Generate Email Alert
  const emails = readJSONFile<any[]>(EMAILS_FILE, []);
  const newEmail = {
    id: "email-" + Math.random().toString(36).substring(2, 9),
    jobId: id,
    jobTitle: job.title,
    company: job.company,
    senderName: sender || `Recruitment Team (${job.company})`,
    timestamp: new Date().toISOString(),
    subject: subject || `Next steps: your application at ${job.company}`,
    body: body || `Dear Alex,\n\nThank you for submitting your tailored resume. We would love to move you to an interview block.\n\nBest wishes,\nRecruiting at ${job.company}`,
    type: type || "interview",
    isRead: false,
  };

  emails.push(newEmail);
  writeJSONFile(EMAILS_FILE, emails);

  addLog("SYSTEM", `[ALERT] New email received from ${job.company} with update indicators!`);
  res.json({ email: newEmail, job });
});

// List simulated emails
app.get("/api/emails", (req, res) => {
  const emails = readJSONFile<any[]>(EMAILS_FILE, []);
  res.json(emails);
});

// Mark email as read
app.post("/api/emails/:id/read", (req, res) => {
  const { id } = req.params;
  const emails = readJSONFile<any[]>(EMAILS_FILE, []);
  const idx = emails.findIndex((e) => e.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: "Email Alert not found." });
  }

  emails[idx].isRead = true;
  writeJSONFile(EMAILS_FILE, emails);

  // Check if there are other unread emails for the same job
  const jobId = emails[idx].jobId;
  const hasMoreUnread = emails.some((e) => e.jobId === jobId && !e.isRead);

  if (!hasMoreUnread) {
    const jobs = readJSONFile<any[]>(JOBS_FILE, []);
    const jobIdx = jobs.findIndex((j) => j.id === jobId);
    if (jobIdx !== -1) {
      jobs[jobIdx].hasUnreadEmailUpdate = false;
      jobs[jobIdx].emailUpdateCount = 0;
      writeJSONFile(JOBS_FILE, jobs);
    }
  }

  res.json(emails[idx]);
});

// Reset database to initial demo state
app.post("/api/jobs/reset", (req, res) => {
  const defaultJobs = [
    {
      id: "job-9xfrz5y",
      title: "IT Support Specialist - job post",
      company: "Mercer Bucks Technology",
      url: "https://www.indeed.com/jobs?q=it+support&l=Remote&radius=25&from=searchOnDesktopSerp%2Cwhereautocomplete&vjk=13a1127297189f0e",
      description: "Job Overview\nWe are seeking a dynamic and motivated IT Support Specialist to join our technology team! In this role, you will be the frontline hero for resolving technical issues, supporting users across various platforms, and maintaining our IT infrastructure. Your energetic approach and problem-solving skills will ensure seamless technology operations, empowering our organization to achieve its goals efficiently. This paid position offers an exciting opportunity to develop your expertise in a fast-paced, innovative environment while delivering exceptional customer service and technical support.\n\nResponsibilities\n\nProvide prompt and effective technical support to end-users via help desk tickets, phone, or in-person interactions.\nTroubleshoot software issues across multiple operating systems including Windows, macOS, and Linux, ensuring quick resolution.\nManage computer hardware components such as desktops, laptops, mobile devices, printers, and peripherals to optimize performance.\nSupport network administration tasks including configuring and maintaining LAN (Local Area Network), WAN (Wide Area Network), VPN (Virtual Private Network), DNS (Domain Name System), and firewall settings like Meraki devices.\nAssistant with software deployment, updates, and patch management using tools such as SCCM (System Center Configuration Manager) and GPO (Group Policy Objects).\nMonitor and maintain IT infrastructure components including Windows Server environments, Active Directory, TCP/IP protocols, and network security measures.\nUtilize service management tools like ServiceNow, Jira, BMC Remedy, or similar platforms for incident tracking and resolution documentation.\nCollaborate with team members on network administration tasks including TCP/UDP analysis, DNS configuration, and troubleshooting connectivity issues.\nSupport remote users by configuring VPN access and troubleshooting connectivity problems on mobile devices and laptops.\n\nRequirements\n\nProven experience providing technical support in a fast-paced environment with excellent customer service skills.\nStrong troubleshooting skills across software applications and hardware components.\nHands-on experience managing computer networks including LAN/WAN setup, TCP/IP protocols, DNS configuration, firewalls (e.g., Meraki), and VPNs.\nFamiliarity with operating systems such as Windows (including Windows Server), macOS, and Linux distributions.\nKnowledge of IT support tools like SCCM for software deployment and GPO for policy management.\nExperience with help desk ticketing systems such as ServiceNow or BMC Remedy is highly desirable.\nAbility to communicate complex technical information clearly to non-technical users.\nAnalysis skills to diagnose issues quickly and implement effective solutions efficiently. Join us to be part of a vibrant team dedicated to leveraging technology to drive success! Your expertise will help create a resilient IT environment that supports innovation while delivering outstanding service to all users.\n\nPay: $26.45 - $31.85 per hour\n\nBenefits:\n\nDental insurance\nPaid time off\n\nWork Location: Remote",
      dateCaptured: new Date().toISOString(),
      status: "submitted",
      matchScore: 78,
      originalResume: "MICHAEL BURSON New Concord, OH | 740.755.0345 | Mburson99@gmail.com LinkedIn: \nwww.linkedin.com/in/mjburson | Portfolio: github.com/mburson99-arch/AD-splunk-lab \nPROFESSIONAL SUMMARY Disciplined, customer-focused professional with over 5 years of \nremote operational experience transitioning into IT. Proven expertise managing strict SLAs, \nhandling high-stakes client escalations, and maintaining productivity in self-directed \nenvironments. Armed with practical IT infrastructure expertise in Windows OS, Active Directory \n(Password Resets/Unlocks), and VPN troubleshooting built through enterprise simulations. \nReady to provide first-line support to enterprise employees and ensure minimal downtime. \nTECHNICAL SKILLS \n● Systems Administration: Active Directory (ADUC), Group Policy Objects (GPOs), \nRBAC (Role-Based Access Control), Windows Server/Client OS \n● Network & Security Support: Multi-VM Architecture, VPN Troubleshooting, DNS/DHCP \nConfiguration, Remote Desktop Protocol (RDP) \n● Operations & Diagnostics: Enterprise Incident Simulation, SLA Management, Remote \nSoftware Deployment, Root-Cause Documentation \n● Soft Skills: High-Pressure Communication, Incident Resolution, Technical Translation, \nTeam Collaboration \nFEATURED TECHNICAL PROJECT Enterprise Service Desk & Identity Management Lab | \nSelf-Hosted | Dec 2024 – Present Engineered a virtualized sandbox environment to master \nLevel 1 Helpdesk operations, systems administration, and live infrastructure troubleshooting. \n● Multi-VM Architecture: Successfully built and networked a 4-Virtual Machine topology \nto run in tandem, simulating an enterprise server-client environment on the first iteration. \n● Access Control & RBAC: Created users and applied Role-Based Access Controls to \nenforce the principle of least privilege, successfully granting distinct \"supervisor powers\" \nand administrative tiers across the network. \n● GPO Troubleshooting: Intentionally broke Active Directory policies and forced update \nfailures within the VMs to simulate real-world service disruptions, successfully \ntroubleshooting and resolving the registry/policy blocks. \n● Bulk Deployment: Leveraged Group Policy Objects (GPOs) to deploy simultaneous \nremote software updates and configurations across all connected client endpoints \npost-remediation. \n● Documentation & Visibility: Logged simulated incidents in a local tracking system, \ndetailing the root cause of the broken configurations and the step-by-step resolution path \nverified via GitHub project repositories. \nPROFESSIONAL EXPERIENCE Operations & Logistics Coordinator (Roadie & Spark) | \nHotshot Hauling | Jan 2022 – Present \n● SLA Management: Independently managed high-volume, time-sensitive delivery \noperations, consistently meeting strict Service Level Agreements (SLAs) for arrival and \ncompletion windows under zero direct supervision. \n● Field Troubleshooting: Independently resolved mobile application and connectivity \nissues in the field, troubleshooting device sync errors and authentication drops to ensure \nuninterrupted delivery operations. \n● Incident Resolution: Communicated effectively with support dispatch and stakeholders \nvia chat, email, and phone to resolve real-time routing anomalies, data discrepancies, \nand platform delivery issues. \n● Technical Adaptability: Balanced ongoing logistics operations as a part-time gig while \ndedicating 20+ hours a week to independent technology certifications, virtualization \nprojects, and system administration training. \nClaims Specialist & Investigator | Allstate | May 2121 – Dec 2021 \n● Incident Documentation: Meticulously documented high volumes of user interactions \nand case evidence within internal enterprise systems, maintaining a comprehensive, \naudit-ready data trail for every file. \n● Technical Translation: Diagnosed complex, high-stakes inquiries to determine policy \nresolutions, successfully translating intricate technical guidelines into plain, professional \nlanguage for non-technical clients. \n● Escalation Pathing: Meticulously route complex, multi-tiered issues to specialized senior teams, ensuring files reached the correct resource with zero loss of context. \nProject Manager | Dry Patrol of Central Ohio (Permanent Franchise Closure) | Aug 2018 – \nDec 2020 \n● Crisis Operations: Led time-critical logistics and resource allocation for multiple \nconcurrent property disaster restoration projects, ensuring strict adherence to safety \ntimelines and deployment efficiency. \n● Stakeholder Communication: Managed direct communications with stressed property \nowners and field teams during critical operational phases, resolving high-friction \nescalations with professionalism and clarity. \n● Resource Coordination: Balanced project scheduling, equipment tracking, and \nfranchise vendor timelines under intense pressure until operations successfully \nconcluded due to permanent business closure. \nEDUCATION & CERTIFICATIONS \n● Google Cybersecurity Professional Certificate | Coursera (Focus on Networks, OS, \nand Support) \n● CompTIA A+ | In Progress \n● High School Diploma | Newark High School",
      "tailoredResumeText": "# MICHAEL BURSON\nNew Concord, OH | 740.755.0345 | Mburson99@gmail.com\nLinkedIn: https://www.linkedin.com/in/mjburson | Portfolio: https://github.com/mburson99-arch/AD-splunk-lab\n\n## PROFESSIONAL SUMMARY\nDedicated and adaptable professional with 5+ years of remote operational experience, now pivoting into IT Support. Leveraging a robust foundation in customer service, strict SLA management, and high-stakes incident resolution to deliver prompt and effective technical assistance. Proven hands-on IT infrastructure experience in Windows Server, Active Directory, GPO management, TCP/IP fundamentals, and VPN troubleshooting, developed through a self-hosted enterprise lab environment. Eager to contribute problem-solving skills and an energetic approach to ensure seamless technology operations and exceptional user support in a remote capacity.\n\n## TECHNICAL SKILLS\n*   **Operating Systems & Server Environments:** Windows Server/Client OS, Active Directory (ADUC), Group Policy Objects (GPOs), RBAC (Role-Based Access Control), Windows Server Administration\n*   **Network & Connectivity Support:** VPN Configuration & Troubleshooting, DNS/DHCP Configuration, Remote Desktop Protocol (RDP), Multi-VM Architecture, TCP/IP Protocol Fundamentals, LAN/WAN Concepts (Virtualized), Basic Network Diagnostics (ping, tracert), Firewall Principles (e.g., Meraki familiarity)\n*   **Help Desk & Service Management Concepts:** Enterprise Incident Simulation, SLA Management, Remote Software Deployment, Root-Cause Documentation, High-Pressure Communication, Incident Resolution, Incident Tracking & Resolution Documentation (e.g., ServiceNow, Jira principles), SCCM/GPO for Patch Management\n*   **Hardware & Peripherals:** Mobile Device Troubleshooting, Remote Hardware Diagnostics & Support Principles (Desktops, Laptops, Mobile Devices, Printers, Peripherals)\n\n## FEATURED TECHNICAL PROJECT\n### Enterprise Service Desk & Identity Management Lab | Self-Hosted | Dec 2024 – Present\nEngineered a virtualized sandbox environment to master Level 1 Helpdesk operations, Windows systems administration, and live infrastructure troubleshooting, directly simulating enterprise support scenarios.\n*   **Multi-Platform Infrastructure:** Successfully built and networked a 4-Virtual Machine topology (including Windows Server) to simulate an enterprise Windows server-client environment, establishing foundational LAN/WAN concepts and TCP/IP connectivity.\n*   **Access Control & Security:** Implemented Active Directory and Role-Based Access Controls to enforce the principle of least privilege, configuring distinct administrative tiers and user permissions across the network.\n*   **Policy Management & Troubleshooting:** Deliberately introduced Active Directory policy failures and forced update disruptions to replicate real-world service incidents, successfully diagnosing and resolving registry/policy blocks.\n*   **Remote Deployment & Updates:** Utilized Group Policy Objects (GPOs) for simultaneous remote software deployment, updates, and configuration across all connected client endpoints, mimicking enterprise patch management and deployment strategies (similar to SCCM functions).\n*   **Incident Documentation:** Logged simulated incidents within a local tracking system, detailing root causes and step-by-step resolution paths, directly mirroring help desk ticketing system practices and preparing for platforms like ServiceNow or Jira.\n*   **Network Component Configuration:** Configured and troubleshot DNS, DHCP, and VPN within the virtualized network, ensuring robust connectivity and resource access.\n*   **Network Diagnostics:** Conducted basic network diagnostics within the virtual environment, verifying DNS configurations and troubleshooting connectivity issues between VMs using fundamental TCP/IP commands (e.g., ping, tracert).\n\n## PROFESSIONAL EXPERIENCE\n### Operations & Logistics Coordinator (Roadie & Spark) | Hotshot Hauling | Jan 2022 – Present\n*   **Remote Service Level Adherence:** Independently managed high-volume, time-sensitive remote delivery operations, consistently meeting strict Service Level Agreements (SLAs) for arrival and completion under zero direct supervision.\n*   **Field Hardware & Connectivity Troubleshooting:** Independently diagnosed and resolved mobile device application and connectivity issues in the field, troubleshooting device sync errors and authentication drops to ensure uninterrupted operations, demonstrating practical hardware and software problem-solving.\n*   **Remote Incident Resolution:** Communicated effectively with support dispatch and stakeholders via chat, email, and phone to resolve real-time routing anomalies and platform delivery issues, demonstrating strong remote problem-solving and communication.\n*   **Technical Upskilling:** Balanced ongoing logistics operations as a part-time role while dedicating 20+ hours weekly to independent technology certifications, virtualization projects, and system administration training.\n\n### Claims Specialist & Investigator | Allstate | May 2121 – Dec 2021\n*   **Comprehensive Incident Documentation:** Meticulously documented high volumes of user interactions and case evidence within internal enterprise systems, maintaining a comprehensive, audit-ready data trail for every file, akin to help desk incident logging.\n*   **Technical Information Translation:** Diagnosed complex, high-stakes inquiries to determine policy resolutions, successfully translating intricate technical guidelines into plain, professional language for non-technical clients.\n*   **Systematic Escalation Pathing:** Analyzed edge-case disputes and systematically routed complex, multi-tiered issues to specialized senior teams, ensuring files reached the correct resource with zero loss of context and efficient resolution.\n\n### Project Manager | Dry Patrol of Central Ohio (Permanent Franchise Closure) | Aug 2018 – Dec 2020\n*   **Crisis Operations Management:** Led time-critical logistics and resource allocation for multiple concurrent property disaster restoration projects, ensuring strict adherence to safety timelines and deployment efficiency under pressure.\n*   **Stakeholder Communication:** Managed direct communications with stressed property owners and field teams during critical operational phases, resolving high-friction escalations with professionalism and clarity.\n*   **Resource Coordination:** Balanced project scheduling, equipment tracking, and franchise vendor timelines under intense pressure until operations successfully concluded.\n\n## EDUCATION & CERTIFICATIONS\n*   Google Cybersecurity Professional Certificate | Coursera (Focus on Networks, OS, and Support)\n*   CompTIA A+ | In Progress\n*   High School Diploma | Newark High School",
      "critiqueMarkdown": "Resume matches.",
      "hasUnreadEmailUpdate": false,
      "emailUpdateCount": 0
    },
    {
      "id": "job-r6lswmn",
      "title": "Technical Product Support Specialist II - job post",
      "company": "Zoll Medical Corporation",
      "url": "https://www.indeed.com/jobs?q=Help+Desk+Technician&l=remote&from=searchOnDesktopSerp&vjk=f7588def10452287",
      "description": "Acute Care Technology\n\nWhy Join ZOLL?\n\nAt ZOLL Data Systems, we’re on a mission to save lives and improve clinical outcomes through advanced Enterprise and SaaS technology for EMS, hospital, and billing organizations. As a Technical Product Support Specialist II, you will handle more complex technical customer inquiries and provide advanced support for specific ZOLL enterprise products. You will manage issues with greater independence, using advanced troubleshooting skills and collaborating across teams or other departments when resolving multi-product or system-specific issues (e.g., DB, OS, Networking). This role includes contributing to the knowledge base and proactively analyzing technical trends to drive improvements in customer satisfaction\n\nWhat You'll Do\n\nManage advanced troubleshooting for assigned ZOLL enterprise products, using analytical skills to identify root causes of technical issues (e.g., DB, OS, Networking), adhering to ZDM for complete documentation in Salesforce.\n\nHandle complex technical issues independently, escalating only critical or unresolved problems to senior team members or CSO teams (e.g., Software Support, Implementation) or other departments (e.g., Product/R&D, SRE, IT App Hosting, Sales) as necessary, using Atlassian Jira Service Desk for handoffs.\n\nCollaborate with other CSO teams or departments to address technical issues thatspan across multiple products or systems, ensuring seamless cross-product support, using Microsoft Teams or Slack for resource navigation.\n\nContribute to the knowledge base, creating and updating articles with solutions to complex technical problems (KB Create) and sharing insights with the team, linking relevant KB articles (KM Linking %) in Salesforce and Atlassian Confluence.\n\nIdentify technical trends through customer case analysis, proposing preventative support initiatives to reduce recurring issues, swarming in collaboration channels to enhance reputation as a technical expert.\n\nTake a proactive approach by recognizing potential technical challenges and addressing them before they escalate, ensuring compliance with initial response and ANRD.\n\nCross-train on additional technical components within the suite (e.g., SQL Server, VMware), gaining a broader understanding of the ZOLL product ecosystem, using tools like Salesforce and Microsoft Teams.\n\nFacilitate incident management processes, coordinating team responses to ensure timely resolution of high-priority technical cases or outages and adherence to SLAs, using Atlassian Jira Service Desk and Microsoft Teams.\n\nOptimize hybrid meeting structures and remote team productivity guidelines, using virtual collaboration tools like Microsoft Teams, Slack, and LogMeIn Rescue to maintain technical service excellence.\n\nAdhere to customers’ preferred contact methods (e.g., Five9, email, LogMeIn Rescue) and monitor technical bugged cases in Pending Internal Status on a regular cadence, ensuring compliance with ANRD and resource engagement",
      "dateCaptured": "2026-05-26T13:18:24.735Z",
      "status": "captured",
      "hasUnreadEmailUpdate": false,
      "emailUpdateCount": 0
    }
  ];

  writeJSONFile(JOBS_FILE, defaultJobs);

  if (fs.existsSync(DELETED_JOBS_FILE)) {
    try {
      fs.unlinkSync(DELETED_JOBS_FILE);
    } catch (e) {}
  }

  writeJSONFile(EMAILS_FILE, [
    {
      id: "email-1",
      jobId: "job-r6lswmn",
      jobTitle: "Technical Product Support Specialist II - job post",
      company: "Zoll Medical Corporation",
      senderName: "Zoll Data Systems HR team",
      timestamp: new Date().toISOString(),
      subject: "Candidacy Update: Technical Support Specialist II",
      body: "Hi Michael,\n\nThank you for submitting your tailored resume for the Technical Product Support Specialist II opening. We noticed your robust hands-on virtualized enterprise lab project and found your remote SLA and customer handling skills highly applicable to this position.\n\nCould you please let us know your availability for a brief 15-minute phone screening with our support team lead this coming Thursday or Friday?\n\nBest regards,\nEleanor Vance\nCSO Talent Acquisition Team\nZoll Medical Corporation",
      type: "interview",
      isRead: true
    },
    {
      id: "email-2",
      jobId: "job-9xfrz5y",
      jobTitle: "IT Support Specialist - job post",
      company: "Mercer Bucks Technology",
      senderName: "Mercer Bucks Careers",
      timestamp: new Date().toISOString(),
      subject: "Application Confirmed: IT Support Specialist (Remote)",
      body: "Hi Michael Burson,\n\nThis automatic notification is to confirm that we have successfully received your tailored application for the IT Support Specialist role.\n\nOur service division is currently routing applications for manual review. We will contact you directly if there is alignment with our Meraki networking and SCCM operational workflows.\n\nKind regards,\nRecruitment Desk\nMercer Bucks Technology",
      type: "received",
      isRead: true
    }
  ]);

  res.json({ success: true, message: "Database reset to initial demo state." });
});

// Mark email as read

// 6. Logs API
app.get("/api/logs", (req, res) => {
  const logs = readJSONFile<any[]>(LOGS_FILE, []);
  res.json(logs);
});

app.post("/api/logs/clear", (req, res) => {
  writeJSONFile(LOGS_FILE, []);
  res.json({ success: true });
});

// Vite Middleware for assets / index serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vitePackage = "vite";
    const { createServer: createViteServer } = await import(vitePackage);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(assetsDir));
    app.get("*", (req, res) => {
      res.sendFile(path.join(assetsDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting robustly on http://0.0.0.0:${PORT}`);
  });
}

startServer();
