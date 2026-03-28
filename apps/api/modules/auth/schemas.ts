import { z } from "zod";

export const registerSchema = z.object({
  tenantName: z.string().min(2).max(120),
  ownerName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  tenantId: z.string().cuid().optional()
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(16)
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(16).optional()
});
