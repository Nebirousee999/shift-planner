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

// ═══════════════════════════════════════════════════════════════
// 1. Автоматическая подписка на вебхук при сохранении токена
// ═══════════════════════════════════════════════════════════════
const orgServicePath = path.join(ROOT, "src/modules/organization/organization.service.ts");
if (fs.existsSync(orgServicePath)) {
  let content = fs.readFileSync(orgServicePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  const searchBlock = `    // 🤖 Если передан токен, получаем ID бота
    let botId = undefined;
    if (input.maxBotToken) {
      try {
        const { data } = await axios.get("https://platform-api2.max.ru/me", {
          headers: { Authorization: input.maxBotToken },
        });
        botId = data.id?.toString();
      } catch (e) {
        console.error("Ошибка получения ID бота MAX (проверьте токен):", e.message);
      }
    } else if (input.maxBotToken === null) {
      botId = null; // Сброс при удалении токена
    }`;

  const replaceBlock = `    // 🤖 Если передан токен, получаем ID бота и настраиваем вебхук
    let botId = undefined;
    if (input.maxBotToken) {
      try {
        const { data: botInfo } = await axios.get("https://platform-api2.max.ru/me", {
          headers: { Authorization: input.maxBotToken },
        });
        botId = botInfo.id?.toString();

        // Автоматически подписываем бота на наш вебхук
        try {
          await axios.post("https://platform-api2.max.ru/subscriptions", {
            url: "https://shift-planner.ru/api/webhooks/max",
            update_types: ["message_created", "bot_started"],
            secret: "super_secret_webhook_key_123" // Можно сгенерировать случайный
          }, {
            headers: { 
              Authorization: input.maxBotToken,
              "Content-Type": "application/json"
            },
          });
          console.log(\`✅ Бот \${botId} успешно подписан на вебхук\`);
        } catch (webhookError) {
          console.error("Ошибка настройки вебхука MAX:", webhookError.response?.data || webhookError.message);
          // Не прерываем сохранение токена, просто логируем ошибку
        }
      } catch (e) {
        console.error("Ошибка получения ID бота MAX (проверьте токен):", e.message);
      }
    } else if (input.maxBotToken === null) {
      botId = null; // Сброс при удалении токена
    }`;

  if (normalized.includes(searchBlock) && !normalized.includes("super_secret_webhook_key_123")) {
    normalized = normalized.replace(searchBlock, replaceBlock);
    const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
    fs.writeFileSync(orgServicePath, finalContent, "utf-8");
    touched++;
    console.log("✅ [organization.service.ts] Добавлена автоматическая настройка вебхука при сохранении токена.");
  } else {
    console.log("⏭  [organization.service.ts] Автонастройка вебхука уже добавлена или не найден блок для замены.");
  }
}

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log(`🎉 Готово! Внесено изменений: ${touched}`);
  console.log("Теперь при сохранении токена бэкенд сам подпишет бота на вебхук.");
} else {
  console.log("⚠️ Изменений не внесено (возможно, всё уже исправлено).");
}