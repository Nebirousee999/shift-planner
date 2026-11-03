import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function writeN(p, content) {
  fs.writeFileSync(path.join(ROOT, p), content, "utf-8");
  console.log(`✔ ${p}`);
}

function patchFile(p, replaces) {
  const raw = fs.readFileSync(path.join(ROOT, p), "utf-8");
  const hadCRLF = raw.includes("\r\n");
  let c = raw.replace(/\r\n/g, "\n");
  let touched = 0;
  for (const [from, to] of replaces) {
    if (c.includes(from)) { c = c.replace(from, to); touched++; }
  }
  if (touched > 0) {
    fs.writeFileSync(path.join(ROOT, p), hadCRLF ? c.replace(/\n/g, "\r\n") : c, "utf-8");
    console.log(`✔ ${p} (${touched} замен)`);
  } else {
    console.log(`⚠ ${p} (ничего не найдено)`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. СОЗДАЕМ КОМПОНЕНТ TRUSTBAR
// ═══════════════════════════════════════════════════════════════
writeN("frontend/src/components/landing/TrustBar.tsx", `import { ShieldCheck, Smartphone, DatabaseBackup, FileSpreadsheet } from "lucide-react";

const ITEMS = [
  {
    icon: ShieldCheck,
    title: "152-ФЗ",
    desc: "Безопасность данных",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    icon: FileSpreadsheet,
    title: "Импорт из Excel",
    desc: "Перенос за 2 минуты",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: Smartphone,
    title: "PWA",
    desc: "Работает как приложение",
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    icon: DatabaseBackup,
    title: "Бэкапы",
    desc: "Ежедневно и надежно",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
];

export default function TrustBar() {
  return (
    <div className="border-y border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex items-center gap-3">
                <div className={\`w-10 h-10 rounded-xl \${item.bg} \${item.color} flex items-center justify-center shrink-0\`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 text-sm leading-tight">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {item.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
`);

// ═══════════════════════════════════════════════════════════════
// 2. ДОБАВЛЯЕМ TRUSTBAR НА ЛЕНДИНГ
// ═══════════════════════════════════════════════════════════════
patchFile("frontend/src/pages/LandingPage.tsx", [
  [
    `import TopBar from "../components/landing/TopBar";`,
    `import TopBar from "../components/landing/TopBar";\nimport TrustBar from "../components/landing/TrustBar";`
  ],
  [
    `        <HeroSection onCtaClick={() => handleRegisterClick("hero")} />`,
    `        <HeroSection onCtaClick={() => handleRegisterClick("hero")} />\n        <Reveal><TrustBar /></Reveal>`
  ]
]);

// ═══════════════════════════════════════════════════════════════
// 3. ДОБАВЛЯЕМ АКЦЕНТ НА EXCEL В HERO SECTION
// ═══════════════════════════════════════════════════════════════
patchFile("frontend/src/components/landing/HeroSection.tsx", [
  [
    `              <li className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Отмена в один клик
              </li>`,
    `              <li className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Легкий перенос из Excel
              </li>`
  ]
]);

// ═══════════════════════════════════════════════════════════════
// 4. ФИКСИМ ФУТЕР (РАБОТА ССЫЛОК С ДРУГИХ СТРАНИЦ)
// ═══════════════════════════════════════════════════════════════
patchFile("frontend/src/components/landing/LandingFooter.tsx", [
  [
    `import { CalendarDays, Mail, Send } from "lucide-react";\nimport { Link } from "react-router-dom";`,
    `import { CalendarDays, Mail, Send } from "lucide-react";\nimport { Link, useNavigate, useLocation } from "react-router-dom";`
  ],
  [
    `export default function LandingFooter() {\n  const scrollTo = (href: string) => {\n    if (href.startsWith("#") && href.length > 1) {\n      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });\n    }\n  };`,
    `export default function LandingFooter() {\n  const navigate = useNavigate();\n  const { pathname } = useLocation();\n\n  const scrollTo = (href: string) => {\n    if (href.startsWith("#") && href.length > 1) {\n      const isHomePage = pathname === "/" || pathname === "/welcome";\n      if (isHomePage) {\n        document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });\n      } else {\n        navigate("/", { state: { scrollTo: href } });\n      }\n    }\n  };`
  ]
]);

console.log("\n✅ Патч применён!");
console.log("1. Добавлен TrustBar (блок доверия) под Hero.");
console.log("2. В Hero добавлен акцент на перенос из Excel.");
console.log("3. Пофикшены ссылки в футере (теперь работают со страниц /contacts, /about и т.д.).");