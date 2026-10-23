import type { FastifyInstance } from "fastify";
import { htmlToDocxBuffer } from "../../lib/documents/html-to-docx.js";

export async function demoRoutes(app: FastifyInstance) {
  // Генерация документа для демо на лендинге
  app.post("/documents/generate", async (req, reply) => {
    const { html, filename } = req.body as { html: string; filename: string };

    if (!html) {
      return reply.code(400).send({ error: "Нет HTML-контента" });
    }

    try {
      // Используем ту же функцию, что и для реальных документов
      const buffer = await htmlToDocxBuffer(html, { landscape: false });

      reply
        .header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        .header(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.docx`
        )
        .send(buffer);
    } catch (e: any) {
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка генерации" });
    }
  });
}