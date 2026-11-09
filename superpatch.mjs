import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ Файл не найден: ${relPath}`);
    return;
  }
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

// 1. Исправляем URL и добавляем выброс ошибки, если ID не получен
patchFile(
  "src/modules/organization/organization.service.ts",
  `        const { data: botInfo } = await axios.get("https://platform-api2.max.ru/me", {
          headers: { Authorization: input.maxBotToken },
        });
        botId = botInfo.id?.toString();`,
  `        const { data: botInfo } = await axios.get("https://botapi.max.ru/me", {
          headers: { Authorization: input.maxBotToken },
        });
        if (!botInfo || !botInfo.id) {
          throw new Error("API MAX не вернул ID бота");
        }
        botId = botInfo.id.toString();`,
  "organization.service.ts (исправлен URL для получения ID бота)"
);

// 2. Красиво обрабатываем ошибку на бэкенде, чтобы она дошла до фронтенда
patchFile(
  "src/modules/organization/organization.routes.ts",
  `          } catch (e: any) {
            if (e.message === "MAX_LOCATIONS_TOO_LOW") {
              return reply.code(400).send({
                error: "Нельзя установить лимит меньше текущего числа точек",
              });
            }
            throw e;
          }`,
  `          } catch (e: any) {
            if (e.message === "MAX_LOCATIONS_TOO_LOW") {
              return reply.code(400).send({
                error: "Нельзя установить лимит меньше текущего числа точек",
              });
            }
            if (e.message.includes("MAX") || e.response?.data) {
              app.log.error(e.response?.data || e.message);
              return reply.code(400).send({
                error: e.response?.data?.message || e.message || "Ошибка проверки токена MAX",
              });
            }
            throw e;
          }`,
  "organization.routes.ts (отображение ошибки MAX на фронтенде)"
);

// 3. На фронтенде проверяем, что maxBotId реально пришел
patchFile(
  "frontend/src/pages/ProfilePage.tsx",
  `      const updated = await organizationApi.update({ maxBotToken: botToken.trim() });
      setOrg(updated);`,
  `      const updated = await organizationApi.update({ maxBotToken: botToken.trim() });
      if (!updated.maxBotId) {
        throw new Error("Токен сохранен, но ID бота не получен. Проверьте правильность токена.");
      }
      setOrg(updated);`,
  "ProfilePage.tsx (проверка наличия maxBotId после сохранения)"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log(`🎉 Готово! Внесено изменений: ${touched}`);
  console.log("Теперь можно коммитить и пушить.");
} else {
  console.log("⚠️ Изменений не внесено (возможно, всё уже исправлено).");
}