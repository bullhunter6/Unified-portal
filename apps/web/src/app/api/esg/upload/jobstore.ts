export type JobStatus = "queued" | "processing" | "done" | "error" | "cancelled";

export type EsgJob = {
  id: string;
  userId: string | null;
  status: JobStatus;
  progress: number;          // 0..100
  rowsTotal?: number;
  rowsDone?: number;
  error?: string;
  cancelled?: boolean;       // stop switch
  buffer?: Buffer;           // XLSX in memory
  filename?: string;         // download name
  filePath?: string;         // file path on disk
  createdAt: number;
};

export const ESG_JOBS = new Map<string, EsgJob>();