import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT } from "@configs/environment";
import {
  Job,
  JobsOptions,
  Queue,
  QueueEvents,
  Worker,
  WorkerOptions,
} from "bullmq";
import { Redis } from "ioredis";
export class BullMQService {
  public connection: any;
  private queues;
  private workers;
  private queueEvents;
  constructor() {
    this.getConnection();
    this.queues = new Map();
    this.workers = new Map();
    this.queueEvents = new Map();
  }
  getConnection() {
    if (!this.connection) {
      this.connection = new Redis({
        host: REDIS_HOST,
        port: 13250,
        password: REDIS_PASSWORD,
        maxRetriesPerRequest: null,
        connectTimeout: 6000,
      });

      this.connection.on("connect", () => {
        console.log("Io Redis connected successfully");
      });

      this.connection.on("error", (error: any) => {
        console.error("Io Redis connection error:", error);
      });

      this.connection.on("close", () => {
        console.log("Redis connection closed");
      });
    }

    return this.connection;
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
    }
  }

  createQueue(queueName: string, options?: Partial<WorkerOptions>) {
    if (this.queues.has(queueName)) {
      return this.queues.get(queueName);
    }

    const defaultOptions = {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 5000,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
      ...options,
    };

    const queue = new Queue(queueName, defaultOptions);
    this.queues.set(queueName, queue);

    this.setupQueueEvents(queueName);

    return queue;
  }

  createWorker(
    queueName: string,
    processor: (job: Job) => Promise<any>,
    options?: Partial<WorkerOptions>
  ) {
    if (this.workers.has(queueName)) {
      console.warn(`Worker for queue ${queueName} already exists`);
      return this.workers.get(queueName);
    }

    const defaultOptions: WorkerOptions = {
      connection: this.connection,
      removeOnComplete: {
        count: 100,
      },
      removeOnFail: {
        count: 5000,
      },
      concurrency: 5,
      ...(options && options),
    };

    const worker = new Worker(queueName, processor, defaultOptions);
    this.workers.set(queueName, worker);

    // Set up worker events
    // this.setupWorkerEvents(queueName, worker);

    return worker;
  }

  // Setup queue events for monitoring
  private setupQueueEvents(queueName: string) {
    const queueEvents = new QueueEvents(queueName, {
      connection: this.connection,
    });

    this.queueEvents.set(queueName, queueEvents);

    queueEvents.on("waiting", ({ jobId }) => {
      console.log(`Job ${jobId} is waiting in queue ${queueName}`);
    });

    queueEvents.on("active", ({ jobId, prev }) => {
      console.log(
        `Job ${jobId} is now active in queue ${queueName}; previous status was ${prev}`
      );
    });

    queueEvents.on("completed", ({ jobId, returnvalue }) => {
      console.log(
        `Job ${jobId} completed in queue ${queueName} with result:`,
        returnvalue
      );
    });

    queueEvents.on("failed", ({ jobId, failedReason }) => {
      console.error(`Job ${jobId} failed in queue ${queueName}:`, failedReason);
    });
  }

  // Setup worker events
  setupWorkerEvents(queueName: string, worker: Worker) {
    worker.on("completed", (job) => {
      console.log(`Worker completed job ${job.id} in queue ${queueName}`);
    });

    worker.on("failed", (job, err) => {
      console.error(`Worker failed job ${job?.id} in queue ${queueName}:`, err);
    });

    worker.on("error", (err) => {
      console.error(`Worker error in queue ${queueName}:`, err);
    });

    worker.on("stalled", (jobId) => {
      console.warn(`Job ${jobId} stalled in queue ${queueName}`);
    });
  }

  // Get queue by name
  getQueue(queueName: string) {
    return this.queues.get(queueName);
  }

  // Get worker by name
  getWorker(queueName: string) {
    return this.workers.get(queueName);
  }

  // Add job to queue
  async addJob(
    queueName: string,
    jobName: string,
    data: Record<any, any>,
    options: Partial<JobsOptions>
  ) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return await queue.add(jobName, data, options);
  }

  // Get queue statistics
  async getQueueStats(queueName: string) {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  async close() {
    // Close all workers
    for (const [name, worker] of this.workers) {
      console.log(`Closing worker for queue: ${name}`);
      await worker.close();
    }

    // Close all queue events
    for (const [name, queueEvents] of this.queueEvents) {
      console.log(`Closing queue events for: ${name}`);
      await queueEvents.close();
    }

    // Close all queues
    for (const [name, queue] of this.queues) {
      console.log(`Closing queue: ${name}`);
      await queue.close();
    }

    // Clear maps
    this.workers.clear();
    this.queueEvents.clear();
    this.queues.clear();
  }
}

export const bulMQService = new BullMQService();
