// superpatch.mjs
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

  if (normalized.includes(replace)) return;

  if (normalized.includes(search)) {
    normalized = normalized.replace(search, replace);
    fs.writeFileSync(filePath, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
    touched++;
    console.log("✅ [" + label + "] Применено");
  } else {
    console.log("⚠️ [" + label + "] Не найдено.");
  }
}

// ═══ 1. Бэкенд: Помечаем ВСЕ сообщения по email как прочитанные ═══
patchFile(
  "src/modules/support/support.routes.ts",
  `import { eq, desc, and, isNull } from "drizzle-orm";`,
  `import { eq, desc, and, isNull, inArray } from "drizzle-orm";`,
  "support.routes.ts (импорт inArray)"
);

patchFile(
  "src/modules/support/support.routes.ts",
  `    const { id } = req.params as { id: string };\n    \n    await db.update(supportMessages).set({ isReadByAdmin: true }).where(and(eq(supportMessages.ticketId, id), eq(supportMessages.sender, "USER")));\n    \n    return db.select().from(supportMessages).where(eq(supportMessages.ticketId, id)).orderBy(supportMessages.createdAt);`,
  `    const { id } = req.params as { id: string };\n    \n    // 🔥 Находим тикет, чтобы узнать его email\n    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));\n    \n    if (ticket) {\n      // 🔥 Находим ВСЕ тикеты с такой же почтой (включая старые)\n      const allTickets = await db.select({ id: supportTickets.id }).from(supportTickets).where(eq(supportTickets.email, ticket.email));\n      const ticketIds = allTickets.map(t => t.id);\n      \n      if (ticketIds.length > 0) {\n        // 🔥 Помечаем ВСЕ их сообщения как прочитанные\n        await db.update(supportMessages).set({ isReadByAdmin: true }).where(\n          and(inArray(supportMessages.ticketId, ticketIds), eq(supportMessages.sender, "USER"))\n        );\n      }\n    }\n    \n    return db.select().from(supportMessages).where(eq(supportMessages.ticketId, id)).orderBy(supportMessages.createdAt);`,
  "support.routes.ts (пометка всех сообщений по email)"
);

// ═══ 2. Фронтенд: Защита от "прыжков" при обновлении списка ═══
patchFile(
  "frontend/src/pages/AdminSupportPage.tsx",
  `  const loadTickets = () => {\n    supportApi.adminGetTickets()\n      .then(data => {\n        setTickets(data);\n        if (!selectedId && data.length > 0) setSelectedId(data[0].id);\n      })\n      .catch(() => {})\n      .finally(() => setLoading(false));\n  };`,
  `  const loadTickets = () => {\n    supportApi.adminGetTickets()\n      .then(data => {\n        // 🔥 Защита от "прыжков": если данные не изменились, не трогаем стейт\n        setTickets(prev => {\n          if (JSON.stringify(prev) === JSON.stringify(data)) return prev;\n          return data;\n        });\n        if (!selectedId && data.length > 0) setSelectedId(data[0].id);\n      })\n      .catch(() => {})\n      .finally(() => setLoading(false));\n  };`,
  "AdminSupportPage.tsx (защита от прыжков)"
);

console.log("\\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Кружочки сбрасываются полностью по email, список больше не прыгает.");
} else {
  console.log("⚠️ Изменений не внесено.");
}