import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: ".env.node" });

autoLoadEnv();

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(5001),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    INTERNAL_ADMIN_TOKEN: z.string().min(24),
    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_ACCESS_TTL_MIN: z.coerce.number().int().positive().default(15),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
    PAYMENT_PROVIDER: z.string().default("mock"),
    PAYMENT_WEBHOOK_SECRET: z.string().min(16),
    ALLOWED_ORIGINS: z.string().default("http://127.0.0.1:3100,http://127.0.0.1:3000"),
    OFFLINE_GRACE_HOURS: z.coerce.number().int().positive().default(72)
  })
  .superRefine((value, ctx) => {
    const weakAdminToken =
      value.INTERNAL_ADMIN_TOKEN.toLowerCase().includes("change-me") ||
      value.INTERNAL_ADMIN_TOKEN.toLowerCase().includes("replace") ||
      value.INTERNAL_ADMIN_TOKEN.length < 32;

    if (value.NODE_ENV === "production" && weakAdminToken) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["INTERNAL_ADMIN_TOKEN"],
        message: "INTERNAL_ADMIN_TOKEN is too weak for production"
      });
    }
  });

export function parseEnv(rawEnv: NodeJS.ProcessEnv) {
  return envSchema.parse(rawEnv);
}

export const env = parseEnv(process.env);

function autoLoadEnv() {
  if (process.env.DATABASE_URL) {
    return;
  }

  dotenv.config({ path: ".env" });
}
