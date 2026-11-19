// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let changed = 0;

function patch(file, replacers) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return;
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

  if (src !== orig) fs.writeFileSync(p, crlf ? src.replace(/\n/g, "\r\n") : src, "utf-8");
}

// ────────────────────────────────────────────────
// 1. App.tsx: удаляем глобальную полосу, оставляя логику
// ────────────────────────────────────────────────
patch("frontend/src/App.tsx", [
  [
    `{isGuest && !emailAttached && (
        <div className="sticky top-0 z-10 w-full bg-amber-50 border-b border-amber-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col items-center justify-center gap-2">
            <div className="text-amber-800 text-sm font-medium flex items-center gap-2 text-center">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                Вы зашли как гость. Чтобы не потерять данные,{" "}
                <button onClick={() => { if (showEmailInput) setEmailError(true); else setShowEmailInput(true); }} className="underline font-bold hover:text-amber-900 transition-colors">
                  введите вашу почту
                </button>.
              </span>
            </div>
            {showEmailInput && (
              <div className="flex items-center gap-2 animate-fade-in pb-1">
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => { setGuestEmail(e.target.value); setEmailError(false); }}
                  placeholder="your@email.ru"
                  className={\`py-1.5 px-3 text-sm w-64 rounded-lg bg-white border \${emailError ? 'border-red-500 ring-2 ring-red-500/20' : 'border-amber-300'}\`}
                />
                <button
                  onClick={async () => {
                    if (!guestEmail.includes("@")) { setEmailError(true); return; }
                    try {
                      await api.post("/auth/update-email", { email: guestEmail });
                      localStorage.setItem("guestEmailAttached", "true");
                      setEmailAttached(true);
                      setShowEmailInput(false);
                      alert("Почта привязана!");
                    } catch (e: any) {
                      setEmailError(true);
                      alert(e.response?.data?.error ?? "Ошибка привязки почты");
                    }
                  }}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
                >
                  Привязать
                </button>
              </div>
            )}
          </div>
        </div>
      )}`,
    ``,
    "удалена глобальная полоса из App.tsx"
  ]
]);

// ────────────────────────────────────────────────
// 2. NavBar.tsx: добавляем гостевую полосу
// ────────────────────────────────────────────────
const navBarPath = "frontend/src/components/NavBar.tsx";
let navBarSrc = fs.readFileSync(path.join(ROOT, navBarPath), "utf-8");
const navBarCrlf = navBarSrc.includes("\r\n");
if (navBarCrlf) navBarSrc = navBarSrc.replace(/\r\n/g, "\n");

// 2.1 Добавляем импорт api
if (!navBarSrc.includes('import { api }')) {
  navBarSrc = navBarSrc.replace(
    'import { supportApi } from "../api/support";',
    'import { supportApi } from "../api/support";\nimport { api } from "../api/client";'
  );
  console.log("✅ NavBar.tsx: добавлен импорт api");
  changed++;
}

// 2.2 Добавляем состояния и эффект для гостя
const stateBlock = `
  const [isGuest, setIsGuest] = useState(false);
  const [emailAttached, setEmailAttached] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [emailError, setEmailError] = useState(false);

  useEffect(() => {
    const checkGuestStatus = () => {
      setIsGuest(localStorage.getItem("isGuest") === "true");
      setEmailAttached(localStorage.getItem("guestEmailAttached") === "true");
    };
    checkGuestStatus();
    window.addEventListener("storage", checkGuestStatus);
    window.addEventListener("guest-email-attached", checkGuestStatus);
    return () => {
      window.removeEventListener("storage", checkGuestStatus);
      window.removeEventListener("guest-email-attached", checkGuestStatus);
    };
  }, []);
`;

if (!navBarSrc.includes("const [isGuest, setIsGuest]")) {
  // Вставляем после объявления функции NavBar
  navBarSrc = navBarSrc.replace(
    "export default function NavBar() {",
    `export default function NavBar() {\n${stateBlock}`
  );
  console.log("✅ NavBar.tsx: добавлены состояния и эффект для гостя");
  changed++;
}

