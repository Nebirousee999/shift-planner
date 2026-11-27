// superpatch.mjs — ContactModal: реальная отправка заявок + бэкенд-эндпоинт /leads
// Получатель писем: process.env.ADMIN_EMAIL (fallback: prihodko999@inbox.ru)
// SMTP берётся из существующих переменных .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

function walk(d, name, out = []) {
  if (!fs.existsSync(d)) return out;
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, name, out);
    else if (f === name) out.push(p);
  }
  return out;
}

// ── 1. ContactModal.tsx — переписываем целиком ──
const [cmFile] = walk(dir, "ContactModal.tsx");
if (!cmFile) { console.log("[ERROR] ContactModal.tsx не найден"); process.exit(1); }

const contactModal = `import { useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { trackEvent } from "../../lib/metrika";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

export default function ContactModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(\`\${API_URL}/leads\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, source: "pricing_business" }),
      });
      if (!res.ok) throw new Error();
      trackEvent("pricing_business_lead");
      setSent(true);
    } catch {
      setError("Не удалось отправить заявку. Напишите нам напрямую: prihodko999@inbox.ru");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Связаться по поводу Business</h3>
          <button onClick={onClose} className="text-slate-400 hover:bg-slate-100 p-1 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {sent ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <Send className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="font-medium text-slate-900">Заявка отправлена!</p>
            <p className="text-sm text-slate-500 mt-1">Мы свяжемся с вами в ближайшее время.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-500 mb-4">Оставьте контакты, и мы настроим тариф под ваши задачи (несколько точек, интеграция с 1С и т.д.).</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше имя"
              required
              maxLength={100}
              className="!text-sm"
            />
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Телефон или Telegram"
              required
              maxLength={200}
              className="!text-sm"
            />
            {error && <p className="text-rose-500 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 text-white py-2.5 rounded-xl font-medium hover:bg-brand-700 transition-colors flex justify-center items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Отправить"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
`;

fs.writeFileSync(cmFile, contactModal, "utf8");
console.log("[SAVE] ContactModal.tsx переписан: POST /leads, loading/error, trackEvent pricing_business_lead");

// ── 2. Ищем бэкенд по auth.service.ts ──
const [authFile] = walk(dir, "auth.service.ts");
if (!authFile) {
  console.log("[WARN] auth.service.ts не найден — роутер придётся создать руками");
} else {
  const srcRoot = path.resolve(path.dirname(authFile), "..", "..", "..");
  console.log("[INFO] корень бэкенда:", srcRoot.replace(dir + path.sep, ""));
  const routesDir = path.join(srcRoot, "routes");
  const leadsFile = path.join(routesDir, "leads.routes.ts");

  // ── 3. routes/leads.routes.ts (получатель — ADMIN_EMAIL из .env) ──
  if (fs.existsSync(leadsFile)) {
    console.log("[INFO] routes/leads.routes.ts уже существует — не трогаю");
  } else {
    const leadsRoute = `import { Router } from "express";
import nodemailer from "nodemailer";

const router = Router();

// Получатель заявок: ADMIN_EMAIL из .env (запасной адрес — если переменная не задана)
const LEAD_EMAIL = process.env.ADMIN_EMAIL || "prihodko999@inbox.ru";

function makeTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  // 465 — неявный SSL, 587 — STARTTLS
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
  });
}

router.post("/", async (req, res) => {
  try {
    const name = String(req.body?.name || "").slice(0, 100).trim();
    const contact = String(req.body?.contact || "").slice(0, 200).trim();
    const source = String(req.body?.source || "").slice(0, 50);
    if (!name || !contact) return res.status(400).json({ error: "Заполните имя и контакт" });

    const transport = makeTransport();
    if (!transport) {
      // SMTP не настроен — заявка не теряется, пишем в лог сервера
      console.log("[LEAD]", new Date().toISOString(), "|", name, "|", contact, "|", source);
      return res.json({ ok: true, stored: "log" });
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    await transport.sendMail({
      from,
      to: LEAD_EMAIL,
      replyTo: contact.includes("@") ? contact : undefined,
      subject: "Заявка на Business-тариф",
      text: \`Новая заявка с лендинга (Business)

Имя: \${name}
Контакт: \${contact}
Источник: \${source}
Дата: \${new Date().toLocaleString("ru-RU")}\`,
    });
    console.log("[LEAD] отправлен на", LEAD_EMAIL, "|", contact);
    res.json({ ok: true });
  } catch (e) {
    console.error("[LEAD] ошибка отправки:", e);
    res.status(500).json({ error: "Не удалось отправить заявку" });
  }
});

export default router;
`;
    if (!fs.existsSync(routesDir)) fs.mkdirSync(routesDir, { recursive: true });
    fs.writeFileSync(leadsFile, leadsRoute, "utf8");
    console.log("[CREATE] routes/leads.routes.ts (получатель: process.env.ADMIN_EMAIL)");
  }

  // ── 4. Монтирование роутера в главный файл Express ──
  const candidates = [];
  const scan = (d) => {
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) scan(p);
      else if (/\.(ts|js)$/.test(f)) candidates.push(p);
    }
  };
  scan(srcRoot);

  let mounted = false;
  for (const f of candidates) {
    const raw = fs.readFileSync(f, "utf8");
    if (!raw.includes('"/api/auth"')) continue;

    if (raw.includes("/api/leads")) {
      console.log("[INFO] leads уже смонтирован в", path.basename(f));
      mounted = true;
      break;
    }

    const isCRLF = raw.includes("\r\n");
    let text = raw.replace(/\r\n/g, "\n");

    let rel = path.relative(path.dirname(f), leadsFile).replace(/\\/g, "/");
    if (!rel.startsWith(".")) rel = "./" + rel;
    rel = rel.replace(/\.ts$/, ".js");
    const importLine = `import leadsRouter from "${rel}";`;

    const lines = text.split("\n");
    let lastImport = -1;
    lines.forEach((ln, i) => { if (/^\s*import\s/.test(ln)) lastImport = i; });
    if (lastImport >= 0) lines.splice(lastImport + 1, 0, importLine);
    let out = lines.join("\n");

    const m = out.match(/app\.use\(['"]\/api\/auth['"][^\n]*\n/);
    if (m) {
      out = out.replace(m[0], m[0] + 'app.use("/api/leads", leadsRouter);\n');
      fs.writeFileSync(f, isCRLF ? out.replace(/\n/g, "\r\n") : out, "utf8");
      console.log("[PATCH] leads смонтирован в", f.replace(dir + path.sep, ""));
      mounted = true;
    }
    break;
  }

  if (!mounted) {
    console.log("[MANUAL] Добавь в главный файл Express (рядом с /api/auth):");
    console.log('  import leadsRouter from "./routes/leads.routes.js";');
    console.log('  app.use("/api/leads", leadsRouter);');
  }
}

console.log("\nГотово. Перезапусти бэкенд, Vite подхватит фронт сам.");
