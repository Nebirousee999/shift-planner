import type { FastifyInstance } from "fastify";
import { eq, and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../db/client.js";
import {
  scheduleWeeks,
  scheduledShifts,
  shiftTemplates,
  users,
  organizations,
} from "../../../db/schema.js";
import {
  exportWeekToExcel,
  exportTimesheetToExcel,
} from "../../lib/export/excel.js";

export async function exportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER"]));

  // ─── Экспорт графика недели ──────────────────────
  app.get<{ Params: { weekId: string } }>(
    "/week/:weekId",
    async (req, reply) => {
      const { orgId } = req.user!;

      const [week] = await db
        .select()
        .from(scheduleWeeks)
        .where(
          and(
            eq(scheduleWeeks.id, req.params.weekId),
            eq(scheduleWeeks.orgId, orgId)
          )
        );
      if (!week) {
        return reply.code(404).send({ error: "Неделя не найдена" });
      }

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId));

      const shifts = await db
        .select()
        .from(scheduledShifts)
        .where(eq(scheduledShifts.weekId, week.id));

      const allUsers = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.orgId, orgId));
      const userMap = new Map(allUsers.map((u) => [u.id, u.name]));

      const allTemplates = await db
        .select({
          id: shiftTemplates.id,
          name: shiftTemplates.name,
          color: shiftTemplates.color,
        })
        .from(shiftTemplates)
        .where(eq(shiftTemplates.orgId, orgId));
      const tplMap = new Map(allTemplates.map((t) => [t.id, t]));

      const buffer = await exportWeekToExcel({
        weekStartDate: String(week.weekStartDate).slice(0, 10),
        orgName: org?.name ?? "Организация",
        shifts: shifts.map((s) => ({
          id: s.id,
          shiftDate: String(s.shiftDate).slice(0, 10),
          startTime: s.startTime,
          endTime: s.endTime,
          userName: s.userId ? userMap.get(s.userId) ?? null : null,
          templateName: s.templateId
            ? tplMap.get(s.templateId)?.name ?? null
            : null,
          templateColor: s.templateId
            ? tplMap.get(s.templateId)?.color ?? null
            : null,
        })),
      });

      const filename = `График_${String(week.weekStartDate).slice(0, 10)}.xlsx`;

      reply
        .header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        .header(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
        )
        .send(buffer);
    }
  );

  // ─── Экспорт табеля за месяц ─────────────────────
  const timesheetSchema = z.object({
    year: z.coerce.number().int().min(2020).max(2100),
    month: z.coerce.number().int().min(0).max(11), // 0=январь
  });

  app.get("/timesheet", async (req, reply) => {
    const parsed = timesheetSchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { orgId } = req.user!;
    const { year, month } = parsed.data;

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));

    const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDate = new Date(year, month + 1, 0).getDate();
    const last = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      lastDate
    ).padStart(2, "0")}`;

    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        hourlyRate: users.hourlyRate,
      })
      .from(users)
      .where(eq(users.orgId, orgId));

    // Смены за месяц: получаем все смены, фильтруем по дате
    const allShifts = await db
      .select()
      .from(scheduledShifts)
      .where(
        and(
          gte(scheduledShifts.shiftDate, first),
          lte(scheduledShifts.shiftDate, last)
        )
      );

    // Фильтруем только тех сотрудников, что принадлежат этой организации
    const orgUserIds = new Set(allUsers.map((u) => u.id));
    const filteredShifts = allShifts
      .filter((s) => s.userId && orgUserIds.has(s.userId))
      .map((s) => ({
        userId: s.userId,
        shiftDate: String(s.shiftDate).slice(0, 10),
        startTime: s.startTime,
        endTime: s.endTime,
      }));

    const buffer = await exportTimesheetToExcel({
      year,
      month,
      orgName: org?.name ?? "Организация",
      users: allUsers.map((u) => ({
        id: u.id,
        name: u.name,
        hourlyRate: u.hourlyRate,
      })),
      shifts: filteredShifts,
    });

    const monthName = new Date(year, month, 1).toLocaleString("ru-RU", {
      month: "long",
    });
    const filename = `Табель_${monthName}_${year}.xlsx`;

    reply
      .header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
      .header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      )
      .send(buffer);
  });
}