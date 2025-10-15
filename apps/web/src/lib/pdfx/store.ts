import { JobState } from './types';

const jobs = new Map<string, JobState>();

export const JobStore = {
  set(job: JobState) {
    jobs.set(job.id, job);
  },
  get(id: string) {
    return jobs.get(id);
  },
  update(id: string, patch: Partial<JobState>) {
    const cur = jobs.get(id);
    if (!cur) return;
    const updated = { ...cur, ...patch };
    jobs.set(id, updated);
  },
  listByUser(userId: number) {
    return Array.from(jobs.values()).filter(j => j.userId === userId);
  },
  remove(id: string) {
    jobs.delete(id);
  },
};