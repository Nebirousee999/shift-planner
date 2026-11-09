import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) {
    console.log(`⏭  [${label}] Уже исправлено.`);
    return;
  }

  if (normalized.includes(search)) {
    normalized = normalized.replace(search, replace);
    const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
    fs.writeFileSync(filePath, finalContent, "utf-8");
    touched++;
    console.log(`✅ [${label}] Успешно применено.`);
  } else {
    console.log(`❌ [${label}] Не найдена строка для замены.`);
  }
}

// 1. База и API
patchFile("db/schema.ts", `timeTrackingEnabled: boolean("time_tracking_enabled").default(false).notNull(),`, `timeTrackingEnabled: boolean("time_tracking_enabled").default(false).notNull(),\n  notificationSettings: jsonb("notification_settings").default({}).notNull(),`, "db/schema.ts");
const migrationPath = path.join(ROOT, "db/migrations/0021_user_notification_settings.sql");
if (!fs.existsSync(migrationPath)) {
  fs.writeFileSync(migrationPath, `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notification_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;`);
  touched++;
  console.log("✅ Миграция создана.");
}

patchFile("src/modules/me/me.routes.ts", `  app.get("/colleagues", async (req) => {`, `  app.patch("/notifications", async (req, reply) => {\n    const { sub: userId } = req.user!;\n    const { settings } = req.body as { settings: any };\n    await meService.updateNotifications(userId, settings);\n    return { success: true };\n  });\n\n  app.get("/colleagues", async (req) => {`, "me.routes.ts");

patchFile("src/modules/me/me.service.ts", `  async changePassword(userId: string, oldPassword: string, newPassword: string) {`, `  async updateNotifications(userId: string, settings: any) {\n    await db.update(users).set({ notificationSettings: settings }).where(eq(users.id, userId));\n  },\n\n  async changePassword(userId: string, oldPassword: string, newPassword: string) {`, "me.service.ts");

// 2. Мессенджер
patchFile("src/lib/messenger.service.ts", `  async sendToUser(userId: string, text: string): Promise<boolean> {`, `  async sendToUser(userId: string, text: string, settingKey?: string): Promise<boolean> {`, "messenger (подпись)");
patchFile("src/lib/messenger.service.ts", `    if (effectiveTariff === "free") {`, `    if (settingKey) {\n      const [userSettings] = await db.select({ ns: users.notificationSettings }).from(users).where(eq(users.id, userId));\n      const s = userSettings?.ns as any;\n      if (s && s[settingKey] === false) {\n        console.log(\`⏭️ [Messenger] Пропуск: отключено "\${settingKey}"\`);\n        return false;\n      }\n    }\n\n    if (effectiveTariff === "free") {`, "messenger (проверка)");

// 3. Сервисы
patchFile("src/modules/schedule-weeks/schedule-weeks.service.ts", "Проверьте свои смены в приложении.`\n      );", "Проверьте свои смены в приложении.`,\n        \"newSchedule\"\n      );", "schedule-weeks");
patchFile("src/modules/scheduled-shifts/scheduled-shifts.service.ts", "Создано: ${nowStr}\\n\\nЗайдите в приложение, чтобы подтвердить.`\n    );", "Создано: ${nowStr}\\n\\nЗайдите в приложение, чтобы подтвердить.`,\n      \"shiftChangeApproval\"\n    );", "scheduled-shifts (согласование)");
patchFile("src/modules/scheduled-shifts/scheduled-shifts.service.ts", "Нажмите «ОК», чтобы подтвердить.`\n        );", "Нажмите «ОК», чтобы подтвердить.`,\n          \"shiftChanged\"\n        );", "scheduled-shifts (изменение)");
patchFile("src/modules/swaps/swaps.service.ts", "Создано: ${nowStr}\\n\\nЗайдите в приложение, чтобы подтвердить.`\n    );", "Создано: ${nowStr}\\n\\nЗайдите в приложение, чтобы подтвердить.`,\n      \"swapRequest\"\n    );", "swaps");
patchFile("src/modules/sick-leaves/sick-leaves.service.ts", "Нажмите «ОК», чтобы подтвердить.`\n    );", "Нажмите «ОК», чтобы подтвердить.`,\n      \"sickLeave\"\n    );", "sick-leaves");
patchFile("src/modules/time-off/time-off.service.ts", "Смена снята.`);", "Смена снята.`, \"timeOffReviewed\");", "time-off");

