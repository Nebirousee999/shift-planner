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
    console.log(`⚠ ${p} (совпадений не найдено)`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. ОБНОВЛЯЕМ LEGAL PAGE (Оферта, Соглашение, Политика)
// ═══════════════════════════════════════════════════════════════
patchFile("frontend/src/pages/LegalPage.tsx", [
  // --- ОФЕРТА ---
  [
    `            <p>
              Настоящий документ является официальным предложением (публичной офертой)
              ООО «Планировщик» (далее — Исполнитель) заключить договор на оказание
              платных услуг по предоставлению доступа к расширенному функционалу Сервиса
              «Планировщик смен» на изложенных ниже условиях.
            </p>`,
    `            <p>
              Настоящий документ является публичной офертой (далее — «Оферта»)
              Индивидуального предпринимателя <strong>Приходько Сергей Сергеевич</strong>
              (ИНН <strong>701729214964</strong>, ОГРНИП <strong>323470400073210</strong>, далее — «Исполнитель»),
              и содержит все существенные условия оказания информационных услуг
              через сайт <strong>shift-planner.ru</strong> (далее — «Сайт»).
            </p>`
  ],
  // --- СОГЛАШЕНИЕ (Заменяем ООО на ИП) ---
  [
    `      <p>
        Настоящее Пользовательское соглашение (далее — Соглашение) регулирует
        отношения между ООО «Планировщик» (далее — Администрация) и любым лицом,
        использующим сервис «Планировщик смен» (далее — Сервис).
      </p>`,
    `      <p>
        Настоящее Пользовательское соглашение (далее — Соглашение) регулирует
        отношения между ИП Приходько Сергей Сергеевич (ИНН 701729214964, ОГРНИП 323470400073210) (далее — Администрация) и любым лицом,
        использующим сервис «Планировщик смен» (далее — Сервис).
      </p>`
  ],
  // --- ПОЛИТИКА (Добавляем блок реквизитов в конец) ---
  [
    `        Вы имеете право на доступ к своим данным, их изменение или удаление. Для
        удаления аккаунта и всех связанных данных необходимо направить запрос на
        почту <a href="mailto:help@shift-planner.ru" className="text-brand-600 hover:underline">help@shift-planner.ru</a>.
      </p>
    </>`,
    `        Вы имеете право на доступ к своим данным, их изменение или удаление. Для
        удаления аккаунта и всех связанных данных необходимо направить запрос на
        почту <a href="mailto:help@shift-planner.ru" className="text-brand-600 hover:underline">help@shift-planner.ru</a>.
      </p>

      <h2 className="text-lg font-bold text-slate-900 mt-8 mb-2">5. Реквизиты Оператора</h2>
      <p>
        <b>Индивидуальный предприниматель:</b> Приходько Сергей Сергеевич<br/>
        <b>ИНН:</b> 701729214964<br/>
        <b>ОГРНИП:</b> 323470400073210<br/>
        <b>Email:</b> help@shift-planner.ru
      </p>
    </>`
  ]
]);

// ═══════════════════════════════════════════════════════════════
// 2. ОБНОВЛЯЕМ ФУТЕР (Добавляем реквизиты)
// ═══════════════════════════════════════════════════════════════
patchFile("frontend/src/components/landing/LandingFooter.tsx", [
  [
    `        <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} Планировщик смен · Все права защищены
          </div>
          <div>Сделано с ❤️ для малого бизнеса</div>
        </div>`,
    `        <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 text-center">
          <div>© {new Date().getFullYear()} Планировщик смен · Все права защищены</div>
          <div>ИП Приходько Сергей Сергеевич · ИНН 701729214964 · ОГРНИП 323470400073210</div>
          <div className="mt-1">Сделано с ❤️ для малого бизнеса</div>
        </div>`
  ]
]);

console.log("\n✅ Юридические документы и футер успешно обновлены!");
console.log("ООО заменено на ИП, добавлены реквизиты и исправлен домен.");