import { eq, and } from "drizzle-orm";
import { db } from "../../../db/client.js";
import {
  scheduleWeeks,
  scheduledShifts,
  shiftTemplates,
  users,
  locations,
} from "../../../db/schema.js";
import { getMonday, hoursBetween, shiftsOverlap, toDateStr } from "../../lib/time.js";

export const scheduleWeeksService = {
  async list(orgId: string, locationId?: string) {
    const conditions = [eq(scheduleWeeks.orgId, orgId)];
    if (locationId) conditions.push(eq(scheduleWeeks.locationId, locationId));

    const weeks = await db
      .select()
      .from(scheduleWeeks)
      .where(and(...conditions))
      .orderBy(scheduleWeeks.weekStartDate);

    if (weeks.length === 0) return [];

    const weekIds = new Set(weeks.map((w) => w.id));

    const allShifts = await db
      .select({
        id: scheduledShifts.id,
        weekId: scheduledShifts.weekId,
        shiftDate: scheduledShifts.shiftDate,
        startTime: scheduledShifts.startTime,
        endTime: scheduledShifts.endTime,
        templateId: scheduledShifts.templateId,
        userId: scheduledShifts.userId,
        status: scheduledShifts.status,
      })
      .from(scheduledShifts);

    const shiftsByWeek = new Map<string, any[]>();
    for (const s of allShifts) {
      if (!weekIds.has(s.weekId)) continue;
      if (!shiftsByWeek.has(s.weekId)) shiftsByWeek.set(s.weekId, []);
      shiftsByWeek.get(s.weekId)!.push(s);
    }

    return weeks.map((w) => ({ ...w, shifts: shiftsByWeek.get(w.id) ?? [] }));
  },

  async get(id: string, orgId: string) {
    const [week] = await db
      .select()
      .from(scheduleWeeks)
      .where(and(eq(scheduleWeeks.id, id), eq(scheduleWeeks.orgId, orgId)));
    if (!week) return null;

    const shifts = await db
      .select()
      .from(scheduledShifts)
      .where(eq(scheduledShifts.weekId, id));

    return { ...week, shifts };
  },

  async create(input: { orgId: string; locationId: string; weekStartDate: string }) {
    const [loc] = await db
      .select()
      .from(locations)
      .where(and(eq(locations.id, input.locationId), eq(locations.orgId, input.orgId)));
    if (!loc) throw new Error("LOCATION_NOT_FOUND");

    const monday = getMonday(input.weekStartDate);

    const [existing] = await db
      .select()
      .from(scheduleWeeks)
      .where(
        and(
          eq(scheduleWeeks.orgId, input.orgId),
          eq(scheduleWeeks.locationId, input.locationId),
          eq(scheduleWeeks.weekStartDate, monday)
        )
      );
    if (existing) throw new Error("WEEK_EXISTS");

    const [week] = await db
      .insert(scheduleWeeks)
      .values({
        orgId: input.orgId,
        locationId: input.locationId,
        weekStartDate: monday,
      })
      .returning();
    return week;
  },

  async publish(id: string, orgId: string) {
    const [week] = await db
      .select()
      .from(scheduleWeeks)
      .where(and(eq(scheduleWeeks.id, id), eq(scheduleWeeks.orgId, orgId)));
    if (!week) throw new Error("WEEK_NOT_FOUND");
    if (week.status === "PUBLISHED") throw new Error("ALREADY_PUBLISHED");

    const shifts = await db
      .select()
      .from(scheduledShifts)
      .where(eq(scheduledShifts.weekId, id));

    const violations: string[] = [];
    const byUser = new Map<string, typeof shifts>();
    for (const s of shifts) {
      if (!s.userId) continue;
      if (!byUser.has(s.userId)) byUser.set(s.userId, []);
      byUser.get(s.userId)!.push(s);
    }

    for (const [userId, userShifts] of byUser) {
      const totalHours = userShifts.reduce(
        (sum, s) => sum + hoursBetween(s.startTime, s.endTime),
        0
      );
      if (totalHours > 40) {
        violations.push(`Сотрудник ${userId}: ${totalHours.toFixed(1)} ч/нед (макс. 40 ч)`);
      }
      for (let i = 0; i < userShifts.length; i++) {
        for (let j = i + 1; j < userShifts.length; j++) {
          const a = {
            date: toDateStr(userShifts[i].shiftDate),
            start: userShifts[i].startTime,
            end: userShifts[i].endTime,
          };
          const b = {
            date: toDateStr(userShifts[j].shiftDate),
            start: userShifts[j].startTime,
            end: userShifts[j].endTime,
          };
          if (shiftsOverlap(a, b)) {
            violations.push(
              `Сотрудник ${userId}: пересекающиеся смены ${a.date} ${a.start}-${a.end} и ${b.start}-${b.end}`
            );
          }
        }
      }
    }

    if (violations.length > 0) return { ok: false, violations };

    const [updated] = await db
      .update(scheduleWeeks)
      .set({ status: "PUBLISHED", publishedAt: new Date() })
      .where(eq(scheduleWeeks.id, id))
      .returning();
    return { ok: true, week: updated };
  },

  async duplicate(id: string, orgId: string) {
    const [source] = await db
      .select()
      .from(scheduleWeeks)
      .where(and(eq(scheduleWeeks.id, id), eq(scheduleWeeks.orgId, orgId)));
    if (!source) throw new Error("WEEK_NOT_FOUND");

    const sourceStart = new Date(source.weekStartDate + "T00:00:00Z");
    const nextStart = new Date(sourceStart);
    nextStart.setUTCDate(nextStart.getUTCDate() + 7);
    const nextStartStr = nextStart.toISOString().slice(0, 10);

    const [existing] = await db
      .select()
      .from(scheduleWeeks)
      .where(
        and(
          eq(scheduleWeeks.orgId, orgId),
          eq(scheduleWeeks.locationId, source.locationId),
          eq(scheduleWeeks.weekStartDate, nextStartStr)
        )
      );
    if (existing) throw new Error("WEEK_EXISTS");

    const [newWeek] = await db
      .insert(scheduleWeeks)
      .values({
        orgId,
        locationId: source.locationId,
        weekStartDate: nextStartStr,
      })
      .returning();

    const sourceShifts = await db
      .select()
      .from(scheduledShifts)
      .where(eq(scheduledShifts.weekId, id));

    if (sourceShifts.length > 0) {
      const newShifts = sourceShifts.map((s) => {
        const oldDate = new Date(String(s.shiftDate) + "T00:00:00Z");
        oldDate.setUTCDate(oldDate.getUTCDate() + 7);
        return {
          weekId: newWeek.id,
          templateId: s.templateId,
          userId: s.userId,
          shiftDate: oldDate.toISOString().slice(0, 10),
          startTime: s.startTime,
          endTime: s.endTime,
        };
      });
      await db.insert(scheduledShifts).values(newShifts);
    }

    return newWeek;
  },

  async remove(id: string, orgId: string) {
    const [week] = await db
      .select()
      .from(scheduleWeeks)
      .where(and(eq(scheduleWeeks.id, id), eq(scheduleWeeks.orgId, orgId)));
    if (!week) throw new Error("WEEK_NOT_FOUND");
    if (week.status !== "DRAFT") throw new Error("ONLY_DRAFT_CAN_BE_DELETED");

    await db.delete(scheduledShifts).where(eq(scheduledShifts.weekId, id));
    await db.delete(scheduleWeeks).where(eq(scheduleWeeks.id, id));
    return { success: true };
  },
};