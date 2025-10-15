export type JobStatus = "queued" | "processing" | "done" | "error";

export type Job = {
  id: string;
  status: JobStatus;
  error?: string;
  // NEW: hold the result in memory (no need to write to C:\Temp)
  buffer?: Buffer;
  filename?: string;
  createdAt: number;
};

export const JOBS = new Map<string, Job>();