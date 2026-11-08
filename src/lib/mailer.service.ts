import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 1127,
  secure: true,
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
};