import { Job } from "../types";
import { EmailForMatch, matchEmailToJob } from "./emailMatcher";

export const JOBFLOW_GMAIL_LABEL_NAME = "JobFlow Applications";

const LABEL_ID_KEY = "jobflow_gmail_label_id";
const LABELED_IDS_KEY = "jobflow_labeled_email_ids";

function gmailHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

function readLabeledIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LABELED_IDS_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(list);
  } catch {
    return new Set();
  }
}

function saveLabeledId(messageId: string): void {
  const ids = readLabeledIds();
  ids.add(messageId);
  localStorage.setItem(LABELED_IDS_KEY, JSON.stringify([...ids]));
}

/** Gmail search query: saved label folder first, then inbox for new mail. */
export function buildJobFlowInboxQuery(): string {
  return `(label:"${JOBFLOW_GMAIL_LABEL_NAME}" OR in:inbox)`;
}

/** Create the label once (or return existing) and cache its id locally. */
export async function ensureJobFlowLabel(accessToken: string): Promise<string> {
  const cached = localStorage.getItem(LABEL_ID_KEY);
  if (cached) return cached;

  const listRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    headers: gmailHeaders(accessToken),
  });

  if (!listRes.ok) {
    throw new Error(`Could not list Gmail labels (${listRes.status})`);
  }

  const listData = (await listRes.json()) as { labels?: { id: string; name: string }[] };
  const existing = listData.labels?.find((l) => l.name === JOBFLOW_GMAIL_LABEL_NAME);
  if (existing?.id) {
    localStorage.setItem(LABEL_ID_KEY, existing.id);
    return existing.id;
  }

  const createRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    method: "POST",
    headers: {
      ...gmailHeaders(accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: JOBFLOW_GMAIL_LABEL_NAME,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Could not create Gmail label "${JOBFLOW_GMAIL_LABEL_NAME}" (${createRes.status})`);
  }

  const created = (await createRes.json()) as { id: string };
  localStorage.setItem(LABEL_ID_KEY, created.id);
  console.log(`[JobFlow] Created Gmail label: ${JOBFLOW_GMAIL_LABEL_NAME}`);
  return created.id;
}

export async function applyJobFlowLabel(
  accessToken: string,
  messageId: string,
  labelId: string
): Promise<void> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: "POST",
      headers: {
        ...gmailHeaders(accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ addLabelIds: [labelId] }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to label message ${messageId} (${res.status})`);
  }
}

/**
 * After parsing, file job-matched emails into the JobFlow Applications Gmail label
 * so future syncs remember them in that folder.
 */
export async function syncMatchedEmailsToJobFlowLabel(
  accessToken: string,
  emails: EmailForMatch & { id: string }[],
  jobs: Job[]
): Promise<{ labeled: number; skipped: number }> {
  if (!emails.length || !jobs.length) {
    return { labeled: 0, skipped: 0 };
  }

  const labelId = await ensureJobFlowLabel(accessToken);
  const alreadyLabeled = readLabeledIds();
  let labeled = 0;
  let skipped = 0;

  for (const email of emails) {
    const match = matchEmailToJob(email, jobs);
    if (!match) {
      skipped++;
      continue;
    }
    if (alreadyLabeled.has(email.id)) {
      skipped++;
      continue;
    }

    try {
      await applyJobFlowLabel(accessToken, email.id, labelId);
      saveLabeledId(email.id);
      alreadyLabeled.add(email.id);
      labeled++;
    } catch (err) {
      console.warn(`[JobFlow] Could not label email ${email.id}:`, err);
    }
  }

  if (labeled > 0) {
    console.log(`[JobFlow] Filed ${labeled} email(s) into "${JOBFLOW_GMAIL_LABEL_NAME}"`);
  }

  return { labeled, skipped };
}
