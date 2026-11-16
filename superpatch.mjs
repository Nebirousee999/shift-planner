// superpatch.mjs
// ─── СУПЕРПАТЧ: Защита регистрации Владельцев от фейковых почт ───────────────
// Запуск:
//   node superpatch.mjs --dry-run
//   node superpatch.mjs --apply
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import { execSync } from "node:child_process";

const DRY_RUN = process.argv.includes("--dry-run") || !process.argv.includes("--apply");

console.log("═══════════════════════════════════════════════════════════════");
console.log(`  СУПЕРПАТЧ: Валидация Email Владельца ${DRY_RUN ? "[DRY-RUN]" : "[APPLY]"}`);
console.log("═══════════════════════════════════════════════════════════════\n");

// ─── 1. Установка зависимостей ───────────────────────────────────────────────
function installDeps() {
  console.log("📦 1. Проверка зависимостей...");
  const pkgPath = "package.json";
  if (!fs.existsSync(pkgPath)) {
    console.error("❌ package.json бэкенда не найден в корне!");
    process.exit(1);
  }
  
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const hasValidator = pkg.dependencies && pkg.dependencies["validator"];
  const hasDisposable = pkg.dependencies && pkg.dependencies["disposable-email-domains"];

  if (!hasValidator || !hasDisposable) {
    if (DRY_RUN) {
      console.log("🔍 [DRY-RUN] Будут установлены: validator, disposable-email-domains, @types/validator");
    } else {
      console.log("⏳ Устанавливаем зависимости...");
      try {
        execSync("npm install validator disposable-email-domains", { stdio: "inherit" });
        execSync("npm install -D @types/validator", { stdio: "inherit" });
        console.log("✅ Зависимости установлены.");
      } catch (e) {
        console.error("❌ Ошибка установки:", e.message);
        process.exit(1);
      }
    }
  } else {
    console.log("⏭  Зависимости уже установлены.");
  }
}

// ─── 2. Создание утилиты валидации ───────────────────────────────────────────
function createEmailUtil() {
  const utilPath = "src/utils/email-validator.ts";
  console.log(`\n🛠  2. Создание утилиты: ${utilPath}`);
  
  const content = `import validator from "validator";
import disposableDomains from "disposable-email-domains";
import dns from "node:dns/promises";

/**
 * Проверяет, является ли email реальным:
 * 1. Формат
 * 2. Домен не из списка временных (temp-mail, 10minutemail и т.д.)
 * 3. Домен имеет MX-записи (т.е. может принимать почту)
 */
export async function isValidRealEmail(email: string): Promise<boolean> {
  if (!email || typeof email !== "string") return false;
  
  const cleanEmail = email.trim().toLowerCase();
  
  if (!validator.isEmail(cleanEmail)) return false;

  const domain = cleanEmail.split("@")[1];
  
  if (disposableDomains.includes(domain)) return false;

  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) return false;
  } catch (e) {
    return false;
  }

  return true;
}
`;
  
  if (DRY_RUN) {
    console.log("🔍 [DRY-RUN] Утилита будет создана.");
  } else {
    fs.mkdirSync("src/utils", { recursive: true });
    fs.writeFileSync(utilPath, content);
    console.log("✅ Утилита создана.");
  }
}

