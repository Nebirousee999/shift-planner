import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.yandex.ru",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
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
      await transporter.sendMail({
        from: `"Планировщик смен" <${process.env.SMTP_USER}>`,
        to,
        subject: "Доступ к Планировщику смен",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Привет, ${name}!</h2>
            <p>Для вас создан аккаунт в сервисе «Планировщик смен».</p>
            <p>Ваш логин: <b>${to}</b></p>
            <p>Ваш временный пароль: <b style="font-size: 18px; color: #2563eb;">${password}</b></p>
            <p>Войти в систему можно по ссылке: <a href="https://shift-planner.ru/login">shift-planner.ru/login</a></p>
            <p>После входа рекомендуем сменить пароль в настройках профиля.</p>
          </div>
        `,
      });
      return true;
    } catch (e) {
      console.error("Ошибка отправки почты:", e);
      return false;
    }
  },
};