// 2.3 Создаём JSX для полосы
const guestBannerJsx = `
  const guestBanner = isGuest && !emailAttached ? (
    <div className="w-full bg-amber-50 border-b border-amber-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col items-center justify-center gap-2">
        <div className="text-amber-800 text-sm font-medium flex items-center gap-2 text-center">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            Вы зашли как гость. Чтобы не потерять данные,{" "}
            <button
              onClick={() => {
                if (showEmailInput) setEmailError(true);
                else setShowEmailInput(true);
              }}
              className="underline font-bold hover:text-amber-900 transition-colors"
            >
              введите вашу почту
            </button>
            .
          </span>
        </div>
        {showEmailInput && (
          <div className="flex items-center gap-2 animate-fade-in pb-1">
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => {
                setGuestEmail(e.target.value);
                setEmailError(false);
              }}
              placeholder="your@email.ru"
              className={\`py-1.5 px-3 text-sm w-64 rounded-lg bg-white border \${
                emailError ? "border-red-500 ring-2 ring-red-500/20" : "border-amber-300"
              }\`}
            />
            <button
              onClick={async () => {
                if (!guestEmail.includes("@")) {
                  setEmailError(true);
                  return;
                }
                try {
                  await api.post("/auth/update-email", { email: guestEmail });
                  localStorage.setItem("guestEmailAttached", "true");
                  setEmailAttached(true);
                  setShowEmailInput(false);
                  window.dispatchEvent(new Event("guest-email-attached"));
                  alert("Почта привязана!");
                } catch (e: any) {
                  setEmailError(true);
                  alert(e.response?.data?.error ?? "Ошибка привязки почты");
                }
              }}
              className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              Привязать
            </button>
          </div>
        )}
      </div>
    </div>
  ) : null;
`;

if (!navBarSrc.includes("const guestBanner =")) {
  // Вставляем перед первым return в функции NavBar
  navBarSrc = navBarSrc.replace(
    /return \(\s*<div className="min-h-screen flex flex-col">/,
    `${guestBannerJsx}\n  return (\n    <div className="min-h-screen flex flex-col">`
  );
  console.log("✅ NavBar.tsx: создан JSX для гостевой полосы");
  changed++;
}

// 2.4 Вставляем guestBanner в оба возврата (для сотрудника и админа)
// Ищем все вхождения return ( ... ) и добавляем {guestBanner} перед основным контентом
// Но проще: добавить {guestBanner} сразу после открывающего <div> в обоих return.

// В возврате для сотрудника (первый return)
const employeeReturnRegex = /(if \(!isAdmin\) \{\s*return \(\s*<div className="min-h-screen flex flex-col">)/;
if (navBarSrc.match(employeeReturnRegex) && !navBarSrc.includes("{guestBanner}")) {
  navBarSrc = navBarSrc.replace(
    employeeReturnRegex,
    `$1\n      {guestBanner}`
  );
  console.log("✅ NavBar.tsx: добавлен guestBanner в возврат для сотрудника");
  changed++;
}

// В возврате для админа (второй return, после комментария "Админ")
const adminReturnRegex = /(return \(\s*<div className="min-h-screen flex flex-col">)/g;
// Это может затронуть оба return, но второй раз уже будет с guestBanner, поэтому проверяем
// Проще: заменить все вхождения, но убедиться, что не дублируется.
// Используем глобальную замену с условием.
const parts = navBarSrc.split(/(return \(\s*<div className="min-h-screen flex flex-col">)/);
// parts: [до, разделитель, после, разделитель, после...]
// Восстановим, добавляя guestBanner после каждого разделителя, если его там ещё нет.
let newNavBar = parts[0];
for (let i = 1; i < parts.length; i++) {
  if (i % 2 === 1) {
    // Это разделитель
    newNavBar += parts[i];
    if (!parts[i + 1]?.includes("{guestBanner}")) {
      newNavBar += "\n      {guestBanner}";
    }
  } else {
    newNavBar += parts[i];
  }
}
navBarSrc = newNavBar;
console.log("✅ NavBar.tsx: добавлен guestBanner во все возвраты");
changed++;

if (navBarSrc) {
  fs.writeFileSync(path.join(ROOT, navBarPath), navBarCrlf ? navBarSrc.replace(/\n/g, "\r\n") : navBarSrc, "utf-8");
}

console.log(changed > 0
  ? `\n🏁 Готово. Исправлено фрагментов: ${changed}. Перезапустите фронтенд.`
  : "\nℹ️ Изменений не потребовалось.");