import { eq, and, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { generatedDocuments } from "../../../db/schema.js";
import { DOCUMENT_TYPES, getDocumentType } from "../../lib/documents/templates.js";
import { generateDocx, buildFilename } from "../../lib/documents/generators.js";

export const documentsService = {
  listTemplates() {
    return DOCUMENT_TYPES;
  },

  async listGenerated(orgId: string) {
    return db
      .select()
      .from(generatedDocuments)
      .where(eq(generatedDocuments.orgId, orgId))
      .orderBy(desc(generatedDocuments.createdAt));
  },

  async generate(input: {
    orgId: string;
    userId: string;
    type: string;
    params: Record<string, any>;
  }) {
    const docType = getDocumentType(input.type);
    if (!docType) throw new Error("UNKNOWN_DOCUMENT_TYPE");

    // Проверяем обязательные поля
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

  async preview(type: string, params: Record<string, any>): Promise<Buffer> {
    const docType = getDocumentType(type);
    if (!docType) throw new Error("UNKNOWN_DOCUMENT_TYPE");

    for (const field of docType.fields) {
      if (field.required && !params[field.name]) {
        throw new Error(`MISSING_FIELD:${field.name}`);
      }
    }

    return generateDocx(type, params);
  },

  async download(id: string, orgId: string) {
    const [doc] = await db
      .select()
      .from(generatedDocuments)
      .where(
        and(
          eq(generatedDocuments.id, id),
          eq(generatedDocuments.orgId, orgId),
        ),
      );
    if (!doc) return null;

    const buffer = await generateDocx(doc.type, doc.params as any);
    const filename = buildFilename(doc.type, doc.params as any);
    return { buffer, filename };
  },

  async remove(id: string, orgId: string) {
    const [deleted] = await db
      .delete(generatedDocuments)
      .where(
        and(
          eq(generatedDocuments.id, id),
          eq(generatedDocuments.orgId, orgId),
        ),
      )
      .returning({ id: generatedDocuments.id });
    return deleted;
  },
};