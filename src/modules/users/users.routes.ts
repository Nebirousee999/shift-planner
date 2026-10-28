import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { usersService } from "./users.service.js";
import {
  buildUsersExcelTemplate,
  parseUsersExcel,
  importUsersFromExcel,
} from "./users-excel.service.js";

const createSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  role: z.enum(["OWNER", "MANAGER", "EMPLOYEE"]).optional(),
  position: z.string().max(255).optional(),
  hourlyRate: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  phone: z.string().max(20).optional(),
  locationIds: z.array(z.string().uuid()).optional(),
  areaIds: z.array(z.string().uuid()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  phone: z.string().max(20).nullable().optional(),
  position: z.string().max(255).nullable().optional(),
  role: z.enum(["OWNER", "MANAGER", "EMPLOYEE"]).optional(),
  hourlyRate: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  locationIds: z.array(z.string().uuid()).optional(),
  areaIds: z.array(z.string().uuid()).optional(),
});

const bulkSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
  action: z.enum(["addToLocation", "addToArea", "setPosition", "setRate", "setRole"]),
  value: z.string().nullable(),
});

export async function usersRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER"]));

  // ─── Excel ───────────────────────────────────────────
  app.get("/excel-template", async (req, reply) => {
    try {
      const buffer = await buildUsersExcelTemplate();
      const filename = "Шаблон_Сотрудники.xlsx";
      reply
        .header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        .header(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        )
        .send(buffer);
    } catch (e: any) {
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка генерации шаблона" });
    }
  });

  app.post("/import", async (req, reply) => {
    const parsed = z
      .object({ fileBase64: z.string().min(1).max(20_000_000) })
      .safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { orgId } = req.user!;
    try {
      const buffer = Buffer.from(parsed.data.fileBase64, "base64");
      const rows = await parseUsersExcel(buffer);
      if (rows.length === 0) {
        return reply.code(400).send({ error: "В файле нет заполненных строк" });
      }
      return await importUsersFromExcel(orgId, rows);
    } catch (e: any) {
      if (e.message === "EMPTY_EXCEL")
        return reply.code(400).send({ error: "Файл пустой" });
      if (e.message === "MISSING_COLUMNS")
        return reply.code(400).send({ error: "В файле нет колонок «Имя» и «Email»" });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка импорта" });
    }
  });

  // ─── CRUD ────────────────────────────────────────────
  app.get("/", async (req) => {
    const { orgId } = req.user!;
    return usersService.list(orgId);
  });

  app.post("/", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const { orgId } = req.user!;
      const result = await usersService.create({ ...parsed.data, orgId });
      return reply.code(201).send(result);
    } catch (e: any) {
      if (e.message === "EMAIL_TAKEN") {
        return reply.code(409).send({ error: "Email уже занят" });
      }
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка создания сотрудника" });
    }
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { orgId } = req.user!;
    const updated = await usersService.update({
      id: req.params.id,
      orgId,
      ...parsed.data,
    });
    if (!updated) return reply.code(404).send({ error: "Сотрудник не найден" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    try {
      const { orgId, sub: requesterId } = req.user!;
      const deleted = await usersService.remove(req.params.id, orgId, requesterId);
      if (!deleted) return reply.code(404).send({ error: "Сотрудник не найден" });
      return { success: true };
    } catch (e: any) {
      if (e.message === "CANNOT_DELETE_SELF") {
        return reply.code(400).send({ error: "Нельзя удалить самого себя" });
      }
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка удаления" });
    }
  });

  // ─── Bulk actions ────────────────────────────────────
  app.post("/bulk", async (req, reply) => {
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const { orgId } = req.user!;
      return await usersService.bulkUpdate({
        orgId,
        userIds: parsed.data.userIds,
        action: parsed.data.action,
        value: parsed.data.value,
      });
    } catch (e: any) {
      const map: Record<string, string> = {
        LOCATION_REQUIRED: "Выберите точку",
        LOCATION_NOT_FOUND: "Точка не найдена",
        AREA_REQUIRED: "Выберите локацию",
        AREA_NOT_FOUND: "Локация не найдена",
        INVALID_ROLE: "Неверная роль",
        UNKNOWN_ACTION: "Неизвестное действие",
      };
      if (map[e.message]) return reply.code(400).send({ error: map[e.message] });
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка применения" });
    }
  });
}