import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const calcFilePath = path.join(__dirname, 'frontend', 'src', 'pages', 'CalculatorPage.tsx');
const libDir = path.join(__dirname, 'frontend', 'src', 'lib');
const seoFilePath = path.join(libDir, 'useSeo.ts');

console.log("⏳ Начинаем SEO-оптимизацию...");

// ==========================================
// 1. СОЗДАЕМ ХУК useSeo.ts
// ==========================================
if (!fs.existsSync(libDir)) {
  fs.mkdirSync(libDir, { recursive: true });
}

if (!fs.existsSync(seoFilePath)) {
  const useSeoContent = `import { useEffect } from "react";

export function useSeo(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }, [title, description]);
}
`;
  fs.writeFileSync(seoFilePath, useSeoContent, 'utf8');
  console.log("   [+] Создан файл useSeo.ts");
} else {
  console.log("   [!] useSeo.ts уже существует. Пропускаем.");
}

// ==========================================
// 2. ПАТЧИМ CalculatorPage.tsx
// ==========================================
if (!fs.existsSync(calcFilePath)) {
  console.error("❌ Файл CalculatorPage.tsx не найден");
  process.exit(1);
}

let content = fs.readFileSync(calcFilePath, 'utf8');

// 2.1. Добавляем импорт useSeo
if (!content.includes('import { useSeo } from "../lib/useSeo";')) {
  content = content.replace(
    'import { useAuth } from "../store/auth";',
    'import { useAuth } from "../store/auth";\nimport { useSeo } from "../lib/useSeo";'
  );
  console.log("   [+] Добавлен импорт useSeo");
}

// 2.2. Добавляем логику seoYear и вызов хука (внутри компонента, до return)
if (!content.includes('const seoYear =')) {
  const seoLogic = `
  // SEO-год: с декабря показываем следующий год — в декабре ищут график на новый
  const nowDate = new Date();
  const seoYear = nowDate.getMonth() === 11 ? nowDate.getFullYear() + 1 : nowDate.getFullYear();

  useSeo(
    \`Калькулятор графика смен на \${seoYear} год — расчет онлайн\`,
    \`Рассчитайте график смен \${seoYear} онлайн: смены, часы, ночные смены и затраты по ставке. Скачайте Excel бесплатно, без регистрации.\`
  );
`;
  
  // Вставляем перед основным return компонента
  content = content.replace(
    '  return (\n    <div className="min-h-screen bg-slate-50 flex flex-col">',
    seoLogic + '\n  return (\n    <div className="min-h-screen bg-slate-50 flex flex-col">'
  );
  console.log("   [+] Добавлена логика seoYear и вызов useSeo");
}

// 2.3. Меняем H1
if (content.includes('Калькулятор графика смен онлайн</h1>')) {
  content = content.replace(
    'Калькулятор графика смен онлайн</h1>',
    'Калькулятор графика смен на {seoYear} год</h1>'
  );
  console.log("   [+] Обновлен H1");
}

// 2.4. Добавляем перелинковку в SEO-блок (Примеры циклов)
const interlinkHtml = `
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-4">
              <a href="/calc" className="inline-flex items-center text-brand-600 hover:text-brand-700 font-medium text-sm transition-colors">
                График 2/2 на {seoYear} год →
              </a>
            </div>
`;
if (!content.includes('График 2/2 на {seoYear} год →')) {
  content = content.replace(
    '</ul>\n          </div>\n        </div>\n      </section>',
    '</ul>\n' + interlinkHtml + '\n          </div>\n        </div>\n      </section>'
  );
  console.log("   [+] Добавлена перелинковка на будущий лендинг");
}

fs.writeFileSync(calcFilePath, content, 'utf8');
console.log("✅ Успех! SEO-логика применена. Обновите страницу и проверьте H1 и вкладку браузера.");