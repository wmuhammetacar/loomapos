import Redis from "ioredis";
import { env } from "../../src-node/config/env";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableReadyCheck: false
  });

if (env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
