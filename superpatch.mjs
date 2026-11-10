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

// ═══ 1. Бэкенд: разделяем гостя и юзера ═══
// В POST запросе запрещаем привязывать гостевой тикет к юзеру
patchFile(
  "src/modules/support/support.routes.ts",
  `    if (!ticket) {\n      const found = await db\n        .select()\n        .from(supportTickets)\n        .where(eq(supportTickets.sessionToken, sessionToken));\n      if (found.length > 0) ticket = found[0];\n    }`,
  `    if (!ticket && !userId) {\n      const found = await db\n        .select()\n        .from(supportTickets)\n        .where(eq(supportTickets.sessionToken, sessionToken));\n      if (found.length > 0) ticket = found[0];\n    }`,
  "support.routes.ts (POST fallback)"
);

// В GET запросе запрещаем юзеру подтягивать гостевой тикет
patchFile(
  "src/modules/support/support.routes.ts",
  `    if (!ticket && sessionToken) {\n      const found = await db\n        .select()\n        .from(supportTickets)\n        .where(eq(supportTickets.sessionToken, sessionToken));\n      if (found.length > 0) ticket = found[0];\n    }`,
  `    if (!ticket && sessionToken && !userId) {\n      const found = await db\n        .select()\n        .from(supportTickets)\n        .where(eq(supportTickets.sessionToken, sessionToken));\n      if (found.length > 0) ticket = found[0];\n    }`,
  "support.routes.ts (GET fallback)"
);

// ═══ 2. Фронтенд: сбрасываем UI при смене юзера ═══
patchFile(
  "frontend/src/components/SupportChat.tsx",
  `  useEffect(() => {\n    if (user?.email) setEmail(user.email);\n  }, [user?.email]);`,
  `  // Сбрасываем сообщения и почту при смене пользователя (вход/выход)\n  useEffect(() => {\n    if (user?.email) {\n      setEmail(user.email);\n    } else {\n      setEmail("");\n    }\n    setMessages([]);\n    setFetching(true);\n  }, [user?.id]);`,
  "SupportChat.tsx (сброс при смене юзера)"
);

// Добавляем user?.id в зависимости для загрузки сообщений
patchFile(
  "frontend/src/components/SupportChat.tsx",
  `  useEffect(() => {\n    loadMessages();\n    const interval = setInterval(loadMessages, 5000); // Опрос каждые 5 сек\n    return () => clearInterval(interval);\n  }, [sessionToken]);`,
  `  useEffect(() => {\n    if (!sessionToken) return;\n    loadMessages();\n    const interval = setInterval(loadMessages, 5000); // Опрос каждые 5 сек\n    return () => clearInterval(interval);\n  }, [sessionToken, user?.id]);`,
  "SupportChat.tsx (перезагрузка при смене юзера)"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Гостевой и пользовательский чаты разделены.");
} else {
  console.log("⚠️ Изменений не внесено.");
}