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
  }) {
    const [updated] = await db
      .update(organizations)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.directorName !== undefined && {
          directorName: input.directorName,
        }),
        ...(input.inn !== undefined && { inn: input.inn }),
        ...(input.legalAddress !== undefined && {
          legalAddress: input.legalAddress,
        }),
      })
      .where(eq(organizations.id, input.orgId))
      .returning();
    return updated;
  },
};