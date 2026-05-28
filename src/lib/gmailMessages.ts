export interface ParsedEmail {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
  bodyText: string;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPayloadPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayloadPart[];
}

export function decodeEmailBody(payload: GmailPayloadPart): string {
  const collectAllTextParts = (parts: GmailPayloadPart[]): { plains: string[]; htmls: string[] } => {
    let plains: string[] = [];
    let htmls: string[] = [];

    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        plains.push(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data) {
        htmls.push(part.body.data);
      }

      if (part.parts?.length) {
        const nested = collectAllTextParts(part.parts);
        plains = plains.concat(nested.plains);
        htmls = htmls.concat(nested.htmls);
      }
    }

    return { plains, htmls };
  };

  let bodyChunks: string[] = [];
  if (payload.parts) {
    const parsedParts = collectAllTextParts(payload.parts);
    bodyChunks = [...parsedParts.plains, ...parsedParts.htmls];
  } else if (payload.body?.data) {
    bodyChunks = [payload.body.data];
  }

  return bodyChunks
    .map(decodeBodyChunk)
    .filter((text) => text.trim().length > 0)
    .join("\n");
}

export function mapDemoEmail(simEmail: any): ParsedEmail {
  return {
    id: simEmail.id,
    threadId: simEmail.id,
    snippet: simEmail.body ? simEmail.body.substring(0, 100) : "",
    subject: simEmail.subject || "No Subject",
    from: simEmail.senderName || `Recruitment Desk (${simEmail.company})`,
    date: simEmail.timestamp || new Date().toISOString(),
    bodyText: simEmail.body || "No message content.",
  };
}

export function isRecentJobEmail(email: ParsedEmail): boolean {
  const parsedDate = new Date(email.date);
  return Number.isFinite(parsedDate.getTime()) && parsedDate.getTime() >= new Date("2026-05-20T00:00:00Z").getTime();
}

export function headerValue(headers: GmailHeader[], name: string, fallback: string): string {
  return headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || fallback;
}

function decodeBodyChunk(chunk: string): string {
  try {
    const sanitized = chunk.replace(/[^A-Za-z0-9+/=_-]/g, "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = sanitized.padEnd(sanitized.length + (4 - sanitized.length % 4) % 4, "=");
    const binaryString = atob(padded);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return htmlToText(decoded);
  } catch {
    return "";
  }
}

function htmlToText(value: string): string {
  if (typeof document !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(value, "text/html");
      const textContent = doc.body.textContent || doc.body.innerText;
      if (textContent) return textContent;
    } catch {
      // Fall back to entity cleanup below.
    }
  }

  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/<[^>]*>/g, " ");
}
