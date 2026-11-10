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
    console.log("⚠️ [" + label + "] Не найдено (возможно, уже изменено).");
  }
}

// ═══ 1. Отключаем почту в API поддержки ═══
patchFile(
  "src/modules/support/support.routes.ts",
  `    await mailerService\n      .sendSupportEmail(parsed.data.email, parsed.data.message, shortId, parsed.data.images)\n      .catch((e) => app.log.error(e));\n\n`,
  ``,
  "support.routes.ts (удаление отправки email)"
);

// Обновляем текст сообщения в MAX, чтобы туда падала почта гостя
patchFile(
  "src/modules/support/support.routes.ts",
  `            text: "📩 Чат поддержки #" + shortId + "\\nОт: " + parsed.data.email + "\\n\\n" + parsed.data.message + "\\n\\nЧтобы ответить, напишите:\\n#" + shortId + " ваш ответ",`,
  `            text: "📩 Чат поддержки #" + shortId + "\\n" +\n              (userId ? "Пользователь: " + parsed.data.email : "Гость: " + parsed.data.email) + "\\n\\n" +\n              parsed.data.message + "\\n\\n" +\n              "Чтобы ответить, напишите:\\n#" + shortId + " ваш ответ",`,
  "support.routes.ts (добавление почты в MAX)"
);

// ═══ 2. Отключаем почту в вебхуке (ответы админа) ═══
patchFile(
  "src/modules/webhooks/webhooks.routes.ts",
  `          await mailerService.sendSupportReply(ticket.email, replyText).catch(() => {});\n`,
  ``,
  "webhooks.routes.ts (удаление отправки email)"
);

// ═══ 3. Убираем страницу Контактов из App.tsx ═══
patchFile(
  "frontend/src/App.tsx",
  `import ContactsPage from "./pages/ContactsPage";\n`,
  ``,
  "App.tsx (удаление импорта ContactsPage)"
);

patchFile(
  "frontend/src/App.tsx",
  `<Route path="/contacts" element={<ContactsPage />} />`,
  `<Route path="/contacts" element={<Navigate to="/" replace />} />`,
  "App.tsx (редирект /contacts на главную)"
);

// ═══ 4. Обновляем футер: "Контакты" открывают виджет ═══
patchFile(
  "frontend/src/components/landing/LandingFooter.tsx",
  `{ label: "Контакты", href: "/contacts" },`,
  `{ label: "Контакты", href: "#support" },`,
  "LandingFooter.tsx (замена href контактов)"
);

patchFile(
  "frontend/src/components/landing/LandingFooter.tsx",
  `  const scrollTo = (href: string) => {\n    if (href.startsWith("#") && href.length > 1) {`,
  `  const scrollTo = (href: string) => {\n    if (href === "#support") {\n      window.dispatchEvent(new Event("open-support-chat"));\n      return;\n    }\n    if (href.startsWith("#") && href.length > 1) {`,
  "LandingFooter.tsx (обработка клика по контактам)"
);

// ═══ 5. Заставляем виджет слушать событие открытия ═══
patchFile(
  "frontend/src/components/SupportWidget.tsx",
  `import { useState } from "react";`,
  `import { useState, useEffect } from "react";`,
  "SupportWidget.tsx (импорт useEffect)"
);

patchFile(
  "frontend/src/components/SupportWidget.tsx",
  `  const [isOpen, setIsOpen] = useState(false);\n\n  // Сотрудники не видят эту форму\n  if (user?.role === "EMPLOYEE") return null;`,
  `  const [isOpen, setIsOpen] = useState(false);\n\n  // Слушаем событие открытия (из футера)\n  useEffect(() => {\n    const handleOpen = () => setIsOpen(true);\n    window.addEventListener("open-support-chat", handleOpen);\n    return () => window.removeEventListener("open-support-chat", handleOpen);\n  }, []);\n\n  // Сотрудники не видят эту форму\n  if (user?.role === "EMPLOYEE") return null;`,
  "SupportWidget.tsx (слушатель события)"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Внесено изменений: " + touched);
} else {
  console.log("⚠️ Изменений не внесено.");
}