import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import { env } from "../config/env";
import { ApiError } from "../utils/http";

export function requireInternalAdmin(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers["x-internal-admin-token"];

  if (typeof token !== "string" || !safeEqual(token, env.INTERNAL_ADMIN_TOKEN)) {
    return next(new ApiError(403, "Internal admin token is invalid"));
  }

  return next();
}

function safeEqual(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}
