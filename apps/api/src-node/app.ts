import cors from "cors";
import express from "express";
import helmet from "helmet";
import { authRouter } from "../modules/auth/routes";
import { adminRouter } from "../modules/admin/routes";
import { billingRouter } from "../modules/billing/routes";
import { checkoutRouter } from "../modules/checkout/routes";
import { devicesRouter } from "../modules/devices/routes";
import { licenseRouter } from "../modules/license/routes";
import { subscriptionRouter } from "../modules/subscription/routes";
import { tenantRouter } from "../modules/tenant/routes";
import { trialRouter } from "../modules/trial/routes";
import { usersRouter } from "../modules/users/routes";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middleware/error-handler";
import {
  adminMutationRateLimit,
  authRateLimit,
  defaultRateLimit,
  mutationRateLimit
} from "./middleware/rate-limit";

export function createApp() {
  const app = express();

  const allowedOrigins = env.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("CORS origin denied"));
      },
      credentials: true
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(defaultRateLimit);

  app.get("/health", (_req, res) => {
    return res.status(200).json({
      status: "ok",
      service: "loomapos-node-api",
      timestamp: new Date().toISOString()
    });
  });

  app.use("/auth", authRateLimit, authRouter);
  app.use("/tenant", tenantRouter);
  app.use("/users", usersRouter);
  app.use("/subscription", subscriptionRouter);
  app.use("/license", mutationRateLimit, licenseRouter);
  app.use("/devices", mutationRateLimit, devicesRouter);
  app.use("/billing", mutationRateLimit, billingRouter);
  app.use("/checkout", mutationRateLimit, checkoutRouter);
  app.use("/trial", mutationRateLimit, trialRouter);
  app.use("/admin", adminMutationRateLimit, adminRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
