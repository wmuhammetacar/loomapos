import { UserRole } from "@prisma/client";

export const CUSTOMER_INTERNAL_ROLES: UserRole[] = [UserRole.owner, UserRole.admin, UserRole.staff];

export function isCustomerInternalRole(role: UserRole) {
  return CUSTOMER_INTERNAL_ROLES.includes(role);
}

