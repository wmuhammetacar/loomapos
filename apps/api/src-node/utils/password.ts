import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(raw: string) {
  return bcrypt.hash(raw, SALT_ROUNDS);
}

export async function verifyPassword(raw: string, hash: string) {
  return bcrypt.compare(raw, hash);
}
