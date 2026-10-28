import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { db } from "../../../db/client.js";
import {
  users, scheduledShifts, timeEntries, vacations, sickLeaves,
  shiftTemplates, organizations,
} from "../../../db/schema.js";

type CellStatus = "YA" | "V" | "VV" | "B" | "OT" | "NN" | "PR" | null;

export type TimesheetCell = {
  status: CellStatus;
  hours?: number;
  shiftId?: string;
  templateName?: string | null;
};

export type TimesheetDay = {
  date: string;
  dayNumber: number;
  isWeekend: boolean;
  cell: TimesheetCell;
};

export type TimesheetUser = {
  id: string;
  name: string;
  position: string | null;
  hourlyRate: string | null;
  paymentType: "HOURLY" | "MONTHLY";
  employmentType: "GPH" | "SHTAT";
  days: TimesheetDay[];
  totalHours: number;
  totalPayGross: number;
  totalPayNet: number;
  attendanceDays: number;
};

export const timesheetService = {
  async build(orgId: string, year: number, month: number) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    const timeTrackingOn = org?.timeTrackingEnabled !== false;
    const taxRate = Number(org?.taxRate ?? 13);

    const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDate = new Date(year, month + 1, 0).getDate();
    const last = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDate).padStart(2, "0")}`;
    const today = new Date().toISOString().slice(0, 10);

    const orgUsers = await db.select().from(users).where(eq(users.orgId, orgId));
    if (orgUsers.length === 0) {
      return {
        year, month, daysInMonth: lastDate, timeTrackingOn, taxRate,
        users: [], totals: { hours: 0, gross: 0, net: 0, tax: 0, attendance: 0 },
      };
    }
    const userIds = orgUsers.map((u) => u.id);

    const [allShifts, allEntries, allVac, allSick, templates] = await Promise.all([
      db.select().from(scheduledShifts).where(
        and(
          gte(scheduledShifts.shiftDate, first),
          lte(scheduledShifts.shiftDate, last),
          inArray(scheduledShifts.userId, userIds),
        )
      ),
      db.select().from(timeEntries).where(
        and(
          inArray(timeEntries.userId, userIds),
          gte(timeEntries.clockIn, new Date(first + "T00:00:00Z")),
          lte(timeEntries.clockIn, new Date(last + "T23:59:59Z")),
        )
      ),
      db.select().from(vacations).where(
        and(
          eq(vacations.orgId, orgId),
          eq(vacations.status, "APPROVED"),
          lte(vacations.startDate, last),
          gte(vacations.endDate, first),
        )
      ),
      db.select().from(sickLeaves).where(
        and(
          eq(sickLeaves.orgId, orgId),
          lte(sickLeaves.startDate, last),
          gte(sickLeaves.endDate, first),
        )
      ),
      db.select({ id: shiftTemplates.id, name: shiftTemplates.name }).from(shiftTemplates),
    ]);

    const tplMap = new Map(templates.map((t) => [t.id, t.name]));

    const result: TimesheetUser[] = orgUsers.map((user) => {
      const uShifts = allShifts.filter((s) => s.userId === user.id);
      const uEntries = allEntries.filter((e) => e.userId === user.id);
      const uVac = allVac.filter((v) => v.userId === user.id);
      const uSick = allSick.filter((s) => s.userId === user.id);

      const days: TimesheetDay[] = [];
      let totalHours = 0;
      let attendanceDays = 0;

      for (let d = 1; d <= lastDate; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const dow = new Date(dateStr + "T00:00:00Z").getUTCDay();
        const isWeekend = dow === 0 || dow === 6;

        const dayShift = uShifts.find((s) => String(s.shiftDate).slice(0, 10) === dateStr);
        const dayVac = uVac.find((v) => v.startDate <= dateStr && v.endDate >= dateStr);
        const daySick = uSick.find((s) => s.startDate <= dateStr && s.endDate >= dateStr);
        const dayEntry = uEntries.find((e) => e.clockIn && String(e.clockIn).slice(0, 10) === dateStr);

        let cell: TimesheetCell = { status: null };

        if (dayVac) {
          cell = { status: "OT" };
        } else if (daySick) {
          cell = { status: "B" };
        } else if (dayShift) {
          const tplName = dayShift.templateId ? tplMap.get(dayShift.templateId) ?? null : null;
          const isPast = dateStr < today;

          // Приоритет: ПР > НН > Я/НН
          if (dayShift.isNoShow) {
            cell = { status: "PR", shiftId: dayShift.id, templateName: tplName };
          } else if (dayShift.isUnknownAbsence) {
            cell = { status: "NN", shiftId: dayShift.id, templateName: tplName };
          } else if (timeTrackingOn) {
            // Учёт времени включён: Я только при наличии отметок
            if (dayEntry && dayEntry.clockOut) {
              const h = (new Date(dayEntry.clockOut).getTime() - new Date(dayEntry.clockIn!).getTime()) / 3600000;
              cell = { status: "YA", hours: Math.round(h * 10) / 10, shiftId: dayShift.id, templateName: tplName };
              totalHours += h;
              attendanceDays++;
            } else if (isPast) {
              cell = { status: "NN", shiftId: dayShift.id, templateName: tplName };
            } else {
              cell = { status: null, shiftId: dayShift.id, templateName: tplName };
            }
          } else {
            // Учёт выключен: только из дисциплины. Если смена прошла — Я по умолчанию
            if (isPast) {
              const [sh, sm] = dayShift.startTime.split(":").map(Number);
              const [eh, em] = dayShift.endTime.split(":").map(Number);
              let mins = eh * 60 + em - (sh * 60 + sm);
              if (mins <= 0) mins += 24 * 60;
              const h = mins / 60;
              cell = { status: "YA", hours: Math.round(h * 10) / 10, shiftId: dayShift.id, templateName: tplName };
              totalHours += h;
              attendanceDays++;
            } else {
              cell = { status: null, shiftId: dayShift.id, templateName: tplName };
            }
          }
        } else if (isWeekend) {
          // Выходной без смены
          cell = { status: user.paymentType === "MONTHLY" ? "VV" : "V" };
        } else {
          // Будний день без смены
          cell = { status: "V" };
        }

        days.push({ date: dateStr, dayNumber: d, isWeekend, cell });
      }

      const rate = Number(user.hourlyRate || 0);
      const workingDaysInMonth = days.filter((d) => !d.isWeekend).length;

      let totalPayGross = 0;
      if (user.paymentType === "MONTHLY") {
        totalPayGross = rate;
      } else {
        totalPayGross = totalHours * rate;
      }
      const totalPayNet = totalPayGross * (1 - taxRate / 100);

      return {
        id: user.id,
        name: user.name,
        position: user.position,
        hourlyRate: user.hourlyRate,
        paymentType: user.paymentType,
        employmentType: user.employmentType,
        days,
        totalHours: Math.round(totalHours * 10) / 10,
        totalPayGross: Math.round(totalPayGross),
        totalPayNet: Math.round(totalPayNet),
        attendanceDays,
      };
    });

    const totalGross = result.reduce((s, u) => s + u.totalPayGross, 0);
    const totalNet = result.reduce((s, u) => s + u.totalPayNet, 0);

    return {
      year, month, daysInMonth: lastDate, timeTrackingOn, taxRate,
      users: result,
      totals: {
        hours: Math.round(result.reduce((s, u) => s + u.totalHours, 0) * 10) / 10,
        gross: totalGross,
        net: totalNet,
        tax: totalGross - totalNet,
        attendance: result.reduce((s, u) => s + u.attendanceDays, 0),
      },
    };
  },
};