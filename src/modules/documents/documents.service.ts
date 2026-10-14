import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { generatedDocuments, vacations, users } from "../../../db/schema.js";
import {
  DOCUMENT_TYPES,
  getDocumentType,
} from "../../lib/documents/templates.js";
import {
  generateDocx,
  buildFilename,
} from "../../lib/documents/generators.js";

export const documentsService = {
  listTemplates() {
    return DOCUMENT_TYPES;
  },

  async listGenerated(orgId: string) {
    return db
      .select()
      .from(generatedDocuments)
      .where(eq(generatedDocuments.orgId, orgId))
      .orderBy(generatedDocuments.createdAt);
  },

  // Обогащаем params данными из БД перед генерацией
  async enrichParams(
    type: string,
    params: Record<string, any>,
    orgId: string
  ): Promise<Record<string, any>> {
    const enriched = { ...params };

    // ─── График отпусков (таблица) ───
    if (type === "order_vacation_schedule_table") {
      const year = Number(params.year);
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const orgUsers = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.orgId, orgId));
      const userMap = new Map(orgUsers.map((u) => [u.id, u.name]));

      const allVacations = await db
        .select()
        .from(vacations)
        .where(
          and(
            eq(vacations.orgId, orgId),
            gte(vacations.startDate, yearStart),
            lte(vacations.startDate, yearEnd)
          )
        );

      enriched.__vacations = allVacations
        .filter((v) => userMap.has(v.userId))
        .map((v) => ({
          userName: userMap.get(v.userId) ?? "—",
          startDate: String(v.startDate).slice(0, 10),
          endDate: String(v.endDate).slice(0, 10),
        }));
    }

    // ─── Журнал инструктажей ───
    if (type === "journal_briefing") {
      const employeeIds: string[] = Array.isArray(params.employees)
        ? params.employees
        : [];

      const orgUsers = await db
        .select({
          id: users.id,
          name: users.name,
          position: users.position,
        })
        .from(users)
        .where(eq(users.orgId, orgId));

      enriched.__employees = orgUsers.filter((u) =>
        employeeIds.includes(u.id)
      );
    }

    return enriched;
  },

  async generate(input: {
    orgId: string;
    userId: string;
    type: string;
    params: Record<string, any>;
  }) {
    const docType = getDocumentType(input.type);
    if (!docType) throw new Error("UNKNOWN_DOCUMENT_TYPE");

    for (const field of docType.fields) {
      if (field.required && !input.params[field.name]) {
        throw new Error(`MISSING_FIELD:${field.name}`);
      }
    }

    const [doc] = await db
      .insert(generatedDocuments)
      .values({
        orgId: input.orgId,
        userId: input.userId,
        type: input.type,
        title: docType.title,
        params: input.params,
      })
      .returning();
    return doc;
  },

  async preview(
    type: string,
    params: Record<string, any>,
    orgId: string
  ): Promise<Buffer> {
    const docType = getDocumentType(type);
    if (!docType) throw new Error("UNKNOWN_DOCUMENT_TYPE");

    for (const field of docType.fields) {
      if (field.required && !params[field.name]) {
        throw new Error(`MISSING_FIELD:${field.name}`);
      }
    }

    const enriched = await this.enrichParams(type, params, orgId);
    return generateDocx(type, enriched);
  },

  async download(id: string, orgId: string) {
    const [doc] = await db
      .select()
      .from(generatedDocuments)
      .where(
        and(
          eq(generatedDocuments.id, id),
          eq(generatedDocuments.orgId, orgId)
        )
      );
    if (!doc) return null;

    const enriched = await this.enrichParams(
      doc.type,
      doc.params as any,
      orgId
    );
    const buffer = await generateDocx(doc.type, enriched);
    const filename = buildFilename(doc.type, doc.params as any);
    return { buffer, filename };
  },

  async remove(id: string, orgId: string) {
    const [deleted] = await db
      .delete(generatedDocuments)
      .where(
        and(
          eq(generatedDocuments.id, id),
          eq(generatedDocuments.orgId, orgId)
        )
      )
      .returning({ id: generatedDocuments.id });
    return deleted;
  },
};