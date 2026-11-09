import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

// ═══════════════════════════════════════════════════════════════
// 1. Меняем дефолт в схеме БД (db/schema.ts)
// ═══════════════════════════════════════════════════════════════
const schemaPath = path.join(ROOT, "db/schema.ts");
if (fs.existsSync(schemaPath)) {
  let schemaSrc = fs.readFileSync(schemaPath, "utf-8");
  if (schemaSrc.includes(`timeTrackingEnabled: boolean("time_tracking_enabled").default(true).notNull(),`)) {
    schemaSrc = schemaSrc.replace(
      `timeTrackingEnabled: boolean("time_tracking_enabled").default(true).notNull(),`,
      `timeTrackingEnabled: boolean("time_tracking_enabled").default(false).notNull(),`
    );
    fs.writeFileSync(schemaPath, schemaSrc, "utf-8");
    touched++;
    console.log("✅ db/schema.ts: дефолт timeTrackingEnabled изменен на false.");
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. Явно выключаем при регистрации (src/modules/auth/auth.service.ts)
// ═══════════════════════════════════════════════════════════════
const authPath = path.join(ROOT, "src/modules/auth/auth.service.ts");
if (fs.existsSync(authPath)) {
  let authSrc = fs.readFileSync(authPath, "utf-8");
  if (!authSrc.includes("timeTrackingEnabled: false")) {
    authSrc = authSrc.replace(
      `tariffId: "pro",\n        maxLocations: 1`,
      `tariffId: "pro",\n        maxLocations: 1,\n        timeTrackingEnabled: false`
    );
    fs.writeFileSync(authPath, authSrc, "utf-8");
    touched++;
    console.log("✅ auth.service.ts: добавлено timeTrackingEnabled: false при регистрации.");
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. Правим проверки на фронтенде (чтобы false не превращался в true)
// ═══════════════════════════════════════════════════════════════
const frontendFiles = [
  "frontend/src/components/NavBar.tsx",
  "frontend/src/pages/TimePage.tsx",
  "frontend/src/pages/MySchedulePage.tsx",
  "frontend/src/pages/ProfilePage.tsx",
];

for (const relPath of frontendFiles) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) continue;

  let src = fs.readFileSync(filePath, "utf-8");
  let changed = false;

  // Везде меняем !== false на === true
  if (src.includes("org?.timeTrackingEnabled !== false")) {
    src = src.replace(/org\?\.timeTrackingEnabled !== false/g, "org?.timeTrackingEnabled === true");
    changed = true;
  }
  if (src.includes("org.timeTrackingEnabled !== false")) {
    src = src.replace(/org\.timeTrackingEnabled !== false/g, "org.timeTrackingEnabled === true");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, src, "utf-8");
    touched++;
    console.log(`✅ ${relPath}: проверка изменена на === true.`);
  }
}

if (touched > 0) {
  console.log("\n🎉 Готово! Перезапустите бэкенд и обновите страницу (Ctrl+Shift+R).");
  console.log("💡 Внимание: Для существующих организаций настройка не сбросится. Изменения коснутся только новых регистраций.");
} else {
  console.log("\n⚠️ Изменений не внесено (возможно, уже применено).");
}