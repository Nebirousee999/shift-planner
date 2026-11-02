import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { payments, organizations } from "../../../db/schema.js";

export const paymentsService = {
  async current(orgId: string) {
    const [org] = await db
      .select({ maxLocations: organizations.maxLocations })
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!org) return null;

    const orgPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.status, "succeeded"),
          sql`(${payments.metadata}->>'orgId') = ${orgId}`
        )
      )
      .orderBy(desc(payments.createdAt))
      .limit(1);

    const latest = orgPayments[0];

    if (!latest) {
      return {
        tariffId: "free" as const,
        tariffExpiresAt: null,
        isActive: true,
        daysLeft: null,
        maxLocations: org.maxLocations,
        hasAnyPayment: false,
      };
    }

    const meta = latest.metadata as any;
    const periodDays = Number(meta?.periodDays) || 30;
    const paidAt = new Date(latest.createdAt);
    const expiresAt = new Date(paidAt.getTime() + periodDays * 24 * 60 * 60 * 1000);
    const isActive = expiresAt > new Date();
    const daysLeft = isActive
      ? Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)
      : 0;

    return {
      tariffId: isActive ? (meta?.tariffId || "free") : "free",
      tariffExpiresAt: expiresAt.toISOString(),
      isActive,
      daysLeft,
      maxLocations: org.maxLocations,
      hasAnyPayment: true,
    };
  },
};
