import { eq, and } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { shiftTemplates } from "../../../db/schema.js";

export const shiftTemplatesService = {
    async list(orgId: string) {
        return db.select().from(shiftTemplates).where(eq(shiftTemplates.orgId, orgId));
    },

    async create(input: {
        orgId: string;
        name: string;
        startTime: string;
        endTime: string;
        color?: string;
    }) {
        const [template] = await db
            .insert(shiftTemplates)
            .values({
                orgId: input.orgId,
                name: input.name,
                startTime: input.startTime,
                endTime: input.endTime,
                color: input.color ?? "#3B82F6",
            })
            .returning();
        return template;
    },

    async update(input: {
        id: string;
        orgId: string;
        name?: string;
        startTime?: string;
        endTime?: string;
        color?: string;
    }) {
        const [template] = await db
            .update(shiftTemplates)
            .set({
                ...(input.name !== undefined && { name: input.name }),
                ...(input.startTime !== undefined && { startTime: input.startTime }),
                ...(input.endTime !== undefined && { endTime: input.endTime }),
                ...(input.color !== undefined && { color: input.color }),
            })
            .where(and(eq(shiftTemplates.id, input.id), eq(shiftTemplates.orgId, input.orgId)))
            .returning();
        return template;
    },

    async remove(id: string, orgId: string) {
        const [deleted] = await db
            .delete(shiftTemplates)
            .where(and(eq(shiftTemplates.id, id), eq(shiftTemplates.orgId, orgId)))
            .returning();
        return deleted;
    },
};