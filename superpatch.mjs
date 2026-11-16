// superpatch.mjs
// ─── СУПЕРПАТЧ: Умная обработка email сотрудников при ленивой регистрации ───
import fs from 'node:fs';

const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--apply');

console.log("═══════════════════════════════════════════════════════════════");
console.log(`  СУПЕРПАТЧ: Email сотрудников (Lazy Registration) ${DRY_RUN ? "[DRY-RUN]" : "[APPLY]"}`);
console.log("═══════════════════════════════════════════════════════════════\n");

function patchAuthService() {
  const file = 'src/modules/auth/auth.service.ts';
  if (!fs.existsSync(file)) {
    console.error(`❌ Файл ${file} не найден!`);
    process.exit(1);
  }

  let src = fs.readFileSync(file, 'utf8');
  const isCRLF = src.includes('\r\n');
  src = isCRLF ? src.replace(/\r\n/g, '\n') : src;
  
  if (src.includes('const finalEmpEmail =')) {
    console.log("⏭  Умная обработка email уже внедрена в код.");
    return;
  }

  // 1. Ищем начало цикла по сотрудникам
  const targetStart = `for (const emp of input.guestData.employees) {`;
  const startIndex = src.indexOf(targetStart);
  
  if (startIndex === -1) {
    console.error("❌ Не нашли цикл создания сотрудников в quickRegister!");
    process.exit(1);
  }

  // 2. Внедряем логику проверки почты перед генерацией пароля
  const targetLine = `const empPass = emp.password && emp.password.length >= 6 ? emp.password : generateTempPassword();`;
  const replacementLine = `// Проверяем, ввел ли владелец почту. Если да и она не занята — используем её. Иначе — генерируем заглушку.
          let empEmail = emp.email && emp.email.trim() ? emp.email.trim().toLowerCase() : "";
          if (empEmail) {
            const existingEmpEmail = await tx.select().from(users).where(eq(users.email, empEmail));
            if (existingEmpEmail.length > 0 || Array.from(usedGuestEmails).includes(empEmail)) {
              empEmail = ""; // Почта занята или дублируется — сбрасываем
            } else {
              usedGuestEmails.add(empEmail);
            }
          }
          const finalEmpEmail = empEmail || \`temp_\${Date.now()}_\${Math.floor(Math.random() * 1000)}@shift-planner.ru\`;
          
          ${targetLine}`;

  src = src.replace(targetLine, replacementLine);

  // 3. Меняем жестко прописанный email на finalEmpEmail
  const targetEmailInsert = `email: \`temp_\${Date.now()}_\${Math.floor(Math.random() * 1000)}@shift-planner.ru\`,`;
  const replacementEmailInsert = `email: finalEmpEmail,`;
  
  src = src.replace(targetEmailInsert, replacementEmailInsert);

  // 4. Добавляем Set для отслеживания дублей внутри одного запроса
  const targetBeforeLoop = `const createdEmployees = [];`;
  const replacementBeforeLoop = `const createdEmployees = [];\n      const usedGuestEmails = new Set<string>();`;
  src = src.replace(targetBeforeLoop, replacementBeforeLoop);

  // Записываем результат
  if (DRY_RUN) {
    console.log("🔍 [DRY-RUN] Файл будет изменен (внедрена логика finalEmpEmail).");
  } else {
    fs.writeFileSync(`${file}.bak.${Date.now()}`, isCRLF ? src.replace(/\n/g, '\r\n') : src);
    fs.writeFileSync(file, isCRLF ? src.replace(/\n/g, '\r\n') : src);
    console.log(`✅ Успешно пропатчен: ${file}`);
  }
}

patchAuthService();

console.log("\n═══════════════════════════════════════════════════════════════");
if (DRY_RUN) {
  console.log("🔍 DRY-RUN завершен. Запусти с флагом --apply для изменений.");
} else {
  console.log("✅ СУПЕРПАТЧ применен! Перезапусти бэкенд (docker compose restart api).");
}
console.log("═══════════════════════════════════════════════════════════════\n");