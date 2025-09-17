import { Job, Queue, Worker } from "bullmq";
import { bulMQService } from "./bullmq.service";
import { EmailService } from "./email.service";
import HttpExceptionError from "@src/exception/httpexception";
import { EMAIL_ADDRESS } from "@configs/environment";
import { EmailInterface } from "@interfaces/email.interface";

class EmailQueueService {
  queueName = "email-queue";
  private emailQueue: Queue;
  private emailWorker: Worker;
  private emailService;
  constructor() {
    this.emailService = EmailService.getInstance();
    this.emailQueue = bulMQService.createQueue(this.queueName);
    this.emailWorker = bulMQService.createWorker(
      this.queueName,
      this.proccessJob,
      { concurrency: 3 }
    );
  }
  proccessJob = async (job: Job) => {
    // console.log("job :", job);
    console.log("job data :", job.data);
    try {
      const { from, to, subject, html, text } = job.data;
      const res = await this.emailService.sendEmail({
        from,
        to,
        subject,
        html,
        text,
      });
      if (!res) {
        throw new HttpExceptionError(500, "Could not able to send the email");
      }
      return {
        success: true,
        data: res,
      };
    } catch (err) {
      throw err;
    }
  };

  sendEmail = async (data: EmailInterface) => {
    try {
      const job = await bulMQService.addJob(
        this.queueName,
        "send:email",
        data,
        {
          delay: 100,
          priority: 0,
        }
      );
      return {
        jobId: job.id,
        queue: "event-queue",
        status: "queued",
      };
    } catch (err) {
      throw new HttpExceptionError(500, "Error in adding the email to queue");
    }
  };
  getEmailStatus = async (jobId: string) => {
    const queue = bulMQService.getQueue(this.queueName);
    if (!queue) {
      throw new Error(`Queue ${this.queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      opts: job.opts,
    };
  };
}

export const emailQueueService = new EmailQueueService();
