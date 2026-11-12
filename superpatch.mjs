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
// 1. БЭКЕНД: разрешаем 1 ₽ для тарифа Pro
// ════════════════════════════════════════════════════════════
patchFile(
  "src/modules/payments/payments.routes.ts",
  `const TARIFF_PRICES: Record<string, number[]> = {
  pro: [990, 9480],
  business: [2490, 23880],
};`,
  `const TARIFF_PRICES: Record<string, number[]> = {
  pro: [990, 9480, 1], // 1 ₽ — для тестовой оплаты через реальный кошелёк
  business: [2490, 23880],
};`,
  "payments.routes.ts: разрешена тестовая сумма 1₽"
);

// ════════════════════════════════════════════════════════════
// 2. ФРОНТЕНД: добавляем импорт useAuth и FlaskConical
// ════════════════════════════════════════════════════════════
patchFile(
  "frontend/src/pages/WalletPage.tsx",
  `import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Wallet, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";`,
  `import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Wallet, CheckCircle2, AlertTriangle, Loader2, FlaskConical } from "lucide-react";
import { useAuth } from "../store/auth";`,
  "WalletPage.tsx: импорты"
);

// ════════════════════════════════════════════════════════════
// 3. ФРОНТЕНД: проверка админа + стейт для тестовой оплаты
// ════════════════════════════════════════════════════════════
patchFile(
  "frontend/src/pages/WalletPage.tsx",
  `export default function WalletPage() {
  const [searchParams] = useSearchParams();`,
  `export default function WalletPage() {
  const { user } = useAuth();
  const isAdmin = user?.email === import.meta.env.VITE_ADMIN_EMAIL;
  const [testPaying, setTestPaying] = useState(false);
  const [searchParams] = useSearchParams();`,
  "WalletPage.tsx: проверка админа и testPaying"
);

// ════════════════════════════════════════════════════════════
// 4. ФРОНТЕНД: обработчик тестовой оплаты
// ════════════════════════════════════════════════════════════
patchFile(
  "frontend/src/pages/WalletPage.tsx",
  `  const handlePay = async (tariffId: "pro" | "business", overrideYearly?: boolean) => {`,
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
  };

  const handlePay = async (tariffId: "pro" | "business", overrideYearly?: boolean) => {`,
  "WalletPage.tsx: handleTestPay"
);

// ════════════════════════════════════════════════════════════
// 5. ФРОНТЕНД: кнопка "Тест 1₽" после карточки текущего тарифа
// ════════════════════════════════════════════════════════════
patchFile(
  "frontend/src/pages/WalletPage.tsx",
  `        </div>

        {/* Переключатель месяц/год */}`,
  `        </div>

        {/* 🧪 Тестовая оплата (только для админа) */}
        {isAdmin && (
          <div className="mb-6 p-4 bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-semibold text-amber-900 flex items-center gap-2">
                <FlaskConical className="w-4 h-4" />
                Тестовая оплата
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                Реальный платёж 1 ₽ через YooKassa. Pro активируется на 30 дней.
              </div>
            </div>
            <button
              onClick={handleTestPay}
              disabled={testPaying}
              className="inline-flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-xl hover:bg-amber-700 disabled:opacity-50 text-sm font-medium shadow-sm whitespace-nowrap"
            >
              {testPaying && <Loader2 className="w-4 h-4 animate-spin" />}
              {testPaying ? "Создание..." : "Оплатить 1 ₽"}
            </button>
          </div>
        )}

        {/* Переключатель месяц/год */}`,
  "WalletPage.tsx: кнопка тестовой оплаты"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Тестовая оплата 1₽ добавлена (видна только админу).");
} else {
  console.log("⚠️ Изменений не внесено.");
}