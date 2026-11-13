import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { areas, locations } from "../../../db/schema.js";

export const areasService = {
  async list(orgId: string, locationId?: string) {
    const cond = [eq(areas.orgId, orgId)];
    if (locationId) cond.push(eq(areas.locationId, locationId));
    return db.select().from(areas).where(and(...cond)).orderBy(areas.name);
  },

  async create(input: { orgId: string; locationId: string; name: string }) {
    const name = input.name.trim();
    if (!name) throw new Error("NAME_REQUIRED");

    const [loc] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, input.locationId), eq(locations.orgId, input.orgId)));
    if (!loc) throw new Error("LOCATION_NOT_FOUND");

    // 👇 регистронезависимая проверка
    const [existing] = await db
      .select()
      .from(areas)
      .where(
        and(
          eq(areas.orgId, input.orgId),
          eq(areas.locationId, input.locationId),
          sql`LOWER(TRIM(${areas.name})) = LOWER(TRIM(${name}))`,
        ),
      );
    if (existing) return existing;

    const [created] = await db
      .insert(areas)
      .values({ orgId: input.orgId, locationId: input.locationId, name })
      .returning();
    return created;
  },

  async update(id: string, orgId: string, name: string) {
    const [updated] = await db
      .update(areas)
      .set({ name: name.trim() })
      .where(and(eq(areas.id, id), eq(areas.orgId, orgId)))
      .returning();
    if (!updated) throw new Error("NOT_FOUND");
    return updated;
  },

  async remove(id: string, orgId: string) {
    const [deleted] = await db
      .delete(areas)
      .where(and(eq(areas.id, id), eq(areas.orgId, orgId)))
      .returning();
    return deleted;
  },

  async copy(input: { orgId: string; areaIds: string[]; targetLocationId: string }) {
    if (input.areaIds.length === 0) return { copied: 0, skipped: 0 };

    const [target] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(and(eq(locations.id, input.targetLocationId), eq(locations.orgId, input.orgId)));
    if (!target) throw new Error("LOCATION_NOT_FOUND");

    const sourceAreas = await db
      .select()
      .from(areas)
      .where(and(eq(areas.orgId, input.orgId), inArray(areas.id, input.areaIds)));
    if (sourceAreas.length === 0) return { copied: 0, skipped: 0 };

    // 👇 существующие имена в целевой точке — регистронезависимо
    const existingInTarget = await db
      .select({ name: areas.name })
      .from(areas)
      .where(and(eq(areas.orgId, input.orgId), eq(areas.locationId, input.targetLocationId)));
    const existingNames = new Set(existingInTarget.map((e) => e.name.toLowerCase().trim()));

    const toInsert = [];
    let skipped = 0;
    const seenInBatch = new Set<string>();
    for (const a of sourceAreas) {
      if (a.locationId === input.targetLocationId) { skipped++; continue; }
      const norm = a.name.toLowerCase().trim();
      if (existingNames.has(norm) || seenInBatch.has(norm)) { skipped++; continue; }
      seenInBatch.add(norm);
      toInsert.push({ orgId: input.orgId, locationId: input.targetLocationId, name: a.name });
    }

    if (toInsert.length > 0) await db.insert(areas).values(toInsert);
    return { copied: toInsert.length, skipped };
  },
};