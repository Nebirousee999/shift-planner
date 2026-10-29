import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { actionLogs, users } from "../../../db/schema.js";

export const historyService = {
  async list(orgId: string, from?: string, to?: string, type?: string) {
    let conditions = [eq(actionLogs.orgId, orgId)];
    
    if (from) conditions.push(gte(actionLogs.createdAt, new Date(from + "T00:00:00Z")));
    if (to) conditions.push(lte(actionLogs.createdAt, new Date(to + "T23:59:59Z")));
    if (type) conditions.push(eq(actionLogs.actionType, type));

    const rows = await db.select({
      log: actionLogs,
      userName: users.name,
    }).from(actionLogs)
      .innerJoin(users, eq(users.id, actionLogs.userId))
      .where(and(...conditions))
      .orderBy(desc(actionLogs.createdAt));

    return rows.map(r => ({
      ...r.log,
      userName: r.userName,
    }));
  }
};