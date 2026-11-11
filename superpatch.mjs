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

// ═══ 1. Бэкенд: Восстановление гостя по email ═══
patchFile(
  "src/modules/support/support.routes.ts",
  `import { eq, desc, and } from "drizzle-orm";`,
  `import { eq, desc, and, isNull } from "drizzle-orm";`,
  "support.routes.ts (импорт isNull)"
);

patchFile(
  "src/modules/support/support.routes.ts",
  `    } else {\n      const found = await db.select().from(supportTickets).where(eq(supportTickets.sessionToken, sessionToken));\n      if (found.length > 0) {\n        if (found[0].email === parsed.data.email) ticket = found[0];\n        else sessionToken = crypto.randomUUID();\n      }\n    }`,
  `    } else {\n      const found = await db.select().from(supportTickets).where(eq(supportTickets.sessionToken, sessionToken));\n      if (found.length > 0) {\n        if (found[0].email === parsed.data.email) ticket = found[0];\n        else sessionToken = crypto.randomUUID();\n      } else {\n        // 🔥 Если куки сброшены, ищем старый тикет по почте (для гостей)\n        const foundByEmail = await db.select().from(supportTickets)\n          .where(and(eq(supportTickets.email, parsed.data.email), isNull(supportTickets.userId)))\n          .orderBy(desc(supportTickets.createdAt)).limit(1);\n        if (foundByEmail.length > 0) {\n          ticket = foundByEmail[0];\n          await db.update(supportTickets).set({ sessionToken }).where(eq(supportTickets.id, ticket.id));\n        }\n      }\n    }`,
  "support.routes.ts (восстановление гостя по email)"
);

// ═══ 2. Фронтенд: Сброс счетчиков в NavBar ═══
patchFile(
  "frontend/src/components/NavBar.tsx",
  `  const [supportUnread, setSupportUnread] = useState(0);\n\n  useEffect(() => {\n    if (user?.email !== "prihodko999@inbox.ru") return;\n    supportApi.adminGetUnreadCount().then(setSupportUnread).catch(() => {});\n    const interval = setInterval(() => {\n      supportApi.adminGetUnreadCount().then(setSupportUnread).catch(() => {});\n    }, 10000);\n    return () => clearInterval(interval);\n  }, [user?.email]);`,
  `  const [supportUnread, setSupportUnread] = useState(0);\n\n  useEffect(() => {\n    if (user?.email !== "prihodko999@inbox.ru") return;\n    \n    const updateCount = () => {\n      supportApi.adminGetUnreadCount().then(setSupportUnread).catch(() => {});\n    };\n\n    updateCount();\n    const interval = setInterval(updateCount, 10000);\n    \n    // 🔥 Слушаем событие из панели поддержки для мгновенного сброса\n    window.addEventListener("support-unread-update", updateCount);\n    \n    return () => {\n      clearInterval(interval);\n      window.removeEventListener("support-unread-update", updateCount);\n    };\n  }, [user?.email]);`,
  "NavBar.tsx (слушатель события)"
);

// ═══ 3. Фронтенд: Мгновенное обнуление при открытии ═══
patchFile(
  "frontend/src/pages/AdminSupportPage.tsx",
  `  const loadMessages = () => {\n    if (!selectedId) return;\n    supportApi.adminGetMessages(selectedId).then(setMessages).catch(() => {});\n  };`,
  `  const loadMessages = () => {\n    if (!selectedId) return;\n    supportApi.adminGetMessages(selectedId).then((msgs) => {\n      setMessages(msgs);\n      // 🔥 Сообщаем шапке, что счетчики обновились\n      window.dispatchEvent(new Event("support-unread-update"));\n    }).catch(() => {});\n  };`,
  "AdminSupportPage.tsx (диспатч события)"
);

patchFile(
  "frontend/src/pages/AdminSupportPage.tsx",
  `  useEffect(() => {\n    if (!selectedId) return;\n    loadMessages();\n    const interval = setInterval(loadMessages, 3000);\n    return () => clearInterval(interval);\n  }, [selectedId]);`,
  `  useEffect(() => {\n    if (!selectedId) return;\n    // 🔥 Мгновенно убираем красный бейдж у выбранного чата в списке\n    setTickets(prev => prev.map(t => t.id === selectedId ? { ...t, unreadCount: 0 } : t));\n    loadMessages();\n    const interval = setInterval(loadMessages, 3000);\n    return () => clearInterval(interval);\n  }, [selectedId]);`,
  "AdminSupportPage.tsx (сброс бейджа в списке)"
);

console.log("\\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Восстановление гостей по email и мгновенный сброс счетчиков.");
} else {
  console.log("⚠️ Изменений не внесено.");
}