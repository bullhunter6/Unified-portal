export type PageRecord = {
  pageNumber: number;
  originalText: string;
  translatedText?: string;
  needsOcr: boolean;
  status: 'pending' | 'extracted' | 'translated' | 'failed';
};

export type JobState = {
  id: string;
  userId: number;
  filename: string;
  storedFilename: string;
  inputPath: string;
  outputPath?: string;
  targetLang: string;
  status: 'processing' | 'completed' | 'error' | 'stopped';
  message?: string;
  progress: number; // 0..100
  totalPages: number;
  currentPage: number;
  pages: PageRecord[];
  createdAt: number;
  error?: string;
  stopRequested?: boolean;
};