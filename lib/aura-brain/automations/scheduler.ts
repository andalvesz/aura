/**
 * Future cron interface — no external scheduler in Sprint 4.
 */

export type CronLikeJob = {
  id: string;
  cronExpression: string;
  handler: "runAuraBrainDailyReview";
};

export const FUTURE_CRON_JOBS: CronLikeJob[] = [
  {
    id: "aura-brain-daily-review",
    cronExpression: "0 7 * * *",
    handler: "runAuraBrainDailyReview",
  },
];

export function listPreparedCronJobs(): CronLikeJob[] {
  return FUTURE_CRON_JOBS;
}
