import { Router } from "express";
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
      text: `Новая заявка с лендинга (Business)

Имя: ${name}
Контакт: ${contact}
Источник: ${source}
Дата: ${new Date().toLocaleString("ru-RU")}`,
    });
    console.log("[LEAD] отправлен на", LEAD_EMAIL, "|", contact);
    res.json({ ok: true });
  } catch (e) {
    console.error("[LEAD] ошибка отправки:", e);
    res.status(500).json({ error: "Не удалось отправить заявку" });
  }
});

export default router;
