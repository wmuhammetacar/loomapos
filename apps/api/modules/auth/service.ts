import crypto from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "../../infra/prisma/client";
import { env } from "../../src-node/config/env";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  type AccessTokenPayload
} from "../../src-node/utils/jwt";

export function generateLicenseKey() {
  const chunk = () => crypto.randomBytes(3).toString("hex").toUpperCase();
  return `LIC-${chunk()}-${chunk()}-${chunk()}`;
}

export async function issueTokens(user: User) {
  const payload: AccessTokenPayload = {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({
    userId: user.id,
    tenantId: user.tenantId
  });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)
    }
  });

  return { accessToken, refreshToken };
}
