import { Queue } from "bullmq";
import IORedis from "ioredis";
import { mustEnv } from "@/lib/config";

let connection: IORedis | null = null;
let queue: Queue | null = null;

export function redisConnection() {
  if (!connection) connection = new IORedis(mustEnv("REDIS_URL"), { maxRetriesPerRequest: null });
  return connection;
}

export function jobsQueue() {
  if (!queue) queue = new Queue("reviewflow", { connection: redisConnection() });
  return queue;
}

export async function enqueue(name: string, data: Record<string, unknown>, jobId: string) {
  return jobsQueue().add(name, data, {
    jobId,
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 500
  });
}
