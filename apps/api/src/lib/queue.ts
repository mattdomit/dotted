import { Queue, Worker, Job } from "bullmq";
import { logger } from "./logger";

const connection = process.env.REDIS_URL
  ? { host: new URL(process.env.REDIS_URL).hostname, port: Number(new URL(process.env.REDIS_URL).port) || 6379 }
  : null;

// Queue definitions
export const emailQueue = connection ? new Queue("email", { connection }) : null;
export const smsQueue = connection ? new Queue("sms", { connection }) : null;
export const cycleQueue = connection ? new Queue("daily-cycle", { connection }) : null;

// Type-safe job dispatchers
export async function enqueueEmail(data: { to: string; subject: string; body: string }) {
  if (!emailQueue) {
    logger.warn("Email queue unavailable (Redis not configured), sending inline");
    return null;
  }
  return emailQueue.add("send-email", data, { attempts: 3, backoff: { type: "exponential", delay: 5000 } });
}

export async function enqueueSms(data: { to: string; body: string }) {
  if (!smsQueue) {
    logger.warn("SMS queue unavailable (Redis not configured), sending inline");
    return null;
  }
  return smsQueue.add("send-sms", data, { attempts: 3, backoff: { type: "exponential", delay: 5000 } });
}

export async function enqueueCyclePhase(data: { targetStatus: string }) {
  if (!cycleQueue) {
    logger.warn("Cycle queue unavailable (Redis not configured), running inline");
    return null;
  }
  return cycleQueue.add("run-cycle-phase", data, { attempts: 2, backoff: { type: "fixed", delay: 10000 } });
}

// Worker factory — call from worker entry point
export function startWorkers() {
  if (!connection) {
    logger.warn("Redis not configured — background workers disabled");
    return [];
  }

  const workers: Worker[] = [];

  // Email worker
  workers.push(
    new Worker(
      "email",
      async (job: Job) => {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Dotted <notifications@dotted.app>",
          to: job.data.to,
          subject: job.data.subject,
          text: job.data.body,
        });
        logger.info({ to: job.data.to }, "Email sent via queue");
      },
      { connection }
    )
  );

  // SMS worker
  workers.push(
    new Worker(
      "sms",
      async (job: Job) => {
        const { sendSms } = await import("./twilio");
        await sendSms(job.data.to, job.data.body);
        logger.info({ to: job.data.to }, "SMS sent via queue");
      },
      { connection }
    )
  );

  // Daily cycle worker
  workers.push(
    new Worker(
      "daily-cycle",
      async (job: Job) => {
        const { CycleStatus } = await import("@dotted/db");
        const { runDailyCycleForAllZones } = await import("../jobs/daily-cycle");
        await runDailyCycleForAllZones(job.data.targetStatus as typeof CycleStatus[keyof typeof CycleStatus]);
        logger.info({ status: job.data.targetStatus }, "Daily cycle phase completed via queue");
      },
      { connection }
    )
  );

  for (const w of workers) {
    w.on("failed", (job, err) => {
      logger.error({ job: job?.name, err }, "Queue job failed");
    });
  }

  logger.info(`Started ${workers.length} background workers`);
  return workers;
}
