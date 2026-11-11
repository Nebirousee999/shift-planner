import axios from "axios";
import "dotenv/config";

const token = process.env.SUPPORT_BOT_TOKEN;
if (!token) {
  console.error("❌ SUPPORT_BOT_TOKEN не задан в .env");
  process.exit(1);
}

async function setWebhook() {
  try {
    await axios.post("https://platform-api2.max.ru/subscriptions", {
      url: "https://shift-planner.ru/api/webhooks/max",
      update_types: ["message_created", "bot_started"],
      secret: "super_secret_webhook_key_123"
    }, {
      headers: { Authorization: token, "Content-Type": "application/json" }
    });
    console.log("✅ Вебхук для бота поддержки успешно установлен!");
  } catch (e) {
    console.error("❌ Ошибка установки вебхука:", e.response?.data || e.message);
  }
}
setWebhook();
