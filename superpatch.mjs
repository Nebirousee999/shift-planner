// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) { console.log(`⚠️  [${label}] файл не найден`); return; }
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) { console.log(`⏭  [${label}] уже применено`); return; }

  if (!normalized.includes(search)) {
    console.log(`❌ [${label}] шаблон для замены не найден`);
    return;
  }

  normalized = normalized.replace(search, replace);
  fs.writeFileSync(filePath, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
  touched++;
  console.log(`✅ [${label}] применено`);
}

// ═══ Исправляем отправку в webhooks.routes.ts ═══
// 1. Ответ на /start (приветствие с ID)
patchFile(
  "src/modules/webhooks/webhooks.routes.ts",
  `            // Отправляем с access_token в query (самый совместимый способ для MAX API)\n            await axios.post(\`https://botapi.max.ru/messages?access_token=\${org.token}&user_id=\${senderId}\`, { text: replyText })\n              .catch(e => app.log.error(e.response?.data || e.message, "Ошибка отправки MAX"));`,
  `            // MAX больше не принимает access_token в URL. Только в заголовке Authorization.\n            await axios.post(\n              \`https://botapi.max.ru/messages?user_id=\${senderId}\`, \n              { text: replyText },\n              { headers: { Authorization: org.token, "Content-Type": "application/json" } }\n            ).catch(e => app.log.error(e.response?.data || e.message, "Ошибка отправки MAX"));`,
  "webhooks.routes.ts: фикс отправки приветствия"
);

// 2. Ответ на любой другой текст
patchFile(
  "src/modules/webhooks/webhooks.routes.ts",
  `            await axios.post(\`https://botapi.max.ru/messages?access_token=\${org.token}&user_id=\${senderId}\`, { text: "Это бот для уведомлений. Чтобы получить свой ID и привязать аккаунт, отправьте /start" })\n              .catch(e => app.log.error(e.response?.data || e.message, "Ошибка отправки MAX"));`,
  `            await axios.post(\n              \`https://botapi.max.ru/messages?user_id=\${senderId}\`, \n              { text: "Это бот для уведомлений. Чтобы получить свой ID и привязать аккаунт, отправьте /start" },\n              { headers: { Authorization: org.token, "Content-Type": "application/json" } }\n            ).catch(e => app.log.error(e.response?.data || e.message, "Ошибка отправки MAX"));`,
  "webhooks.routes.ts: фикс отправки обычного текста"
);

console.log("\n──────────────────────────────────────");
console.log(touched > 0 ? "🎉 Готово! Токен перенесен в заголовки." : "⚠️ Изменений не внесено.");