import { eq, and, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../../../db/client.js";
import { users } from "../../../db/schema.js";


function generateTempPassword(length = 8): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

export const usersService = {
  async list(orgId: string) {
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        position: users.position,       // ← НОВОЕ
        hourlyRate: users.hourlyRate,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.orgId, orgId));
  },

  async create(input: {
    orgId: string;
    name: string;
    email: string;
    password?: string;
    role?: "OWNER" | "MANAGER" | "EMPLOYEE";
    position?: string;
    hourlyRate?: string;
    phone?: string;
  }) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email));
    if (existing.length > 0) throw new Error("EMAIL_TAKEN");

    const plainPassword = input.password ?? generateTempPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const [user] = await db
      .insert(users)
      .values({
        orgId: input.orgId,
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role ?? "EMPLOYEE",
        position: input.position,
        hourlyRate: input.hourlyRate,
        phone: input.phone,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        position: users.position,
        hourlyRate: users.hourlyRate,
        createdAt: users.createdAt,
      });

    return { user, tempPassword: input.password ? undefined : plainPassword };
  },

  async update(input: {
    id: string;
    orgId: string;
    name?: string;
    phone?: string | null;
    position?: string | null;
    role?: "OWNER" | "MANAGER" | "EMPLOYEE";
    hourlyRate?: string | null;
  }) {
    const [updated] = await db
      .update(users)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.position !== undefined && { position: input.position }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.hourlyRate !== undefined && {
          hourlyRate: input.hourlyRate,
        }),
      })
      .where(and(eq(users.id, input.id), eq(users.orgId, input.orgId)))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        position: users.position,
        hourlyRate: users.hourlyRate,
        createdAt: users.createdAt,
      });
    return updated;
  },

  async remove(id: string, orgId: string, requesterId: string) {
    // Нельзя удалить самого себя
    if (id === requesterId) throw new Error("CANNOT_DELETE_SELF");

    const [deleted] = await db
      .delete(users)
      .where(and(eq(users.id, id), eq(users.orgId, orgId)))
      .returning({ id: users.id });
    return deleted;
  },
};