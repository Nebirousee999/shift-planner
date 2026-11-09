import { db } from "../../db/client.js";
import { scheduledShifts } from "../../db/schema.js";
import { eq, and, isNotNull } from "drizzle-orm";
import { messengerService } from "./messenger.service.js";

const sentReminders = new Set<string>();

export function startScheduler() {
  setInterval(async () => {
    try {
      const now = new Date();
      const mskTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
      const todayStr = mskTime.toISOString().slice(0, 10);
      
      const shifts = await db.select({ id: scheduledShifts.id, userId: scheduledShifts.userId, startTime: scheduledShifts.startTime })
        .from(scheduledShifts).where(and(eq(scheduledShifts.shiftDate, todayStr), isNotNull(scheduledShifts.userId)));

      for (const s of shifts) {
        if (!s.userId) continue;
        const [hh, mm] = s.startTime.split(":").map(Number);
        const shiftStart = new Date(mskTime);
        shiftStart.setHours(hh, mm, 0, 0);
        const diffMins = Math.round((shiftStart.getTime() - mskTime.getTime()) / 60000);

        if (diffMins === 60 && !sentReminders.has(`60-${s.id}`)) {
           sentReminders.add(`60-${s.id}`);
           await messengerService.sendToUser(s.userId, `Напоминание: через час начинается ваша смена (${s.startTime}).`, "remindHour");
        }
        if (diffMins === 5 && !sentReminders.has(`5-${s.id}`)) {
           sentReminders.add(`5-${s.id}`);
           await messengerService.sendToUser(s.userId, `Напоминание: через 5 минут начинается ваша смена (${s.startTime}).`, "remindFiveMin");
        }
      }
    } catch (e) { console.error("Scheduler error:", e); }
  }, 60000);
}