// ─── 3. Патч auth.service.ts ─────────────────────────────────────────────────
function patchAuthService() {
  const file = "src/modules/auth/auth.service.ts";
  console.log(`\n🔧 3. Патч сервиса: ${file}`);
  
  if (!fs.existsSync(file)) {
    console.error(`❌ Файл ${file} не найден!`);
    process.exit(1);
  }

  let src = fs.readFileSync(file, "utf8");
  const isCRLF = src.includes("\r\n");
  src = isCRLF ? src.replace(/\r\n/g, "\n") : src;
  let changed = false;

  // 1. Добавляем импорт
  if (!src.includes("isValidRealEmail")) {
    const importStmt = `import { isValidRealEmail } from "../../utils/email-validator.js";\n`;
    src = src.replace(`import bcrypt from "bcryptjs";\n`, `import bcrypt from "bcryptjs";\n${importStmt}`);
    console.log("✅ Добавлен импорт isValidRealEmail.");
    changed = true;
  }

  // 2. Внедряем проверку перед поиском существующего юзера
  // (Эта строка есть и в register, и в quickRegister — заменяем все вхождения)
  const targetLine = `const existing = await db.select().from(users).where(eq(users.email, input.email));`;
  const replacement = `// ЗАЩИТА ОТ БОТОВ: Проверяем реальность почты
    const isReal = await isValidRealEmail(input.email);
    if (!isReal) throw new Error("INVALID_EMAIL");
    
    ${targetLine}`;

  if (!src.includes(`throw new Error("INVALID_EMAIL");`)) {
    src = src.replaceAll(targetLine, replacement);
    console.log("✅ Проверка добавлена в методы register() и quickRegister().");
    changed = true;
  } else {
    console.log("⏭  Проверка уже есть в сервисе.");
  }

  if (changed) {
    if (DRY_RUN) {
      console.log(`🔍 [DRY-RUN] Файл ${file} будет изменен.`);
    } else {
      fs.writeFileSync(`${file}.bak.${Date.now()}`, isCRLF ? src.replace(/\n/g, "\r\n") : src);
      fs.writeFileSync(file, isCRLF ? src.replace(/\n/g, "\r\n") : src);
      console.log(`💾 Сохранено: ${file}`);
    }
  }
}

// ─── 4. Патч auth.routes.ts (обработка ошибки) ───────────────────────────────
function patchAuthRoutes() {
  const file = "src/modules/auth/auth.routes.ts";
  console.log(`\n🔧 4. Патч роутов: ${file}`);
  
  if (!fs.existsSync(file)) {
    console.error(`❌ Файл ${file} не найден!`);
    process.exit(1);
  }

  let src = fs.readFileSync(file, "utf8");
  const isCRLF = src.includes("\r\n");
  src = isCRLF ? src.replace(/\r\n/g, "\n") : src;
  let changed = false;

  // Заменяем обработчик EMAIL_TAKEN, добавляя перед ним INVALID_EMAIL
  const targetCatch = `if (e.message === "EMAIL_TAKEN") {`;
  const replacementCatch = `if (e.message === "INVALID_EMAIL") {
                return reply.code(400).send({ error: "Введите реальный email. Временные и несуществующие почты запрещены." });
            }
            if (e.message === "EMAIL_TAKEN") {`;

  if (!src.includes(`e.message === "INVALID_EMAIL"`)) {
    src = src.replaceAll(targetCatch, replacementCatch);
    console.log("✅ Добавлена обработка ошибки INVALID_EMAIL для клиента.");
    changed = true;
  } else {
    console.log("⏭  Обработка ошибки уже есть.");
  }

  if (changed) {
    if (DRY_RUN) {
      console.log(`🔍 [DRY-RUN] Файл ${file} будет изменен.`);
    } else {
      fs.writeFileSync(`${file}.bak.${Date.now()}`, isCRLF ? src.replace(/\n/g, "\r\n") : src);
      fs.writeFileSync(file, isCRLF ? src.replace(/\n/g, "\r\n") : src);
      console.log(`💾 Сохранено: ${file}`);
    }
  }
}

// ─── Запуск ──────────────────────────────────────────────────────────────────
installDeps();
createEmailUtil();
patchAuthService();
patchAuthRoutes();

console.log("\n═══════════════════════════════════════════════════════════════");
if (DRY_RUN) {
  console.log("🔍 DRY-RUN завершен. Ничего не изменено.");
  console.log("👉 Для применения запусти: node superpatch.mjs --apply");
} else {
  console.log("✅ СУПЕРПАТЧ применен!");
  console.log("👉 Перезапусти бэкенд (docker compose restart api), чтобы применить изменения.");
}
console.log("═══════════════════════════════════════════════════════════════\n");