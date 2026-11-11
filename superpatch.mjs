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

// ═══ ГЛАВНЫЙ ФИКС: синхронизация in-memory ticket.sessionToken ═══
patchFile(
  "src/modules/support/support.routes.ts",
  `    if (foundByEmail.length > 0) {
      ticket = foundByEmail[0];
      await db.update(supportTickets).set({ sessionToken }).where(eq(supportTickets.id, ticket.id));
    }`,
  `    if (foundByEmail.length > 0) {
      ticket = foundByEmail[0];
      await db.update(supportTickets).set({ sessionToken }).where(eq(supportTickets.id, ticket.id));
      // 🔑 ФИКС: синхронизируем in-memory значение, иначе возвращаем старый токен
      ticket.sessionToken = sessionToken;
    }`,
  "support.routes.ts: синхронизация sessionToken (главный фикс)"
);

// ═══ ДОП. СТРАХОВКА: возвращаем переменную, а не поле объекта ═══
patchFile(
  "src/modules/support/support.routes.ts",
  `return { success: true, ticketId: ticket.id.slice(0, 6).toUpperCase(), sessionToken: ticket.sessionToken };`,
  `return { success: true, ticketId: ticket.id.slice(0, 6).toUpperCase(), sessionToken: sessionToken };`,
  "support.routes.ts: возврат переменной sessionToken (страховка)"
);

// ═══ ДОП. СТРАХОВКА НА ФРОНТЕ: после смены токена сразу тянем сообщения ═══
patchFile(
  "frontend/src/components/SupportChat.tsx",
  `      if (res.sessionToken && res.sessionToken !== sessionToken) {
        setSessionToken(res.sessionToken);
        localStorage.setItem("support_session_token", res.sessionToken);
      } else {
        await loadMessages();
      }`,
  `      if (res.sessionToken && res.sessionToken !== sessionToken) {
        setSessionToken(res.sessionToken);
        localStorage.setItem("support_session_token", res.sessionToken);
        // 🔑 Страховка: сразу тянем сообщения новым токеном, не дожидаясь effect
        try {
          const msgs = await supportApi.getMessages(res.sessionToken);
          setMessages(msgs);
        } catch {}
      } else {
        await loadMessages();
      }`,
  "SupportChat.tsx: страховка после смены токена"
);

console.log("\n──────────────────────────────────────");
console.log(touched > 0 ? "🎉 Готово!" : "⚠️ Изменений не внесено.");