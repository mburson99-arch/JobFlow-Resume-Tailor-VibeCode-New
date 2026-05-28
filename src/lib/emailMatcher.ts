import { Job } from "../types";

export interface EmailForMatch {
  from: string;
  subject: string;
  bodyText: string;
  snippet?: string;
}

const GENERIC_COMPANIES = new Set([
  "technology", "technologies", "medical", "corporation", "corporations", "corp", "group", "group llc",
  "solutions", "solution", "services", "service", "systems", "system", "inc", "co", "llc", "ltd", "limited",
  "consulting", "careers", "jobs", "staffing", "recruitment", "recruiting", "talent", "com", "net", "org",
  "workday", "workday.com", "myworkday", "myworkdayjobs", "noreply", "no-reply",
]);

/** Returns best job match when confidence score is at least 20. */
export function matchEmailToJob(
  email: EmailForMatch,
  jobs: Job[]
): { job: Job; score: number } | null {
  let matchedJob: Job | null = null;
  let highestScore = 0;

  const fromStr = normalizeText(email.from);
  const subStr = normalizeText(email.subject);
  const bodyStr = normalizeText(email.bodyText);
  const snippetStr = normalizeText(email.snippet || "");

  for (const job of jobs) {
    const company = job.company.toLowerCase().trim();
    const title = job.title.toLowerCase().trim();

    const coreBrand = company
      .replace(/\b(technology|technologies|medical|corporation|corp|inc|llc|ltd|limited|group|solutions|services|systems|care)\b/gi, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const brandWords = coreBrand
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !GENERIC_COMPANIES.has(w));

    let score = 0;
    if (coreBrand.length > 2) {
      if (fromStr.includes(coreBrand) || subStr.includes(coreBrand)) {
        score += 50;
      } else if (bodyStr.includes(coreBrand) || snippetStr.includes(coreBrand)) {
        score += 30;
      }
    }

    brandWords.forEach((word) => {
      if (fromStr.includes(word)) {
        score += 25;
      } else if (subStr.includes(word)) {
        score += 20;
      } else if (bodyStr.includes(word) || snippetStr.includes(word)) {
        score += 15;
      }
    });

    if (company.includes("zoll") && (fromStr.includes("zoll") || subStr.includes("zoll") || bodyStr.includes("zoll") || snippetStr.includes("zoll"))) {
      score += 35;
    }
    if (company.includes("mercer") && (fromStr.includes("mercer") || subStr.includes("mercer") || bodyStr.includes("mercer") || snippetStr.includes("mercer"))) {
      score += 35;
    }

    if (score >= 20) {
      const cleanTitle = title.replace(/\b(job post|- job post)\b/gi, "").trim();
      if (subStr.includes(cleanTitle)) {
        score += 15;
      } else if (bodyStr.includes(cleanTitle) || snippetStr.includes(cleanTitle)) {
        score += 5;
      }

      cleanTitle
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3 && !GENERIC_COMPANIES.has(word))
        .forEach((word) => {
          if (subStr.includes(word)) score += 4;
          else if (bodyStr.includes(word) || snippetStr.includes(word)) score += 2;
        });
    }

    if (score > highestScore) {
      highestScore = score;
      matchedJob = job;
    }
  }

  if (matchedJob && highestScore >= 20) {
    return { job: matchedJob, score: highestScore };
  }
  return null;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[\s\u00a0]+/g, " ");
}
