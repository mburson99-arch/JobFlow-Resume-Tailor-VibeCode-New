export interface Job {
  id: string;
  title: string;
  company: string;
  url: string;
  description: string;
  dateCaptured: string;
  status: 'captured' | 'analyzing' | 'tailored' | 'manual_review' | 'submitted' | 'denied' | 'interviewing';
  matchScore?: number;
  originalResume?: string;
  tailoredResumeText?: string;
  tailoredResumePdfPath?: string;
  critiqueMarkdown?: string;
  hasUnreadEmailUpdate?: boolean;
  emailUpdateCount?: number;
  requiresRelocation?: boolean;
  aiResponse?: string;
}

export interface CandidateProfile {
  name: string;
  email: string;
  phone: string;
  website: string;
  resumeText: string;
  githubProfileUrl?: string;
  githubProfileSummary?: string;
}

export interface EmailAlert {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  senderName: string;
  timestamp: string;
  subject: string;
  body: string;
  type: 'interview' | 'rejection' | 'received' | 'update';
  isRead: boolean;
}

export interface LogMessage {
  id: string;
  timestamp: string;
  sender: 'SYSTEM' | 'LLM' | 'PROMPT' | 'PDF' | 'CHROME';
  text: string;
}
