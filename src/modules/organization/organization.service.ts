import { eq } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { organizations } from "../../../db/schema.js";

export const organizationService = {
  async get(orgId: string) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));
    return org ?? null;
  },

  async update(input: {
    orgId: string;
    name?: string;
    city?: string | null;
    directorName?: string | null;
    inn?: string | null;
    legalAddress?: string | null;
    timeTrackingEnabled?: boolean;
    overtimeMultiplier1?: string; // 👈
    overtimeMultiplier2?: string; // 👈
    positionHeaderOpacity?: number;
    positionRowOpacity?: number;
    taxRate?: string;
  }) {
    const [updated] = await db
      .update(organizations)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.directorName !== undefined && { directorName: input.directorName }),
        ...(input.inn !== undefined && { inn: input.inn }),
        ...(input.legalAddress !== undefined && { legalAddress: input.legalAddress }),
        ...(input.timeTrackingEnabled !== undefined && { timeTrackingEnabled: input.timeTrackingEnabled }),
        // 👇 Добавляем сохранение коэффициентов
        ...(input.overtimeMultiplier1 !== undefined && { overtimeMultiplier1: input.overtimeMultiplier1 }),
        ...(input.overtimeMultiplier2 !== undefined && { overtimeMultiplier2: input.overtimeMultiplier2 }),
        ...(input.positionHeaderOpacity !== undefined && { positionHeaderOpacity: input.positionHeaderOpacity }),
        ...(input.positionRowOpacity !== undefined && { positionRowOpacity: input.positionRowOpacity }),
        ...(input.taxRate !== undefined && { taxRate: input.taxRate }),
      })
      .where(eq(organizations.id, input.orgId))
      .returning();
    return updated;
  }
};