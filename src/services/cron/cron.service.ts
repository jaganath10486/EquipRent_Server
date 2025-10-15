import nodeCron, { NodeCron, TaskOptions, ScheduledTask } from "node-cron";

export class CronService {
  constructor() {}
  initialzeCronJob = (
    cronExpression: string,
    jobFun: () => Promise<void>,
    options: TaskOptions
  ) => {
    nodeCron.schedule(cronExpression, jobFun, { ...options });
  };
}
