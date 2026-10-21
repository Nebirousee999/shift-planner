import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { locations, userLocations, users, organizations } from "../../../db/schema.js";

export const locationsService = {
  async list(orgId: string) {
    return db
      .select()
      .from(locations)
      .where(and(eq(locations.orgId, orgId), eq(locations.isArchived, false)))
      .orderBy(locations.createdAt);
  },

  async create(input: {
    orgId: string;
    name: string;
    address?: string;
    city?: string;
    phone?: string;
  }) {
    const [org] = await db
      .select({ maxLocations: organizations.maxLocations })
      .from(organizations)
      .where(eq(organizations.id, input.orgId));

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(locations)
      .where(and(eq(locations.orgId, input.orgId), eq(locations.isArchived, false)));

    if (countRow.count >= (org?.maxLocations ?? 1)) {
      throw new Error("LOCATION_LIMIT_REACHED");
    }

    const [created] = await db
      .insert(locations)
      .values({
        orgId: input.orgId,
        name: input.name,
        address: input.address,
        city: input.city,
        phone: input.phone,
      })
      .returning();
    return created;
  },

  async update(input: {
    id: string;
    orgId: string;
    name?: string;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
  }) {
    const [updated] = await db
      .update(locations)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.phone !== undefined && { phone: input.phone }),
      })
      .where(and(eq(locations.id, input.id), eq(locations.orgId, input.orgId)))
      .returning();
    return updated;
  },

  async archive(id: string, orgId: string) {
    const [updated] = await db
      .update(locations)
      .set({ isArchived: true })
      .where(and(eq(locations.id, id), eq(locations.orgId, orgId)))
      .returning();
    return updated;
  },

  async getEmployees(locationId: string, orgId: string) {
    const [loc] = await db
      .select()
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.orgId, orgId)));
    if (!loc) throw new Error("LOCATION_NOT_FOUND");

    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        position: users.position,
      })
      .from(userLocations)
      .innerJoin(users, eq(users.id, userLocations.userId))
      .where(eq(userLocations.locationId, locationId));
  },

  async setEmployees(locationId: string, orgId: string, userIds: string[]) {
    const [loc] = await db
      .select()
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.orgId, orgId)));
    if (!loc) throw new Error("LOCATION_NOT_FOUND");

    if (userIds.length > 0) {
      const valid = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.orgId, orgId), inArray(users.id, userIds)));
      if (valid.length !== userIds.length) throw new Error("INVALID_USER_IDS");
    }

    await db.delete(userLocations).where(eq(userLocations.locationId, locationId));
    if (userIds.length > 0) {
      await db
        .insert(userLocations)
        .values(userIds.map((userId) => ({ userId, locationId })));
    }
    return { success: true, count: userIds.length };
  },
};