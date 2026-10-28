import { eq, and, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../../../db/client.js";
import {
  users,
  scheduledShifts,
  shiftSwapRequests,
  shiftChangeRequests,
  vacations,
  locations,
  areas,
  userLocations,
  userAreas,
  positionTemplates,
} from "../../../db/schema.js";

function generateTempPassword(length = 8): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

import { POSITION_PALETTE } from "../../lib/colors.js";

async function ensurePosition(orgId: string, rawName: string): Promise<string> {
  const name = rawName.trim();
  if (!name) return name;
  const existing = await db
    .select({ id: positionTemplates.id })
    .from(positionTemplates)
    .where(
      and(
        eq(positionTemplates.orgId, orgId),
        eq(positionTemplates.name, name),
      )
    );
  if (existing.length === 0) {
    const count = await db
      .select({ id: positionTemplates.id })
      .from(positionTemplates)
      .where(eq(positionTemplates.orgId, orgId));
    const color = POSITION_PALETTE[count.length % POSITION_PALETTE.length];
    await db.insert(positionTemplates).values({ orgId, name, color });
  }
  return name;
}

/** Возвращает валидные ID локаций (помещений), принадлежащих организации. */
async function resolveAreaIds(orgId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const valid = await db
    .select({ id: areas.id })
    .from(areas)
    .where(and(eq(areas.orgId, orgId), inArray(areas.id, ids)));
  return valid.map((a) => a.id);
}

/** Возвращает валидные ID точек, принадлежащих организации. */
async function resolveLocationIds(orgId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const valid = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.orgId, orgId), inArray(locations.id, ids)));
  return valid.map((l) => l.id);
}

