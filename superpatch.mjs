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

// ════════════════════════════════════════════════════════════
// 1. БЭКЕНД: Разрешаем 2₽ и делаем умное определение года
// ════════════════════════════════════════════════════════════
patchFile(
  "src/modules/payments/payments.routes.ts",
  `const TARIFF_PRICES: Record<string, number[]> = {
  pro: [990, 9480, 1], // 1 ₽ — для тестовой оплаты через реальный кошелёк
  business: [2490, 23880],
};`,
  `const TARIFF_PRICES: Record<string, number[]> = {
  pro: [990, 9480, 1, 2], // 1 и 2 ₽ — для тестовой оплаты
  business: [2490, 23880, 1, 2],
};`,
  "payments.routes.ts: разрешена тестовая сумма 2₽"
);

patchFile(
  "src/modules/payments/payments.routes.ts",
  `    const isYearly = amount > 5000;
    const periodDays = isYearly ? 365 : 30;`,
  `    // Определяем год по сумме ИЛИ по слову "год" в описании (для тестов)
    const isYearly = amount > 5000 || description.toLowerCase().includes("год");
    const periodDays = isYearly ? 365 : 30;`,
  "payments.routes.ts: умное определение года"
);

// ════════════════════════════════════════════════════════════
// 2. ФРОНТЕНД: стейт для двух кнопок
// ════════════════════════════════════════════════════════════
patchFile(
  "frontend/src/pages/WalletPage.tsx",
  `  const [testPaying, setTestPaying] = useState(false);`,
  `  const [testPaying, setTestPaying] = useState<"monthly" | "yearly" | null>(null);`,
  "WalletPage.tsx: стейт testPaying"
);

// ════════════════════════════════════════════════════════════
// 3. ФРОНТЕНД: обновляем функцию handleTestPay
// ════════════════════════════════════════════════════════════
patchFile(
  "frontend/src/pages/WalletPage.tsx",
  `  const handleTestPay = async () => {
    setTestPaying(true);
    try {
      const { confirmationUrl } = await paymentsApi.create(
        "pro",
        1,
        "Тестовая оплата 1₽ (Pro на 30 дней)"
      );
      window.location.href = confirmationUrl;
    } catch (e: any) {
      alert(e.response?.data?.error ?? "Ошибка создания тестового платежа");
      setTestPaying(false);
    }
  };`,
  `  const handleTestPay = async (yearly: boolean = false) => {
    setTestPaying(yearly ? "yearly" : "monthly");
    try {
      const amount = yearly ? 2 : 1;
      const desc = yearly ? "Тестовая оплата 2₽ (Pro на ГОД)" : "Тестовая оплата 1₽ (Pro на 30 дней)";
      
      const { confirmationUrl } = await paymentsApi.create("pro", amount, desc);
      window.location.href = confirmationUrl;
    } catch (e: any) {
      alert(e.response?.data?.error ?? "Ошибка создания тестового платежа");
      setTestPaying(null);
    }
  };`,
  "WalletPage.tsx: handleTestPay с поддержкой года"
);

// ════════════════════════════════════════════════════════════
// 4. ФРОНТЕНД: две кнопки в блоке тестовой оплаты
// ════════════════════════════════════════════════════════════
patchFile(
  "frontend/src/pages/WalletPage.tsx",
  `            <button
              onClick={handleTestPay}
              disabled={testPaying}
              className="inline-flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-xl hover:bg-amber-700 disabled:opacity-50 text-sm font-medium shadow-sm whitespace-nowrap"
            >
              {testPaying && <Loader2 className="w-4 h-4 animate-spin" />}
              {testPaying ? "Создание..." : "Оплатить 1 ₽"}
            </button>`,
  `            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleTestPay(false)}
                disabled={!!testPaying}
                className="inline-flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-xl hover:bg-amber-700 disabled:opacity-50 text-sm font-medium shadow-sm whitespace-nowrap"
              >
                {testPaying === "monthly" && <Loader2 className="w-4 h-4 animate-spin" />}
                {testPaying === "monthly" ? "Создание..." : "Оплатить 1 ₽ (Мес)"}
              </button>
              <button
                onClick={() => handleTestPay(true)}
                disabled={!!testPaying}
                className="inline-flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl hover:bg-slate-900 disabled:opacity-50 text-sm font-medium shadow-sm whitespace-nowrap"
              >
                {testPaying === "yearly" && <Loader2 className="w-4 h-4 animate-spin" />}
                {testPaying === "yearly" ? "Создание..." : "Оплатить 2 ₽ (Год)"}
              </button>
            </div>`,
  "WalletPage.tsx: две кнопки тестовой оплаты"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Добавлена тестовая оплата на Год (2₽).");
} else {
  console.log("⚠️ Изменений не внесено.");
}