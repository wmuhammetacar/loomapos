import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { ApiError } from "../utils/http";
import { verifyAccessToken } from "../utils/jwt";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication required"));
  }

  try {
    const token = header.replace("Bearer ", "").trim();
    req.auth = verifyAccessToken(token);
    return next();
  } catch {
    return next(new ApiError(401, "Invalid or expired token"));
  }
}

export function requireRoles(roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (!roles.includes(req.auth.role)) {
      return next(new ApiError(403, "Forbidden"));
    }

    return next();
  };
}
