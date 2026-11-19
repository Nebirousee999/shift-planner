// superpatch.mjs — диагностика login: где именно ломается вход
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let changed = 0;

function readFile(file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) { console.warn(`⚠️ Не найден: ${file}`); return null; }
  let src = fs.readFileSync(p, "utf-8");
  const crlf = src.includes("\r\n");
  if (crlf) src = src.replace(/\r\n/g, "\n");
  return { src, crlf, p, orig: src };
}

function save(f) {
  if (f.src !== f.orig) {
    fs.writeFileSync(f.p, f.crlf ? f.src.replace(/\n/g, "\r\n") : f.src, "utf-8");
    console.log(`💾 Сохранено: ${f.p}`);
  }
}

// 1. auth.service.ts: login с логами и нормализацией
const svc = readFile("src/modules/auth/auth.service.ts");
if (svc) {
  const oldLogin = `  async login(input: { email: string; password: string }) {
    const [user] = await db.select().from(users).where(eq(users.email, input.email));
    if (!user) throw new Error("INVALID_CREDENTIALS");
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new Error("INVALID_CREDENTIALS");
    return { id: user.id, email: user.email, orgId: user.orgId, role: user.role };
  },`;
  const newLogin = `  async login(input: { email: string; password: string }) {
    input.email = input.email.trim().toLowerCase();
    input.password = input.password.trim();
    console.log("🔑 login: email =", JSON.stringify(input.email), "| длина пароля =", input.password.length);
    const all = await db.select().from(users).where(eq(users.email, input.email));
    console.log("🔑 login: найдено пользователей с этой почтой:", all.length);
    const [user] = all;
    if (!user) {
      console.log("🔑 login: пользователь НЕ найден → 401");
      throw new Error("INVALID_CREDENTIALS");
    }
    console.log("🔑 login: пользователь найден, id =", user.id, "| хэш в базе:", user.passwordHash ? user.passwordHash.slice(0, 7) + "…" : "NULL!");
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    console.log("🔑 login: bcrypt.compare =", ok);
    if (!ok) throw new Error("INVALID_CREDENTIALS");
    return { id: user.id, email: user.email, orgId: user.orgId, role: user.role };
  },`;

  if (svc.src.includes("bcrypt.compare =")) {
    console.log("ℹ️ auth.service.ts: диагностика login уже есть");
  } else if (svc.src.includes(oldLogin)) {
    svc.src = svc.src.replace(oldLogin, newLogin);
    console.log("✅ auth.service.ts: login с нормализацией и диагностикой");
    changed++;
  } else {
    console.warn("⚠️ auth.service.ts: блок login не найден в ожидаемом виде");
  }

  // 2. resetPassword: самопроверка — совпадает ли записанный хэш с высланным паролем
  const oldUpdate = `    await db.update(users)
      .set({ passwordHash, tempPassword })
      .where(eq(users.id, user.id));

    let mailSent = false;`;
  const newUpdate = `    await db.update(users)
      .set({ passwordHash, tempPassword })
      .where(eq(users.id, user.id));

    // САМОПРОВЕРКА: перечитываем пользователя и сверяем пароль с базой
    const [check] = await db.select().from(users).where(eq(users.id, user.id));
    const verified = await bcrypt.compare(tempPassword, check.passwordHash);
    console.log("📧 reset-password: пароль:", tempPassword, "| в базе всё совпадает:", verified);

    let mailSent = false;`;
  if (svc.src.includes("САМОПРОВЕРКА")) {
    console.log("ℹ️ auth.service.ts: самопроверка reset уже есть");
  } else if (svc.src.includes(oldUpdate)) {
    svc.src = svc.src.replace(oldUpdate, newUpdate);
    console.log("✅ auth.service.ts: добавлена самопроверка в resetPassword");
    changed++;
  } else {
    console.warn("⚠️ auth.service.ts: блок обновления в resetPassword не найден");
  }
  save(svc);
}

// 3. auth.routes.ts: /login перестаёт глотать реальные ошибки
const rt = readFile("src/modules/auth/auth.routes.ts");
if (rt) {
  const oldCatch = `        } catch {
            return reply.code(401).send({ error: "Неверный email или пароль" });
        }`;
  const newCatch = `        } catch (e) {
            app.log.error("❌ /login: реальная ошибка (не пароль):", e);
            return reply.code(401).send({ error: "Неверный email или пароль" });
        }`;
  if (rt.src.includes("/login: реальная ошибка")) {
    console.log("ℹ️ auth.routes.ts: лог ошибки уже есть");
  } else if (rt.src.includes(oldCatch)) {
    rt.src = rt.src.replace(oldCatch, newCatch);
    console.log("✅ auth.routes.ts: /login теперь показывает настоящую ошибку");
    changed++;
  } else {
    console.warn("⚠️ auth.routes.ts: catch в /login не найден");
  }
  save(rt);
}

// 4. WalletPage.tsx: handleLogin шлёт чистые значения
const wp = readFile("frontend/src/pages/WalletPage.tsx");
if (wp) {
  if (wp.src.includes('password: loginPassword.trim()')) {
    console.log("ℹ️ WalletPage.tsx: handleLogin уже нормализован");
  } else {
    const before = wp.src;
    wp.src = wp.src.split('api.post("/auth/login", { email: guestEmail, password: loginPassword })').join(
      'api.post("/auth/login", { email: guestEmail.trim().toLowerCase(), password: loginPassword.trim() })'
    );
    if (wp.src !== before) { console.log("✅ WalletPage.tsx: handleLogin нормализован"); changed++; }
    else console.warn('⚠️ WalletPage.tsx: вызов api.post("/auth/login") не найден');
  }
  save(wp);
}

console.log(`\n${changed > 0 ? "✅" : "ℹ️"} Готово. Изменено фрагментов: ${changed}`);
