import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) {
    console.log(`⏭  [${label}] Уже исправлено.`);
    return;
  }

  if (normalized.includes(search)) {
    normalized = normalized.replace(search, replace);
    const finalContent = hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized;
    fs.writeFileSync(filePath, finalContent, "utf-8");
    touched++;
    console.log(`✅ [${label}] Успешно применено.`);
  } else {
    console.log(`❌ [${label}] Не найдена строка для замены.`);
  }
}

// 1. Добавляем метод sendBotLinkEmail в mailer.service.ts
patchFile(
  "src/lib/mailer.service.ts",
  `      return false;
    }
  },
};`,
  `      return false;
    }
  },

  async sendBotLinkEmail(to: string, name: string, link: string) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log(\`⚠️ SMTP не настроен. Письмо для \${to} не отправлено.\`);
      return false;
    }

    // Форматируем ссылку, если передан никнейм (@username)
    let formattedLink = link.startsWith("@") ? \`https://max.ru/\${link.slice(1)}\` : link;
    if (!formattedLink.startsWith("http")) {
      formattedLink = \`https://max.ru/\${formattedLink}\`;
    }

    try {
      await transporter.sendMail({
        from: \`"Планировщик смен" <help@shift-planner.ru>\`,
        to,
        subject: "Ссылка на бота MAX",
        html: \`
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
            <h2 style="color: #2563eb; margin-bottom: 16px;">Привет, \${name}!</h2>
            <p style="font-size: 16px;">Руководитель настроил бота в мессенджере MAX для вашей компании.</p>
            <p style="font-size: 16px;">Перейдите по ссылке и нажмите «Начать», чтобы получать уведомления о ваших сменах:</p>
            <div style="margin: 24px 0;">
              <a href="\${formattedLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Открыть бота в MAX</a>
            </div>
            <p style="font-size: 12px; color: #64748b;">Если кнопка не работает, скопируйте ссылку: <br/> <a href="\${formattedLink}" style="color: #2563eb;">\${formattedLink}</a></p>
          </div>
        \`,
      });
      return true;
    } catch (e) {
      console.error("❌ [SMTP ОШИБКА] Не удалось отправить ссылку на бота:", e);
      return false;
    }
  },
};`,
  "mailer.service.ts (добавлен метод sendBotLinkEmail)"
);

// 2. Добавляем роут broadcast-bot-link в organization.routes.ts
patchFile(
  "src/modules/organization/organization.routes.ts",
  `  app.get("/export-json", { preHandler: app.requireRole(["OWNER"]) }, async (req, reply) => {`,
  `  app.post("/broadcast-bot-link", { preHandler: app.requireRole(["OWNER"]) }, async (req, reply) => {
    try {
      const { orgId } = req.user!;
      const result = await organizationService.broadcastBotLink(orgId);
      return result;
    } catch (e: any) {
      app.log.error(e);
      return reply.code(400).send({ error: e.message || "Ошибка рассылки" });
    }
  });

  app.get("/export-json", { preHandler: app.requireRole(["OWNER"]) }, async (req, reply) => {`,
  "organization.routes.ts (добавлен роут broadcast-bot-link)"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log(`🎉 Готово! Внесено изменений: ${touched}`);
  console.log("Теперь можно коммитить и пушить.");
} else {
  console.log("⚠️ Изменений не внесено.");
}