import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function patchFile(p, replaces) {
  const filePath = path.join(ROOT, p);
  if (!fs.existsSync(filePath)) return console.log(`⚠ ${p} not found`);
  
  const raw = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = raw.includes("\r\n");
  let c = raw.replace(/\r\n/g, "\n");
  let touched = 0;

  for (const [from, to] of replaces) {
    if (c.includes(from)) { 
      c = c.replace(from, to); 
      touched++; 
    }
  }

  if (touched > 0) {
    fs.writeFileSync(filePath, hadCRLF ? c.replace(/\n/g, "\r\n") : c, "utf-8");
    console.log(`✔ ${p} (${touched} замен)`);
  } else {
    console.log(`⚠ ${p} (совпадений не найдено, возможно, уже исправлено)`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. Проверяем и обновляем lib/metrika.ts
// ═══════════════════════════════════════════════════════════════
const metrikaPath = "frontend/src/lib/metrika.ts";
const metrikaContent = `declare global {
  interface Window {
    ym: (id: number, action: string, ...args: any[]) => void;
  }
}

// Твой ID счетчика Метрики
const COUNTER_ID = 114078577; 

export function trackEvent(eventName: string, params?: Record<string, any>) {
  try {
    if (typeof window !== "undefined" && typeof window.ym === "function") {
      window.ym(COUNTER_ID, "reachGoal", eventName, params);
      console.log(\`[Metrika] Цель достигнута: \${eventName}\`, params);
    }
  } catch (e) {
    // Игнорируем ошибки в проде
  }
}
`;
fs.writeFileSync(path.join(ROOT, metrikaPath), metrikaContent, "utf-8");
console.log(`✔ ${metrikaPath} перезаписан`);

// ═══════════════════════════════════════════════════════════════
// 2. LoginPage.tsx (Отправка цели "ym-register")
// ═══════════════════════════════════════════════════════════════
patchFile("frontend/src/pages/LoginPage.tsx", [
  [
    `import { useAuth } from "../store/auth";`,
    `import { useAuth } from "../store/auth";\nimport { trackEvent } from "../lib/metrika";`
  ],
  [
    `  const onRegister = async (data: RegisterForm) => {
    const ok = await registerUser(data);
    if (ok) {`,
    `  const onRegister = async (data: RegisterForm) => {
    const ok = await registerUser(data);
    if (ok) {
      trackEvent("ym-register");`
  ]
]);

// ═══════════════════════════════════════════════════════════════
// 3. WalletPage.tsx (Отправка цели "ym-begin-checkout")
// ═══════════════════════════════════════════════════════════════
patchFile("frontend/src/pages/WalletPage.tsx", [
  [
    `import { paymentsApi, type CurrentSubscription, type Payment } from "../api/payments";`,
    `import { paymentsApi, type CurrentSubscription, type Payment } from "../api/payments";\nimport { trackEvent } from "../lib/metrika";`
  ],
  [
    `  const handlePay = async (tariffId: "pro" | "business", overrideYearly?: boolean) => {
    const useYearly = overrideYearly !== undefined ? overrideYearly : yearly;`,
    `  const handlePay = async (tariffId: "pro" | "business", overrideYearly?: boolean) => {
    trackEvent("ym-begin-checkout", { tariff: tariffId });
    const useYearly = overrideYearly !== undefined ? overrideYearly : yearly;`
  ]
]);

// ═══════════════════════════════════════════════════════════════
// 4. PaymentSuccessPage.tsx (Отправка цели "ym-purchase")
// ═══════════════════════════════════════════════════════════════
patchFile("frontend/src/pages/PaymentSuccessPage.tsx", [
  [
    `import { Link } from "react-router-dom";`,
    `import { useEffect } from "react";\nimport { Link } from "react-router-dom";\nimport { trackEvent } from "../lib/metrika";`
  ],
  [
    `export default function PaymentSuccessPage() {`,
    `export default function PaymentSuccessPage() {\n  useEffect(() => {\n    trackEvent("ym-purchase");\n  }, []);\n`
  ]
]);

console.log("\n✅ Все цели успешно внедрены в код!");
console.log("Теперь сайт будет отправлять события в Метрику.");