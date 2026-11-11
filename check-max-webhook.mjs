// check-max-webhook.mjs
import axios from "axios";

// ВСТАВЬ СЮДА СВОЙ ТОКЕН БОТА (из профиля на сайте)
const TOKEN = "f9LHodD0cOJjzHB4LtQ-XVYAxfuHNQmu6DfhseAVZ9MUAKB2S2z2mHAqkXMejXDx4wffrOTmHdzBCXcuIXI9"; 
const WEBHOOK_URL = "https://shift-planner.ru/api/webhooks/max";

async function main() {
  if (!TOKEN || TOKEN === "ТВОЙ_ТОКЕН_БОТА_ТУТ") {
    console.error("❌ Пожалуйста, укажи токен бота в переменной TOKEN!");
    process.exit(1);
  }

  console.log("🔍 1. Проверяем текущие подписки (вебхуки) бота...");
  try {
    const { data: subs } = await axios.get("https://botapi.max.ru/subscriptions", {
      headers: { Authorization: TOKEN }
    });
    console.log("Текущие подписки:", JSON.stringify(subs, null, 2));

    // Если есть старые подписки — удаляем их, чтобы не было конфликтов
    if (subs && subs.subscriptions && subs.subscriptions.length > 0) {
      console.log("\n🧹 2. Удаляем старые подписки...");
      for (const sub of subs.subscriptions) {
        await axios.delete(`https://botapi.max.ru/subscriptions?url=${encodeURIComponent(sub.url)}`, {
          headers: { Authorization: TOKEN }
        });
        console.log(`Удалена подписка: ${sub.url}`);
      }
    }
  } catch (e) {
    console.error("⚠️ Не удалось получить список подписок:", e.response?.data || e.message);
  }

  console.log("\n🚀 3. Устанавливаем новый вебхук...");
  try {
    const { data: res } = await axios.post("https://botapi.max.ru/subscriptions", {
      url: WEBHOOK_URL,
      update_types: ["message_created", "bot_started", "message_callback"],
      secret: "super_secret_webhook_key_123"
    }, {
      headers: { 
        Authorization: TOKEN,
        "Content-Type": "application/json"
      }
    });
    console.log("✅ Успех! Вебхук установлен:", res);
  } catch (e) {
    console.error("❌ Ошибка установки вебхука:", e.response?.data || e.message);
  }

  console.log("\n🔍 4. Проверяем информацию о боте...");
  try {
    const { data: me } = await axios.get("https://botapi.max.ru/me", {
      headers: { Authorization: TOKEN }
    });
    console.log(`Бот: ${me.name} (ID: ${me.user_id})`);
  } catch (e) {
    console.error("❌ Ошибка получения инфо о боте (возможно, неверный токен):", e.response?.data || e.message);
  }
}

main();