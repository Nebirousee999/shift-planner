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

// 1. Добавляем импорт organizations в me.routes.ts
patchFile(
  "src/modules/me/me.routes.ts",
  `import { userMessengers } from "../../../db/schema.js";`,
  `import { userMessengers, organizations } from "../../../db/schema.js";`,
  "me.routes.ts (добавлен импорт organizations)"
);

// 2. Делаем обработку ошибок на бэкенде более понятной
patchFile(
  "src/modules/me/me.routes.ts",
  `    } catch (e: any) {
      app.log.error(e);
      return reply.code(500).send({ error: "Ошибка привязки мессенджера" });
    }`,
  `    } catch (e: any) {
      app.log.error(e);
      return reply.code(500).send({ error: e.message || "Ошибка привязки мессенджера" });
    }`,
  "me.routes.ts (отправка текста ошибки на фронтенд)"
);

// 3. На фронтенде защищаемся от вывода объекта вместо текста
patchFile(
  "frontend/src/pages/ProfilePage.tsx",
  `      await alertDialog(e.response?.data?.error ?? "Ошибка привязки", { variant: "error" });`,
  `      const errMsg = e.response?.data?.error;
      await alertDialog(typeof errMsg === "string" ? errMsg : "Ошибка привязки", { variant: "error" });`,
  "ProfilePage.tsx (безопасный вывод ошибки привязки)"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log(`🎉 Готово! Внесено изменений: ${touched}`);
} else {
  console.log("⚠️ Изменений не внесено.");
}