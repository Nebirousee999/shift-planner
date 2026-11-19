// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let changed = 0;

function patch(file, replacers) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) {
    console.warn(`⚠️ Файл не найден: ${file}`);
    return;
  }
  let src = fs.readFileSync(p, "utf-8");
  const crlf = src.includes("\r\n");
  if (crlf) src = src.replace(/\r\n/g, "\n");
  const orig = src;

  for (const [find, replace, label] of replacers) {
    if (src.includes(find)) {
      src = src.replace(find, replace);
      console.log(`✅ ${file}: ${label}`);
      changed++;
    } else {
      console.warn(`⚠️ ${file}: не найден фрагмент для "${label}"`);
    }
  }

  if (src !== orig) {
    fs.writeFileSync(p, crlf ? src.replace(/\n/g, "\r\n") : src, "utf-8");
  }
}

// ────────────────────────────────────────────────
// WalletPage.tsx: вставка JSX-блоков для гостя
// ────────────────────────────────────────────────
patch("frontend/src/pages/WalletPage.tsx", [
  // 1. Блок email для триала (после кнопки "Активировать Pro")
  [
    `      {activatingTrial ? "Активация..." : "Активировать Pro"}
            </button>
          </div>
        )}`,
    `      {activatingTrial ? "Активация..." : "Активировать Pro"}
            </button>

            {showEmailInput && pendingAction?.type === 'trial' && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
                <p className="text-sm text-amber-900 mb-2">Введите вашу почту, чтобы сохранить данные:</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => { setGuestEmail(e.target.value); setEmailError(false); }}
                    placeholder="your@email.ru"
                    className={\`py-1.5 px-3 text-sm w-full max-w-xs rounded-lg bg-white border \${emailError ? 'border-red-500 ring-2 ring-red-500/20' : 'border-amber-300'}\`}
                  />
                  <button
                    onClick={handleAttachEmail}
                    className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors whitespace-nowrap"
                  >
                    Привязать
                  </button>
                </div>
              </div>
            )}
          </div>
        )}`,
    "добавлен блок email для триала"
  ],

  // 2. Блок email для оплаты (после блока с кнопками тарифов)
  [
    `      Продлить Business — {fmtMoney(yearly ? PRICES.business.yearly : PRICES.business.monthly)} / {yearly ? "год" : "мес"}
            </button>
          )}
        </div>

        {/* 🧪 Тестовая оплата (только для админа) */}`,
    `      Продлить Business — {fmtMoney(yearly ? PRICES.business.yearly : PRICES.business.monthly)} / {yearly ? "год" : "мес"}
            </button>
          )}

          {showEmailInput && pendingAction?.type === 'pay' && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
              <p className="text-sm text-amber-900 mb-2">Введите вашу почту, чтобы сохранить данные:</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => { setGuestEmail(e.target.value); setEmailError(false); }}
                  placeholder="your@email.ru"
                  className={\`py-1.5 px-3 text-sm w-full max-w-xs rounded-lg bg-white border \${emailError ? 'border-red-500 ring-2 ring-red-500/20' : 'border-amber-300'}\`}
                />
                <button
                  onClick={handleAttachEmail}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors whitespace-nowrap"
                >
                  Привязать
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 🧪 Тестовая оплата (только для админа) */}`,
    "добавлен блок email для оплаты"
  ],
]);

// ────────────────────────────────────────────────
// Итог
// ────────────────────────────────────────────────
console.log(`\n${changed > 0 ? "✅" : "⚠️"} Готово. Изменено фрагментов: ${changed}`);
if (changed === 0) {
  console.log("Возможно, файлы уже пропатчены или структура изменилась.");
}