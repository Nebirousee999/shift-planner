import { eq, desc } from "drizzle-orm";
import { db } from "../../../db/client.js";
import { payments, organizations } from "../../../db/schema.js";

export const paymentsService = {
  async current(orgId: string) {
    const [org] = await db
      .select({ maxLocations: organizations.maxLocations, trialEndsAt: organizations.trialEndsAt, tariffId: organizations.tariffId, tariffExpiresAt: organizations.tariffExpiresAt })
      .from(organizations)
      .where(eq(organizations.id, orgId));

    if (!org) return null;

    const now = new Date();
    const isTrial = org.trialEndsAt && new Date(org.trialEndsAt) > now;
    const isPaid = org.tariffExpiresAt && new Date(org.tariffExpiresAt) > now;

    if (isTrial) {
      return {
        tariffId: "pro",
        tariffExpiresAt: org.trialEndsAt.toISOString(),
        isActive: true,
        daysLeft: Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / 86400000),
        maxLocations: org.maxLocations,
        hasAnyPayment: false,
        isTrial: true
      };
    }

    if (isPaid) {
      return {
        tariffId: org.tariffId,
        tariffExpiresAt: org.tariffExpiresAt.toISOString(),
        isActive: true,
        daysLeft: Math.ceil((org.tariffExpiresAt.getTime() - now.getTime()) / 86400000),
        maxLocations: org.maxLocations,
        hasAnyPayment: true,
        isTrial: false
      };
    }

    return {
      tariffId: "free",
      tariffExpiresAt: null,
      isActive: true,
      daysLeft: null,
      maxLocations: org.maxLocations,
      hasAnyPayment: false,
      isTrial: false
    };
  },
  
  async legacyCurrent(orgId: string) {
    // Получаем все успешные платежи и фильтруем их в памяти (это работает везде)
    const allPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.status, "succeeded"))
      .orderBy(desc(payments.createdAt));

    const latest = allPayments.find((p: any) => {
      let meta = p.metadata;
      // На всякий случай, если драйвер вернул JSON строкой
      if (typeof meta === "string") {
        try { meta = JSON.parse(meta); } catch { meta = null; }
      }
      return meta && meta.orgId === orgId;
    });

    if (!latest) {
      return {
        tariffId: "free",
        tariffExpiresAt: null,
        isActive: true,
        daysLeft: null,
        maxLocations: org.maxLocations || 1,
        hasAnyPayment: false,
      };
    }

    let meta = latest.metadata;
    if (typeof meta === "string") {
      try { meta = JSON.parse(meta); } catch { meta = {}; }
    }

    const periodDays = Number(meta?.periodDays) || 30;
    const paidAt = new Date(latest.createdAt);
    const expiresAt = new Date(paidAt.getTime() + periodDays * 24 * 60 * 60 * 1000);
    const isActive = expiresAt > new Date();

    return {
      tariffId: isActive ? (meta?.tariffId || "pro") : "free",
      tariffExpiresAt: expiresAt.toISOString(),
      isActive,
      daysLeft: isActive ? Math.ceil((expiresAt.getTime() - Date.now()) / 86400000) : 0,
      maxLocations: org.maxLocations || 5,
      hasAnyPayment: true,
    };
  },
};