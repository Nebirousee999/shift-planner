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
import { POSITION_PALETTE } from "../../lib/colors.js";

function generateTempPassword(length = 8): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

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

async function resolveAreaIds(orgId: string, ids: string[]): Promise<string[]> {
  if (!ids || ids.length === 0) return [];
  const clean = ids.filter((id) => typeof id === "string" && id.length === 36);
  if (clean.length === 0) return [];
  const valid = await db
    .select({ id: areas.id })
    .from(areas)
    .where(and(eq(areas.orgId, orgId), inArray(areas.id, clean)));
  return valid.map((a) => a.id);
}

async function resolveLocationIds(orgId: string, ids: string[]): Promise<string[]> {
  if (!ids || ids.length === 0) return [];
  const clean = ids.filter((id) => typeof id === "string" && id.length === 36);
  if (clean.length === 0) return [];
  const valid = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.orgId, orgId), inArray(locations.id, clean)));
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
        paymentType: users.paymentType,
        employmentType: users.employmentType,
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
    paymentType?: "HOURLY" | "MONTHLY";
    employmentType?: "GPH" | "SHTAT";
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
        paymentType: input.paymentType ?? "HOURLY",
        employmentType: input.employmentType ?? "SHTAT",
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
        paymentType: users.paymentType,
        employmentType: users.employmentType,
        createdAt: users.createdAt,
      });

    if (input.position) {
      await ensurePosition(input.orgId, input.position);
    }

    let validLocIds: string[] = [];
    if (input.locationIds && input.locationIds.length > 0) {
      validLocIds = await resolveLocationIds(input.orgId, input.locationIds);
      if (validLocIds.length > 0) {
        await db
          .insert(userLocations)
          .values(validLocIds.map((locationId) => ({ userId: user.id, locationId })))
          .onConflictDoNothing();
      }
    }

    let validAreaIds: string[] = [];
    if (input.areaIds && input.areaIds.length > 0) {
      validAreaIds = await resolveAreaIds(input.orgId, input.areaIds);
      if (validAreaIds.length > 0) {
        await db
          .insert(userAreas)
          .values(validAreaIds.map((areaId) => ({ userId: user.id, areaId })))
          .onConflictDoNothing();
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
    paymentType?: "HOURLY" | "MONTHLY";
    employmentType?: "GPH" | "SHTAT";
    locationIds?: string[];
    areaIds?: string[];
  }) {
    // 1. Проверяем, что пользователь существует и принадлежит org
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.id), eq(users.orgId, input.orgId)));
    if (!existing) return null;

    // 2. Собираем поля для UPDATE (только присланные)
    const userSet: Record<string, any> = {};
    if (input.name !== undefined) userSet.name = input.name;
    if (input.phone !== undefined) userSet.phone = input.phone;
    if (input.position !== undefined) userSet.position = input.position;
    if (input.role !== undefined) userSet.role = input.role;
    if (input.hourlyRate !== undefined) userSet.hourlyRate = input.hourlyRate;
    if (input.paymentType !== undefined) userSet.paymentType = input.paymentType;
    if (input.employmentType !== undefined) userSet.employmentType = input.employmentType;

    // 3. UPDATE только если есть что менять
    if (Object.keys(userSet).length > 0) {
      await db
        .update(users)
        .set(userSet)
        .where(and(eq(users.id, input.id), eq(users.orgId, input.orgId)));
    }

    // 4. Обновление должности в шаблонах
    if (input.position) {
      await ensurePosition(input.orgId, input.position);
    }

    // 5. Обновление точек
    if (input.locationIds !== undefined) {
      const validLocIds = await resolveLocationIds(input.orgId, input.locationIds);
      await db.delete(userLocations).where(eq(userLocations.userId, input.id));
      if (validLocIds.length > 0) {
        await db
          .insert(userLocations)
          .values(validLocIds.map((locationId) => ({ userId: input.id, locationId })))
          .onConflictDoNothing();
      }
    }

    // 6. Обновление локаций
    if (input.areaIds !== undefined) {
      const validAreaIds = await resolveAreaIds(input.orgId, input.areaIds);
      await db.delete(userAreas).where(eq(userAreas.userId, input.id));
      if (validAreaIds.length > 0) {
        await db
          .insert(userAreas)
          .values(validAreaIds.map((areaId) => ({ userId: input.id, areaId })))
          .onConflictDoNothing();
      }
    }

    // 7. Возвращаем финальное состояние
    const [finalUser] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        position: users.position,
        hourlyRate: users.hourlyRate,
        paymentType: users.paymentType,
        employmentType: users.employmentType,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, input.id));

    const locs = await db
      .select({ locationId: userLocations.locationId })
      .from(userLocations)
      .where(eq(userLocations.userId, input.id));

    const ars = await db
      .select({ areaId: userAreas.areaId })
      .from(userAreas)
      .where(eq(userAreas.userId, input.id));

    return {
      ...finalUser,
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

    await db
      .update(scheduledShifts)
      .set({ userId: null })
      .where(eq(scheduledShifts.userId, id));

    await db
      .delete(shiftSwapRequests)
      .where(eq(shiftSwapRequests.requestedBy, id));
    await db
      .delete(shiftSwapRequests)
      .where(eq(shiftSwapRequests.swapWithUserId, id));

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

    await db.delete(vacations).where(eq(vacations.userId, id));

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
      | "moveToLocation"
      | "setPosition"
      | "setRate"
      | "setRole"
      | "setPaymentType"
      | "setEmploymentType";
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
          .where(and(eq(locations.id, input.value), eq(locations.orgId, input.orgId)));
        if (!loc) throw new Error("LOCATION_NOT_FOUND");

        const existing = await db.select({ userId: userLocations.userId })
          .from(userLocations)
          .where(and(eq(userLocations.locationId, loc.id), inArray(userLocations.userId, validIds)));
        const existingSet = new Set(existing.map((e) => e.userId));
        const toInsert = validIds.filter((id) => !existingSet.has(id));
        if (toInsert.length > 0) await db.insert(userLocations).values(toInsert).onConflictDoNothing(); 
        return { updated: validIds.length };
      }

      case "addToArea": {
        if (!input.value) throw new Error("AREA_REQUIRED");
        const [area] = await db
          .select({ id: areas.id, locationId: areas.locationId })
          .from(areas)
          .where(and(eq(areas.id, input.value), eq(areas.orgId, input.orgId)));
        if (!area) throw new Error("AREA_NOT_FOUND");

        const existingLoc = await db.select({ userId: userLocations.userId })
          .from(userLocations)
          .where(and(eq(userLocations.locationId, area.locationId), inArray(userLocations.userId, validIds)));
        const inPointSet = new Set(existingLoc.map((e) => e.userId));
        const toAddToPoint = validIds.filter((id) => !inPointSet.has(id));
        
        if (toAddToPoint.length > 0) {
          await db.insert(userLocations).values(toAddToPoint.map(userId => ({ userId, locationId: area.locationId }))).onConflictDoNothing();
        }

        const existingAreas = await db
          .select({ userId: userAreas.userId })
          .from(userAreas)
          .where(and(eq(userAreas.areaId, area.id), inArray(userAreas.userId, validIds)));
        const existingAreaSet = new Set(existingAreas.map((e) => e.userId));
        const toAddToArea = validIds.filter((id) => !existingAreaSet.has(id));
        
        if (toAddToArea.length > 0) {
          await db.insert(userAreas).values(toAddToArea.map(userId => ({ userId, areaId: area.id }))).onConflictDoNothing();
        }
        return { updated: validIds.length };
      }


      case "moveToLocation": {
        if (!input.value) throw new Error("LOCATION_REQUIRED");
        const [loc] = await db.select({ id: locations.id }).from(locations)
          .where(and(eq(locations.id, input.value), eq(locations.orgId, input.orgId)));
        if (!loc) throw new Error("LOCATION_NOT_FOUND");

        // Удаляем ВСЕ старые точки и локации у выбранных сотрудников
        await db.delete(userLocations).where(inArray(userLocations.userId, validIds));
        await db.delete(userAreas).where(inArray(userAreas.userId, validIds));

        // Привязываем к новой точке
        if (validIds.length > 0) {
          await db.insert(userLocations).values(validIds.map((id) => ({ userId: id, locationId: loc.id }))).onConflictDoNothing();
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

      case "setPaymentType": {
        const v = input.value as "HOURLY" | "MONTHLY";
        if (!["HOURLY", "MONTHLY"].includes(v)) {
          throw new Error("INVALID_PAYMENT_TYPE");
        }
        await db
          .update(users)
          .set({ paymentType: v })
          .where(and(eq(users.orgId, input.orgId), inArray(users.id, validIds)));
        return { updated: validIds.length };
      }

      case "setEmploymentType": {
        const v = input.value as "GPH" | "SHTAT";
        if (!["GPH", "SHTAT"].includes(v)) {
          throw new Error("INVALID_EMPLOYMENT_TYPE");
        }
        await db
          .update(users)
          .set({ employmentType: v })
          .where(and(eq(users.orgId, input.orgId), inArray(users.id, validIds)));
        return { updated: validIds.length };
      }

      default:
        throw new Error("UNKNOWN_ACTION");
    }
  },
};