import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../infra/prisma/client";
import { requireAuth, requireRoles } from "../../src-node/middleware/auth";
import { asyncHandler, ApiError, readRouteParam } from "../../src-node/utils/http";
import { hashPassword } from "../../src-node/utils/password";
import { CUSTOMER_INTERNAL_ROLES } from "../../src-node/security/roles";

const createUserSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.nativeEnum(UserRole)
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.enum(["active", "invited", "suspended"]).optional()
});

export const usersRouter = Router();

usersRouter.use(requireAuth);
usersRouter.use(requireRoles(CUSTOMER_INTERNAL_ROLES));

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: {
        tenantId: req.auth!.tenantId
      },
      orderBy: {
        createdAt: "asc"
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    return res.json({ users });
  })
);

usersRouter.post(
  "/",
  requireRoles([UserRole.owner, UserRole.admin]),
  asyncHandler(async (req, res) => {
    const body = createUserSchema.parse(req.body);

    const [activeStaffCount, activeLicense] = await Promise.all([
      prisma.user.count({
        where: {
          tenantId: req.auth!.tenantId,
          status: "active"
        }
      }),
      prisma.license.findFirst({
        where: {
          tenantId: req.auth!.tenantId,
          status: "active"
        },
        orderBy: {
          issuedAt: "desc"
        }
      })
    ]);

    if (activeLicense && activeStaffCount >= activeLicense.maxStaff) {
      throw new ApiError(409, "Staff limit reached for current license");
    }

    const exists = await prisma.user.findFirst({
      where: {
        tenantId: req.auth!.tenantId,
        email: body.email
      }
    });

    if (exists) {
      throw new ApiError(409, "User already exists for this tenant");
    }

    const user = await prisma.user.create({
      data: {
        tenantId: req.auth!.tenantId,
        fullName: body.fullName,
        email: body.email,
        passwordHash: await hashPassword(body.password),
        role: body.role,
        status: "active"
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    return res.status(201).json({ user });
  })
);

usersRouter.patch(
  "/:userId",
  requireRoles([UserRole.owner, UserRole.admin]),
  asyncHandler(async (req, res) => {
    const body = updateUserSchema.parse(req.body);
    const userId = readRouteParam(req.params.userId, "userId");

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: req.auth!.tenantId
      }
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const updated = await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        ...body
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return res.json({ user: updated });
  })
);

usersRouter.delete(
  "/:userId",
  requireRoles([UserRole.owner, UserRole.admin]),
  asyncHandler(async (req, res) => {
    const userId = readRouteParam(req.params.userId, "userId");

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: req.auth!.tenantId
      }
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (user.id === req.auth!.userId) {
      throw new ApiError(400, "You cannot deactivate your own user");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: "suspended"
      }
    });

    return res.status(204).send();
  })
);
