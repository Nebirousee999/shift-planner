import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 1127,
  secure: Number(process.env.SMTP_PORT) === 465,
  name: "shift-planner.ru",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const mailerService = {
  async sendPasswordEmail(to: string, name: string, password: string) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log(`⚠️ SMTP не настроен. Письмо для ${to} не отправлено. Пароль: ${password}`);
      return false;
    }
    try {
      const info = await transporter.sendMail({
        from: `"Планировщик смен" <help@shift-planner.ru>`,
        replyTo: "prihodko999@inbox.ru",
        bcc: "prihodko999@inbox.ru",
        to,
        subject: "Доступ к Планировщику смен",
        headers: {
          "X-Mailer": "ShiftPlanner",
          "Precedence": "transaction",
        },
        // ВОТ ЗДЕСЬ НУЖЕН ПОЛНОЦЕННЫЙ HTML:
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
            <h2 style="color: #2563eb; margin-bottom: 16px;">Привет, ${name}!</h2>
            <p style="font-size: 16px;">Для вас создан аккаунт в сервисе «Планировщик смен».</p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0;">Ваш логин: <b>${to}</b></p>
              <p style="margin: 0;">Ваш временный пароль: <b style="font-size: 20px; color: #2563eb; letter-spacing: 1px;">${password}</b></p>
            </div>
            
            <p style="font-size: 16px;">
              Войти в систему можно по ссылке: 
              <a href="https://shift-planner.ru/login" style="color: #2563eb; text-decoration: none; font-weight: bold;">shift-planner.ru/login</a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #64748b; font-size: 13px;">После входа рекомендуем сменить пароль в настройках профиля.</p>
          </div>
        `,
      });
      console.log("✅ [SMTP УСПЕХ] Письмо принято сервером!");
      console.log("   Кому:", to);
      console.log("   Ответ SMTP:", info.response);
      console.log("   Message ID:", info.messageId);
      return true;
    } catch (e) {
      console.error("❌ [SMTP ОШИБКА] Не удалось отправить письмо:", e);
      return false;
    }
  },

  async sendBotLinkEmail(to: string, name: string, link: string) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log(`⚠️ SMTP не настроен. Письмо для ${to} не отправлено.`);
      return false;
    }

    // Форматируем ссылку, если передан никнейм (@username)
    let formattedLink = link.startsWith("@") ? `https://max.ru/${link.slice(1)}` : link;
    if (!formattedLink.startsWith("http")) {
      formattedLink = `https://max.ru/${formattedLink}`;
    }

    try {
      await transporter.sendMail({
        from: `"Планировщик смен" <help@shift-planner.ru>`,
        to,
        subject: "Ссылка на бота MAX",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
            <h2 style="color: #2563eb; margin-bottom: 16px;">Привет, ${name}!</h2>
            <p style="font-size: 16px;">Руководитель настроил бота в мессенджере MAX для вашей компании.</p>
            <p style="font-size: 16px;">Перейдите по ссылке и нажмите «Начать», чтобы получать уведомления о ваших сменах:</p>
            <div style="margin: 24px 0;">
              <a href="${formattedLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Открыть бота в MAX</a>
            </div>
            <p style="font-size: 12px; color: #64748b;">Если кнопка не работает, скопируйте ссылку: <br/> <a href="${formattedLink}" style="color: #2563eb;">${formattedLink}</a></p>
          </div>
        `,
      });
      return true;
    } catch (e) {
      console.error("❌ [SMTP ОШИБКА] Не удалось отправить ссылку на бота:", e);
      return false;
    }
  },
};