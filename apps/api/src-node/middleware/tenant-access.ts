import type { Request } from "express";
import { ApiError } from "../utils/http";

export function assertSameTenant(req: Request, tenantId: string) {
  if (!req.auth) {
    throw new ApiError(401, "Authentication required");
  }

  if (req.auth.tenantId !== tenantId && req.auth.role !== "admin") {
    throw new ApiError(403, "Cross-tenant access denied");
  }
}
