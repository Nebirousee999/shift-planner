import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { customTemplatesService } from "./custom-templates.service.js";
import { getDocumentType } from "../../lib/documents/templates.js";
import { buildSampleDocx } from "../../lib/documents/generators.js";

// ─── Схемы ──────────────────────────────────────────
const uploadSchema = z.object({
  contentBase64: z.string().min(1).max(10_000_000),
  fileName: z.string().max(255).optional(),
});

const renderSchema = z.object({
  params: z.record(z.string(), z.any()).default({}),
  employeeIds: z.array(z.string().uuid()).optional(),
});

export async function customTemplatesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER"]));

  // ─── Скачать образец шаблона в DOCX ─────────────────
  app.get<{ Params: { type: string } }>(
    "/:type/sample",
    async (req, reply) => {
      const docType = getDocumentType(req.params.type);
      if (!docType) {
        return reply.code(404).send({ error: "Тип документа не найден" });
      }

      try {
        const buffer = await buildSampleDocx(docType.id, docType.title);
        const filename = `Шаблон_${docType.title}.docx`;

        reply
          .header(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          )
          .header(
            "Content-Disposition",
            `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
          )
          .send(buffer);
      } catch (e: any) {
        app.log.error(e);
        return reply
          .code(500)
          .send({ error: "Ошибка генерации образца" });
      }
    }
  );

  // ─── Проверить, есть ли кастомный шаблон ────────────
  app.get<{ Params: { type: string } }>("/:type", async (req) => {
    const { orgId } = req.user!;
    const tpl = await customTemplatesService.get(orgId, req.params.type);
    return {
      exists: !!tpl,
      fileName: tpl?.fileName ?? null,
      createdAt: tpl?.createdAt ?? null,
    };
  });

  // ─── Загрузить .docx → сохранить HTML ───────────────
  app.post<{ Params: { type: string } }>("/:type", async (req, reply) => {
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { orgId } = req.user!;
    const docType = getDocumentType(req.params.type);
    if (!docType) {
      return reply.code(404).send({ error: "Тип документа не найден" });
    }

    try {
      const tpl = await customTemplatesService.uploadDocx({
        orgId,
        type: req.params.type,
        base64: parsed.data.contentBase64,
        fileName: parsed.data.fileName,
      });
      return { success: true, tpl };
    } catch (e: any) {
      if (e.message === "INVALID_DOCX") {
        return reply
          .code(400)
          .send({
            error:
              "Не удалось прочитать файл. Загрузите .docx (не .doc, не .txt)",
          });
      }
      if (e.message === "EMPTY_DOCX") {
        return reply.code(400).send({ error: "Файл пустой" });
      }
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка загрузки" });
    }
  });

  // ─── Удалить кастомный шаблон ───────────────────────
  app.delete<{ Params: { type: string } }>("/:type", async (req, reply) => {
    const { orgId } = req.user!;
    await customTemplatesService.remove(orgId, req.params.type);
    return { success: true };
  });

  // ─── Сгенерировать документ по кастомному шаблону ───
  app.post<{ Params: { type: string } }>(
    "/:type/render",
    async (req, reply) => {
      const parsed = renderSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { orgId } = req.user!;
      try {
        const buffer = await customTemplatesService.renderToDocx({
          orgId,
          type: req.params.type,
          params: parsed.data.params,
          employeeIds: parsed.data.employeeIds,
        });
        if (!buffer) {
          return reply
            .code(404)
            .send({ error: "Кастомный шаблон не найден" });
        }
        const docType = getDocumentType(req.params.type);
        const filename = `${docType?.title ?? "Документ"}.docx`;

        reply
          .header(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          )
          .header(
            "Content-Disposition",
            `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
          )
          .send(buffer);
      } catch (e: any) {
        app.log.error(e);
        return reply.code(500).send({ error: "Ошибка генерации" });
      }
    }
  );

  // ─── Превью по кастомному шаблону ───────────────────
  app.post<{ Params: { type: string } }>(
    "/:type/preview",
    async (req, reply) => {
      const parsed = renderSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { orgId } = req.user!;
      try {
        const buffer = await customTemplatesService.renderToDocx({
          orgId,
          type: req.params.type,
          params: parsed.data.params,
          employeeIds: parsed.data.employeeIds,
        });
        if (!buffer) {
          return reply.code(404).send({ error: "Шаблон не найден" });
        }
        reply
          .header(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          )
          .send(buffer);
      } catch (e: any) {
        app.log.error(e);
        return reply.code(500).send({ error: "Ошибка генерации" });
      }
    }
  );
}