// superpatch.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function patchFile(relPath, patcher) {
  const full = path.join(__dirname, relPath);
  if (!fs.existsSync(full)) {
    console.log(`[SKIP] ${relPath} не найден`);
    return;
  }
  const original = fs.readFileSync(full, "utf8");
  const isCRLF = original.includes("\r\n");
  let content = isCRLF ? original.replace(/\r\n/g, "\n") : original;
  const before = content;
  content = patcher(content);
  if (content !== before) {
    const finalResult = isCRLF ? content.replace(/\n/g, "\r\n") : content;
    fs.writeFileSync(full, finalResult, "utf8");
    console.log(`[SAVE] ${relPath}`);
  } else {
    console.log(`[NOOP] ${relPath} — изменений нет`);
  }
}

// 1. Шапка (LandingHeader.tsx)
patchFile("frontend/src/components/landing/LandingHeader.tsx", (content) => {
  let out = content;
  
  // Добавляем пропс onStartGuest
  out = out.replace(
    "export default function LandingHeader() {",
    "export default function LandingHeader({ onStartGuest }: { onStartGuest?: (source: string) => void }) {"
  );

  // Меняем логику кнопки регистрации на гостя
  out = out.replace(
    /const goRegister = \(\) => \{\s*setMobileOpen\(false\);\s*navigate\("\/login\?mode=register"\);\s*\};/,
    `const goRegister = () => {
    setMobileOpen(false);
    if (onStartGuest) {
      onStartGuest("header");
    } else {
      navigate("/login?mode=register");
    }
  };`
  );

  // Убираем кнопку "Войти" (Desktop)
  out = out.replace(
    /<button\s*onClick=\{goLogin\}\s*className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"\s*>\s*Войти\s*<\/button>/,
    ""
  );

  // Убираем кнопку "Войти" (Mobile)
  out = out.replace(
    /<button\s*onClick=\{goLogin\}\s*className="w-full px-3 py-2\.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50"\s*>\s*Войти\s*<\/button>/,
    ""
  );

  // Меняем текст кнопок на "Попробовать бесплатно и без регистрации"
  out = out.replace(/Попробовать бесплатно(?! и без регистрации)/g, "Попробовать бесплатно и без регистрации");
  
  // Удаляем неиспользуемую функцию goLogin
  out = out.replace(/const goLogin = \(\) => \{\s*setMobileOpen\(false\);\s*navigate\("\/login"\);\s*\};/g, "");

  return out;
});

// 2. Главный экран (HeroSection.tsx)
patchFile("frontend/src/components/landing/HeroSection.tsx", (content) => {
  let out = content;
  // Убеждаемся, что текст правильный (он уже "Начать бесплатно", но на всякий случай)
  out = out.replace(/Попробовать бесплатно/g, "Начать бесплатно");
  return out;
});

// 3. Финальный призыв (FinalCTA.tsx)
patchFile("frontend/src/components/landing/FinalCTA.tsx", (content) => {
  let out = content;
  // Меняем "Создать аккаунт" на "Начать бесплатно"
  out = out.replace(/Создать аккаунт/g, "Начать бесплатно");
  return out;
});

// 4. Тарифы (PricingSection.tsx)
patchFile("frontend/src/components/landing/PricingSection.tsx", (content) => {
  let out = content;
  
  // Добавляем пропс onStartGuest
  out = out.replace(
    "export default function PricingSection() {",
    "export default function PricingSection({ onStartGuest }: { onStartGuest?: (source: string, target?: string) => void }) {"
  );

  // Меняем логику клика по тарифам
  out = out.replace(
    /const handlePlanClick = async \(plan: Plan\) => \{[\s\S]*?if \(plan\.id === "business"\) \{\s*setContactOpen\(true\);\s*return;\s*\}\s*if \(plan\.id === "free"\) \{\s*navigate\("\/login\?mode=register"\);\s*return;\s*\}/,
    `const handlePlanClick = async (plan: Plan) => {
    if (plan.id === "business") {
      setContactOpen(true);
      return;
    }
    if (plan.id === "free") {
      if (onStartGuest) {
        onStartGuest("pricing_free", "/"); // Ведём на главную
      } else {
        navigate("/login?mode=register");
      }
      return;
    }`
  );

  // Меняем логику для Pro тарифа (если нет токена)
  out = out.replace(
    /const token = localStorage\.getItem\("token"\);\s*if \(!token\) \{\s*\/\/ 💾 Сохраняем намерение купить — после регистрации проведём к оплате\s*sessionStorage\.setItem\("pendingCheckout", JSON\.stringify\(\{ plan: plan\.id, yearly \}\)\);\s*navigate\("\/login\?mode=register"\);\s*return;\s*\}/,
    `const token = localStorage.getItem("token");
    if (!token) {
      if (onStartGuest) {
        // 💾 Создаём гостя и ведём прямо в кошелёк
        sessionStorage.setItem("pendingCheckout", JSON.stringify({ plan: plan.id, yearly }));
        onStartGuest("pricing_pro", "/wallet"); 
      } else {
        sessionStorage.setItem("pendingCheckout", JSON.stringify({ plan: plan.id, yearly }));
        navigate("/login?mode=register");
      }
      return;
    }`
  );

  return out;
});

// 5. Лендинг (LandingPage.tsx)
patchFile("frontend/src/pages/LandingPage.tsx", (content) => {
  let out = content;

  // Обновляем функцию handleRegisterClick, чтобы она принимала target (куда редиректить)
  if (!out.includes("async (source: string, target: string = \"/\")")) {
    out = out.replace(
      /const handleRegisterClick = async \(source: string\) => \{/,
      `const handleRegisterClick = async (source: string, target: string = "/") => {`
    );
    // Меняем редиректы внутри функции
    out = out.replace(/window\.location\.href = "\/";/g, "window.location.href = target;");
  }

  // Передаем handleRegisterClick в Header
  out = out.replace(
    "<LandingHeader />",
    "<LandingHeader onStartGuest={handleRegisterClick} />"
  );

  // Передаем handleRegisterClick в PricingSection
  out = out.replace(
    "<PricingSection />",
    "<PricingSection onStartGuest={handleRegisterClick} />"
  );

  // Меняем текст плавающей кнопки
  out = out.replace(/Попробовать бесплатно/g, "Начать бесплатно");

  return out;
});

console.log("Готово. Все кнопки перенастроены на гостевой режим.");