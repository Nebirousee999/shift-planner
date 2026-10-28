import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { positionTemplates, users } from "../../../db/schema.js";
import { POSITION_PALETTE } from "../../lib/colors.js";

export const positionsService = {
  async _syncFromUsers(orgId: string) {
    const userPositions = await db
      .selectDistinct({ position: users.position })
      .from(users)
      .where(and(eq(users.orgId, orgId), isNotNull(users.position)));

    const existing = await db
      .select({ name: positionTemplates.name })
      .from(positionTemplates)
      .where(eq(positionTemplates.orgId, orgId));
    const existingNames = new Set(existing.map((p) => p.name));

    const missing = userPositions
      .map((u) => u.position?.trim())
      .filter((p): p is string => !!p && !existingNames.has(p));

    if (missing.length > 0) {
      const startIdx = existing.length;
      await db.insert(positionTemplates).values(
        missing.map((name, i) => ({
          orgId,
          name,
          color: POSITION_PALETTE[(startIdx + i) % POSITION_PALETTE.length],
        }))
      );
    }
  },

  async list(orgId: string) {
    await this._syncFromUsers(orgId);

    let all = await db
      .select()
      .from(positionTemplates)
      .where(eq(positionTemplates.orgId, orgId));

    // Автораскраска, если все цвета дефолтные (после миграции)
    const colors = new Set(all.map((p) => p.color));
    if (all.length > 1 && colors.size === 1 && all[0].color === "#3B82F6") {
      for (let i = 0; i < all.length; i++) {
        await db
          .update(positionTemplates)
          .set({ color: POSITION_PALETTE[i % POSITION_PALETTE.length] })
          .where(eq(positionTemplates.id, all[i].id));
      }
      all = await db
        .select()
        .from(positionTemplates)
        .where(eq(positionTemplates.orgId, orgId));
    }

    return all.sort((a, b) => a.name.localeCompare(b.name));
  },

  async create(input: { orgId: string; name: string; color?: string }) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error("NAME_REQUIRED");

    const existing = await db
      .select()
      .from(positionTemplates)
      .where(
        and(
          eq(positionTemplates.orgId, input.orgId),
          eq(positionTemplates.name, trimmed),
        )
      );
    if (existing.length > 0) {
      // Если уже есть — можно обновить цвет
      if (input.color && existing[0].color !== input.color) {
        const [updated] = await db
          .update(positionTemplates)
          .set({ color: input.color })
          .where(eq(positionTemplates.id, existing[0].id))
          .returning();
        return updated;
      }
      return existing[0];
    }

    const count = await db
      .select({ id: positionTemplates.id })
      .from(positionTemplates)
      .where(eq(positionTemplates.orgId, input.orgId));
    const color = input.color ?? POSITION_PALETTE[count.length % POSITION_PALETTE.length];

    const [created] = await db
      .insert(positionTemplates)
      .values({ orgId: input.orgId, name: trimmed, color })
      .returning();
    return created;
  },

  async update(id: string, orgId: string, input: { name?: string; color?: string }) {
    const [updated] = await db
      .update(positionTemplates)
      .set({
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.color !== undefined && { color: input.color }),
      })
      .where(
        and(
          eq(positionTemplates.id, id),
          eq(positionTemplates.orgId, orgId),
        )
      )
      .returning();
    return updated;
  },

  async remove(id: string, orgId: string) {
    const [deleted] = await db
      .delete(positionTemplates)
      .where(
        and(
          eq(positionTemplates.id, id),
          eq(positionTemplates.orgId, orgId),
        )
      )
      .returning();
    return deleted;
  },
};