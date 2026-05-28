import fs from "fs";
import path from "path";

export const storagePaths = {
  jobs: path.join(process.cwd(), "jobs_db.json"),
  emails: path.join(process.cwd(), "emails_db.json"),
  profile: path.join(process.cwd(), "profile_db.json"),
  logs: path.join(process.cwd(), "logs_db.json"),
  deletedJobs: path.join(process.cwd(), "deleted_jobs_db.json"),
};

export function readJSONFile<T>(filePath: string, defaultData: T): T {
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

export function writeJSONFile<T>(filePath: string, data: T): void {
  try {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
  }
}

export type LogSender = "SYSTEM" | "LLM" | "PROMPT" | "PDF" | "CHROME";

export function addLog(sender: LogSender, text: string): void {
  const logs = readJSONFile<any[]>(storagePaths.logs, []);
  logs.push({
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    sender,
    text,
  });

  if (logs.length > 100) logs.splice(0, logs.length - 100);
  writeJSONFile(storagePaths.logs, logs);
}
