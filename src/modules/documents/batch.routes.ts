import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { organizations, users, documentCustomTemplates } from "../../../db/schema.js";
import { getDocumentType } from "../../lib/documents/templates.js";
import {
  buildExcelTemplate,
  parseExcel,
  generateBatchZip,
} from "../../lib/documents/batch.js";

export async function batchRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRole(["OWNER", "MANAGER"]));

  // ─── Скачать Excel-шаблон ───────────────────────────
  app.get<{ Params: { type: string } }>(
    "/:type/excel-template",
    async (req, reply) => {
      const docType = getDocumentType(req.params.type);
      if (!docType) {
        return reply.code(404).send({ error: "Тип документа не найден" });
      }
      if (!docType.notStored) {
        return reply.code(400).send({
          error: "Массовая генерация доступна только для документов с ПДн",
        });
      }

      try {
        const buffer = await buildExcelTemplate(req.params.type);
        const filename = `Шаблон_${docType.title}.xlsx`;

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
      } catch (e: any) {
        app.log.error(e);
        return reply.code(500).send({ error: "Ошибка генерации шаблона" });
      }
    }
  );

  // ─── Загрузить Excel → ZIP с документами ────────────
  app.post<{ Params: { type: string } }>(
    "/:type/generate-batch",
    async (req, reply) => {
      const parsed = z
        .object({
          fileBase64: z.string().min(1).max(50_000_000),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const docType = getDocumentType(req.params.type);
      if (!docType) {
        return reply.code(404).send({ error: "Тип документа не найден" });
      }
      if (!docType.notStored) {
        return reply.code(400).send({
          error: "Массовая генерация доступна только для документов с ПДн",
        });
      }

      const { orgId } = req.user!;

      try {
        const buffer = Buffer.from(parsed.data.fileBase64, "base64");
        const rows = await parseExcel(buffer, req.params.type);

        if (rows.length === 0) {
          return reply
            .code(400)
            .send({ error: "В файле нет заполненных строк" });
        }

        const [org] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, orgId));

        const employees = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            position: users.position,
          })
          .from(users)
          .where(eq(users.orgId, orgId));

        // Ищем кастомный шаблон для этого типа
        const [customTpl] = await db
          .select()
          .from(documentCustomTemplates)
          .where(
            and(
              eq(documentCustomTemplates.orgId, orgId),
              eq(documentCustomTemplates.type, req.params.type)
            )
          );

        const result = await generateBatchZip({
          typeId: req.params.type,
          rows,
          orgData: {
            name: org?.name ?? null,
            city: org?.city ?? null,
            directorName: org?.directorName ?? null,
            inn: org?.inn ?? null,
            legalAddress: org?.legalAddress ?? null,
          },
          employees,
          customTemplateContent: customTpl?.content ?? null,
        });

        // Если ни один документ не сгенерирован — возвращаем ошибку с деталями
        if (result.generatedFiles === 0) {
          return reply.code(400).send({
            error: "Не удалось сгенерировать ни одного документа",
            details: result.errors,
          });
        }

        const filename = `${docType.title} — пакет документов.zip`;

        // Заголовки с информацией об ошибках (опционально)
        if (result.errors.length > 0) {
          reply.header(
            "X-Generation-Errors",
            encodeURIComponent(result.errors.join(" | "))
          );
          reply.header("Access-Control-Expose-Headers", "X-Generation-Errors");
        }

        reply
          .header("Content-Type", "application/zip")
          .header(
            "Content-Disposition",
            `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
          )
          .send(result.buffer);
      } catch (e: any) {
        if (e.message === "EMPTY_EXCEL") {
          return reply.code(400).send({ error: "Файл пустой" });
        }
        app.log.error(e);
        return reply.code(500).send({ error: "Ошибка генерации пакета" });
      }
    }
  );
}