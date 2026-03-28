import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "../infra/prisma/client";
import { redis } from "../infra/redis/client";

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[loomapos-node-api] listening on :${env.PORT}`);
});

void redis
  .connect()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("[loomapos-node-api] redis connected");
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.warn("[loomapos-node-api] redis unavailable, continuing without cache", error?.message ?? error);
  });

async function shutdown(signal: string) {
  // eslint-disable-next-line no-console
  console.log(`[loomapos-node-api] shutdown requested (${signal})`);

  server.close(async () => {
    await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
