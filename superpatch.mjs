// superpatch.mjs
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const servicePath = path.join(process.cwd(), 'src/modules/auth/auth.service.ts');
let content = fs.readFileSync(servicePath, 'utf8');

const oldLogin = `  async login(input: { email: string; password: string }) {
    input.email = input.email.trim().toLowerCase();
    input.password = input.password.trim();

    const matches = await db.select().from(users).where(eq(users.email, input.email));`;

const newLogin = `  async login(input: { email: string; password: string }) {
    input.email = input.email.trim().toLowerCase();
    input.password = input.password.trim();

    const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
    const cleanPassword = input.password.replace(/[\\s\\u200B-\\u200D\\uFEFF\\u00A0]/g, "");

    const matches = await db.select().from(users).where(eq(users.email, input.email));`;

if (!content.includes(oldLogin)) {
  console.error('❌ auth.service.ts: не найден блок login (проверьте, что предыдущие патчи применены).');
  process.exit(1);
}
content = content.replace(oldLogin, newLogin);

// Меняем логику проверки: чистим от невидимых символов, логируем sha
const oldCheck = `    let matchedUser: typeof matches[number] | null = null;
    let bcryptError: any = null;
    for (const user of matches) {
      console.log("[auth.login] проверка id:", user.id,
        "| passwordHash тип:", typeof user.passwordHash,
        "| passwordHash длина:", user.passwordHash ? String(user.passwordHash).length : "NULL",
        "| tempPassword длина:", user.tempPassword ? String(user.tempPassword).length : "NULL",
        "| orgId:", user.orgId);
      try {
        if (user.passwordHash && await bcrypt.compare(input.password, String(user.passwordHash))) {
          matchedUser = user; break;
        }
        if (user.tempPassword && input.password === user.tempPassword) {
          console.warn("[auth.login] вход по tempPassword для", input.email, "id:", user.id);
          matchedUser = user; break;
        }
      } catch (e: any) {
        console.error("[auth.login] bcrypt.compare упал для id", user.id, ":", e?.name, "|", e?.message);
        bcryptError = e;
      }
    }`;

const newCheck = `    let matchedUser: typeof matches[number] | null = null;
    let bcryptError: any = null;
    for (const user of matches) {
      const tmp = user.tempPassword ? String(user.tempPassword) : "";
      console.log("[auth.login] проверка id:", user.id,
        "| input.len:", cleanPassword.length,
        "| input.sha:", sha(cleanPassword),
        "| temp.len:", tmp.length,
        "| temp.sha:", sha(tmp),
        "| equal:", cleanPassword === tmp,
        "| raw.len:", input.password.length,
        "| raw.sha:", sha(input.password),
        "| rawEqualTemp:", input.password === tmp,
        "| passwordHash.len:", user.passwordHash ? String(user.passwordHash).length : "NULL");
      try {
        if (user.passwordHash && await bcrypt.compare(cleanPassword, String(user.passwordHash))) {
          matchedUser = user; break;
        }
        if (tmp && cleanPassword === tmp) {
          console.warn("[auth.login] вход по tempPassword для", input.email, "id:", user.id);
          matchedUser = user; break;
        }
      } catch (e: any) {
        console.error("[auth.login] bcrypt.compare упал для id", user.id, ":", e?.name, "|", e?.message);
        bcryptError = e;
      }
    }`;

if (!content.includes(oldCheck)) {
  console.error('❌ auth.service.ts: не найден блок проверки в login.');
  process.exit(1);
}
content = content.replace(oldCheck, newCheck);

fs.writeFileSync(servicePath, content, 'utf8');
console.log('✅ auth.service.ts: login теперь чистит невидимые символы и логирует sha введённого/сохранённого пароля.');