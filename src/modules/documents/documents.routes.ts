import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { documentsService } from "./documents.service.js";

const generateSchema = z.object({
  type: z.string().min(1),
  params: z.record(z.string(), z.any()),
});

export async function documentsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER"]));

  // Каталог типов документов
  app.get("/templates", async () => {
    return documentsService.listTemplates();
  });

  // История сгенерированных
  app.get("/", async (req) => {
    const { orgId } = req.user!;
    return documentsService.listGenerated(orgId);
  });

  // Сгенерировать документ (создаёт запись в истории)
  app.post("/generate", async (req, reply) => {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const { orgId, sub: userId } = req.user!;
      const doc = await documentsService.generate({
        orgId,
        userId,
        type: parsed.data.type,
        params: parsed.data.params,
      });
      return reply.code(201).send(doc);
    } catch (e: any) {
      if (e.message === "UNKNOWN_DOCUMENT_TYPE") {
        return reply.code(400).send({ error: "Неизвестный тип документа" });
      }
      if (e.message?.startsWith("MISSING_FIELD:")) {
        const field = e.message.split(":")[1];
        return reply
          .code(400)
          .send({ error: `Не заполнено обязательное поле: ${field}` });
      }
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка генерации" });
    }
  });

  // Скачать DOCX
  app.get<{ Params: { id: string } }>("/:id/download", async (req, reply) => {
    const { orgId } = req.user!;
    const result = await documentsService.download(req.params.id, orgId);
    if (!result) return reply.code(404).send({ error: "Документ не найден" });

    reply
      .header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      )
      .header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      )
      .send(result.buffer);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { orgId } = req.user!;
    const deleted = await documentsService.remove(req.params.id, orgId);
    if (!deleted) return reply.code(404).send({ error: "Документ не найден" });
    return { success: true };
  });

    // Превью документа (без сохранения в истории)
  app.post("/preview", async (req, reply) => {
    const parsed = z
      .object({
        type: z.string().min(1),
        params: z.record(z.string(), z.any()),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    try {
      const buffer = await documentsService.preview(
        parsed.data.type,
        parsed.data.params
      );
      reply
        .header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        .send(buffer);
    } catch (e: any) {
      if (e.message === "UNKNOWN_DOCUMENT_TYPE") {
        return reply.code(400).send({ error: "Тип документа не найден" });
      }
      if (e.message?.startsWith("MISSING_FIELD:")) {
        const field = e.message.split(":")[1];
        return reply
          .code(400)
          .send({ error: `Не заполнено обязательное поле: ${field}` });
      }
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка генерации" });
    }
  });
}