export const usersService = {
  async list(orgId: string) {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        position: users.position,
        hourlyRate: users.hourlyRate,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.orgId, orgId));

    const locLinks = await db
      .select({
        userId: userLocations.userId,
        locationId: userLocations.locationId,
      })
      .from(userLocations)
      .innerJoin(users, eq(users.id, userLocations.userId))
      .where(eq(users.orgId, orgId));

    const locMap = new Map<string, string[]>();
    for (const l of locLinks) {
      if (!locMap.has(l.userId)) locMap.set(l.userId, []);
      locMap.get(l.userId)!.push(l.locationId);
    }

    const areaLinks = await db
      .select({ userId: userAreas.userId, areaId: userAreas.areaId })
      .from(userAreas)
      .innerJoin(users, eq(users.id, userAreas.userId))
      .where(eq(users.orgId, orgId));

    const areaMap = new Map<string, string[]>();
    for (const l of areaLinks) {
      if (!areaMap.has(l.userId)) areaMap.set(l.userId, []);
      areaMap.get(l.userId)!.push(l.areaId);
    }

    return rows.map((u) => ({
      ...u,
      locationIds: locMap.get(u.id) ?? [],
      areaIds: areaMap.get(u.id) ?? [],
    }));
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
    locationIds?: string[];
    areaIds?: string[];
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

    if (input.position) {
      await ensurePosition(input.orgId, input.position);
    }

    // Точки
    let validLocIds: string[] = [];
    if (input.locationIds && input.locationIds.length > 0) {
      validLocIds = await resolveLocationIds(input.orgId, input.locationIds);
      if (validLocIds.length > 0) {
        await db
          .insert(userLocations)
          .values(validLocIds.map((locationId) => ({ userId: user.id, locationId })));
      }
    }

    // Локации (помещения)
    let validAreaIds: string[] = [];
    if (input.areaIds && input.areaIds.length > 0) {
      validAreaIds = await resolveAreaIds(input.orgId, input.areaIds);
      if (validAreaIds.length > 0) {
        await db
          .insert(userAreas)
          .values(validAreaIds.map((areaId) => ({ userId: user.id, areaId })));
      }
    }

    return {
      user: { ...user, locationIds: validLocIds, areaIds: validAreaIds },
      tempPassword: input.password ? undefined : plainPassword,
    };
  },

  async update(input: {
    id: string;
    orgId: string;
    name?: string;
    phone?: string | null;
    position?: string | null;
    role?: "OWNER" | "MANAGER" | "EMPLOYEE";
    hourlyRate?: string | null;
    locationIds?: string[];
    areaIds?: string[];
  }) {
    const [updated] = await db
      .update(users)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.position !== undefined && { position: input.position }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.hourlyRate !== undefined && { hourlyRate: input.hourlyRate }),
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

    if (!updated) return null;

    if (input.position) {
      await ensurePosition(input.orgId, input.position);
    }

    // Точки
    if (input.locationIds !== undefined) {
      const validLocIds = await resolveLocationIds(input.orgId, input.locationIds);
      await db.delete(userLocations).where(eq(userLocations.userId, input.id));
      if (validLocIds.length > 0) {
        await db
          .insert(userLocations)
          .values(validLocIds.map((locationId) => ({ userId: input.id, locationId })));
      }
    }

    // Локации
    if (input.areaIds !== undefined) {
      const validAreaIds = await resolveAreaIds(input.orgId, input.areaIds);
      await db.delete(userAreas).where(eq(userAreas.userId, input.id));
      if (validAreaIds.length > 0) {
        await db
          .insert(userAreas)
          .values(validAreaIds.map((areaId) => ({ userId: input.id, areaId })));
      }
    }

    const locs = await db
      .select({ locationId: userLocations.locationId })
      .from(userLocations)
      .where(eq(userLocations.userId, input.id));

    const ars = await db
      .select({ areaId: userAreas.areaId })
      .from(userAreas)
      .where(eq(userAreas.userId, input.id));

    return {
      ...updated,
      locationIds: locs.map((l) => l.locationId),
      areaIds: ars.map((a) => a.areaId),
    };
  },

  async remove(id: string, orgId: string, requesterId: string) {
    if (id === requesterId) throw new Error("CANNOT_DELETE_SELF");

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id), eq(users.orgId, orgId)));
    if (!user) return null;

    // 1. Смены: обнуляем userId (остаются в графике, но без назначения)
    await db
      .update(scheduledShifts)
      .set({ userId: null })
      .where(eq(scheduledShifts.userId, id));

    // 2. Обмены
    await db
      .delete(shiftSwapRequests)
      .where(eq(shiftSwapRequests.requestedBy, id));
    await db
      .delete(shiftSwapRequests)
      .where(eq(shiftSwapRequests.swapWithUserId, id));

    // 3. Запросы на изменение смен (все 4 поля с FK на users)
    await db
      .delete(shiftChangeRequests)
      .where(eq(shiftChangeRequests.requestedBy, id));
    await db
      .delete(shiftChangeRequests)
      .where(eq(shiftChangeRequests.targetUserId, id));
    await db
      .delete(shiftChangeRequests)
      .where(eq(shiftChangeRequests.oldUserId, id));
    await db
      .delete(shiftChangeRequests)
      .where(eq(shiftChangeRequests.newUserId, id));

    // 4. Отпуска
    await db.delete(vacations).where(eq(vacations.userId, id));

    // Каскадом удалятся: userLocations, userAreas, timeEntries, availability,
    // payments, userMessengers, sickLeaves, generatedDocuments.userId → set null.
    const [deleted] = await db
      .delete(users)
      .where(and(eq(users.id, id), eq(users.orgId, orgId)))
      .returning({ id: users.id });
    return deleted;
  },

  async bulkUpdate(input: {
    orgId: string;
    userIds: string[];
    action:
      | "addToLocation"
      | "addToArea"
      | "setPosition"
      | "setRate"
      | "setRole";
    value: string | null;
  }): Promise<{ updated: number; skipped?: number }> {
    if (input.userIds.length === 0) return { updated: 0 };

    const validUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.orgId, input.orgId), inArray(users.id, input.userIds)));
    const validIds = validUsers.map((u) => u.id);
    if (validIds.length === 0) return { updated: 0 };

    switch (input.action) {
      case "addToLocation": {
        if (!input.value) throw new Error("LOCATION_REQUIRED");
        const [loc] = await db
          .select({ id: locations.id })
          .from(locations)
          .where(
            and(eq(locations.id, input.value), eq(locations.orgId, input.orgId)),
          );
        if (!loc) throw new Error("LOCATION_NOT_FOUND");

        const existing = await db
          .select({ userId: userLocations.userId })
          .from(userLocations)
          .where(
            and(
              eq(userLocations.locationId, loc.id),
              inArray(userLocations.userId, validIds),
            ),
          );
        const existingSet = new Set(existing.map((e) => e.userId));
        const toInsert = validIds
          .filter((id) => !existingSet.has(id))
          .map((id) => ({ userId: id, locationId: loc.id }));
        if (toInsert.length > 0) await db.insert(userLocations).values(toInsert);
        return { updated: validIds.length };
      }

      case "addToArea": {
        if (!input.value) throw new Error("AREA_REQUIRED");
        const [area] = await db
          .select({ id: areas.id, locationId: areas.locationId })
          .from(areas)
          .where(and(eq(areas.id, input.value), eq(areas.orgId, input.orgId)));
        if (!area) throw new Error("AREA_NOT_FOUND");

        // 1) Привязка к точке локации (если ещё нет)
        const existingLoc = await db
          .select({ userId: userLocations.userId })
          .from(userLocations)
          .where(
            and(
              eq(userLocations.locationId, area.locationId),
              inArray(userLocations.userId, validIds),
            ),
          );
        const inPointSet = new Set(existingLoc.map((e) => e.userId));
        const toAddToPoint = validIds.filter((id) => !inPointSet.has(id));
        if (toAddToPoint.length > 0) {
          await db
            .insert(userLocations)
            .values(toAddToPoint.map((userId) => ({ userId, locationId: area.locationId })));
        }

        // 2) Привязка к локации
        const existingAreas = await db
          .select({ userId: userAreas.userId })
          .from(userAreas)
          .where(and(eq(userAreas.areaId, area.id), inArray(userAreas.userId, validIds)));
        const existingAreaSet = new Set(existingAreas.map((e) => e.userId));
        const toAddToArea = validIds.filter((id) => !existingAreaSet.has(id));
        if (toAddToArea.length > 0) {
          await db.insert(userAreas).values(toAddToArea.map((userId) => ({ userId, areaId: area.id })));
        }

        return { updated: validIds.length };
      }

      case "setPosition": {
        const value = input.value?.trim() || null;
        await db
          .update(users)
          .set({ position: value })
          .where(and(eq(users.orgId, input.orgId), inArray(users.id, validIds)));
        if (value) await ensurePosition(input.orgId, value);
        return { updated: validIds.length };
      }

      case "setRate": {
        const value = input.value?.trim() || null;
        await db
          .update(users)
          .set({ hourlyRate: value })
          .where(and(eq(users.orgId, input.orgId), inArray(users.id, validIds)));
        return { updated: validIds.length };
      }

      case "setRole": {
        const role = input.value as "OWNER" | "MANAGER" | "EMPLOYEE";
        if (!["OWNER", "MANAGER", "EMPLOYEE"].includes(role)) {
          throw new Error("INVALID_ROLE");
        }
        await db
          .update(users)
          .set({ role })
          .where(and(eq(users.orgId, input.orgId), inArray(users.id, validIds)));
        return { updated: validIds.length };
      }

      default:
        throw new Error("UNKNOWN_ACTION");
    }
  },
};