// 4. Планировщик
const schedulerPath = path.join(ROOT, "src/lib/scheduler.ts");
if (!fs.existsSync(schedulerPath)) {
  fs.writeFileSync(schedulerPath, `import { db } from "../../db/client.js";
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

        if (diffMins === 60 && !sentReminders.has(\`60-\${s.id}\`)) {
           sentReminders.add(\`60-\${s.id}\`);
           await messengerService.sendToUser(s.userId, \`Напоминание: через час начинается ваша смена (\${s.startTime}).\`, "remindHour");
        }
        if (diffMins === 5 && !sentReminders.has(\`5-\${s.id}\`)) {
           sentReminders.add(\`5-\${s.id}\`);
           await messengerService.sendToUser(s.userId, \`Напоминание: через 5 минут начинается ваша смена (\${s.startTime}).\`, "remindFiveMin");
        }
      }
    } catch (e) { console.error("Scheduler error:", e); }
  }, 60000);
}
`);
  touched++;
}
patchFile("src/server.ts", `const port = Number(process.env.PORT ?? 3001);`, `import { startScheduler } from "./lib/scheduler.js";\n\nconst port = Number(process.env.PORT ?? 3001);`, "server.ts");
patchFile("src/server.ts", `console.log(\`🚀 API ready at http://localhost:\${port}\`);`, `startScheduler();\nconsole.log(\`🚀 API ready at http://localhost:\${port}\`);`, "server.ts");

// 5. Фронтенд
patchFile("frontend/src/api/me.ts", `  testMessenger: async (): Promise<{ success: boolean }> => {`, `  updateNotifications: async (settings: any): Promise<void> => {\n    await api.patch("/me/notifications", { settings });\n  },\n\n  testMessenger: async (): Promise<{ success: boolean }> => {`, "api/me.ts");

patchFile("frontend/src/pages/ProfilePage.tsx", `  const [settings, setSettings] = useState<NotificationSettings>(() => {\n    const raw = localStorage.getItem(\`notif_settings_\${userId}\`);\n    if (raw) { try { return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) }; } catch {} }\n    return DEFAULT_NOTIFICATION_SETTINGS;\n  });`, `  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);`, "ProfilePage (стейт)");
patchFile("frontend/src/pages/ProfilePage.tsx", `  useEffect(() => {\n    localStorage.setItem(\`notif_settings_\${userId}\`, JSON.stringify(settings));\n  }, [settings, userId]);`, `  useEffect(() => {\n    meApi.profile().then((p: any) => {\n      if (p?.notificationSettings && Object.keys(p.notificationSettings).length > 0) {\n        setSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...p.notificationSettings });\n      }\n    }).catch(() => {});\n  }, []);`, "ProfilePage (загрузка)");
patchFile("frontend/src/pages/ProfilePage.tsx", `  const toggle = (key: keyof NotificationSettings) =>\n    setSettings((s) => ({ ...s, [key]: !s[key] }));`, `  const toggle = async (key: keyof NotificationSettings) => {\n    const newSettings = { ...settings, [key]: !settings[key] };\n    setSettings(newSettings);\n    try { await meApi.updateNotifications(newSettings); } catch (e) { console.error(e); }\n  };`, "ProfilePage (сохранение)");

console.log("\\n──────────────────────────────────────");
console.log(`🎉 Готово! Внесено изменений: ${touched}`);