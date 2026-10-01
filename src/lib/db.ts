import postgres from "postgres";
import { mustEnv } from "@/lib/config";

let client: ReturnType<typeof postgres> | null = null;

export function db() {
  if (!client) {
    client = postgres(mustEnv("DATABASE_URL"), {
      max: Number(process.env.DB_POOL_SIZE || 10),
      idle_timeout: 20,
      connect_timeout: 10,
      transform: postgres.camel
    });
  }
  return client;
}
