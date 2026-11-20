// superpatch.mjs
// Задача: после "Выйти" пользователь должен попасть СРАЗУ в гостевой режим:
//   - без перехода на /login
//   - с видимым жёлтым баннером (guestEmailAttached должен быть сброшен)
//   - без кнопок "Профиль"/"Выйти" (isGuest="true", emailAttached="false")
//
// Правки:
//  1) store/auth.ts :: logout()   — очищает guestEmailAttached и ставит isGuest="true"
//  2) store/auth.ts :: login()    — реальный вход снимает isGuest/guestEmailAttached
//  3) store/auth.ts :: register() — то же для регистрации
//  4) components/NavBar.tsx       — handleLogout навигейтит на "/" вместо "/login"
//  5) App.tsx :: initGuest        — дополнительно чистит guestEmailAttached (страховка)
//
// Скрипт идемпотентен: повторный запуск ничего не сломает.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const patches = [
  {
    file: "frontend/src/store/auth.ts",
    description: "logout→guest: сброс guestEmailAttached + isGuest=true; login/register→real: снять флаги",
    replacements: [
      {
        // 1) logout(): после очистки token/user добавить очистку guest-флагов
        from: `  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("support_session_token"); // Очищаем сессию чата`,
        to: `  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("support_session_token"); // Очищаем сессию чата

    // После выхода пользователь попадает в гостевой режим:
    //  - снимаем guestEmailAttached, чтобы снова показать жёлтый баннер привязки почты
    //  - ставим isGuest=true, чтобы NavBar сразу скрыл "Профиль"/"Выйти"
    //    (guest-seed в App.tsx подтвердит и перезагрузит страницу)
    localStorage.removeItem("guestEmailAttached");
    localStorage.setItem("isGuest", "true");`,
      },
      {
        // 2) login(): после успешного входа снять guest-флаги
        from: `      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      // Сбрасываем старую организацию (если пользователь до этого был другой)
      resetOrganizationStore();
      set({ user: data.user, token: data.token, loading: false });
      return true;`,
        to: `      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      // Вошли как реальный пользователь — больше не гость
      localStorage.removeItem("isGuest");
      localStorage.removeItem("guestEmailAttached");
      // Сбрасываем старую организацию (если пользователь до этого был другой)
      resetOrganizationStore();
      set({ user: data.user, token: data.token, loading: false });
      return true;`,
      },
      {
        // 3) register(): то же
        from: `      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      resetOrganizationStore();
      set({ user: data.user, token: data.token, loading: false });
      return true;`,
        to: `      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      // Регистрация — это реальный пользователь, не гость
      localStorage.removeItem("isGuest");
      localStorage.removeItem("guestEmailAttached");
      resetOrganizationStore();
      set({ user: data.user, token: data.token, loading: false });
      return true;`,
      },
    ],
  },
  {
    file: "frontend/src/components/NavBar.tsx",
    description: "logout не уводит на /login, а сразу ведёт в гостевую зону",
    replacements: [
      {
        from: `  const handleLogout = () => {
    logout();
    navigate("/login");
  };`,
        to: `  const handleLogout = () => {
    logout();
    // Не уводим на /login: после выхода пользователь попадает в гостевой режим.
    // App.initGuest (эффект на token) создаст гостевую сессию и перезагрузит страницу;
    // а мы заранее уходим с приватной страницы, чтобы не рендерить её с user=null.
    navigate("/");
  };`,
      },
    ],
  },
  {
    file: "frontend/src/App.tsx",
    description: "initGuest: страховочно сбрасывать guestEmailAttached (чтобы баннер снова показывался)",
    replacements: [
      {
        // try-ветка
        from: `          const { data } = await api.post("/auth/guest-seed");
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("isGuest", "true");
          window.location.reload();`,
        to: `          const { data } = await api.post("/auth/guest-seed");
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("isGuest", "true");
          localStorage.removeItem("guestEmailAttached");
          window.location.reload();`,
      },
      {
        // catch-ветка
        from: `          localStorage.setItem("token", "guest-mock");
          localStorage.setItem("user", JSON.stringify({ id: "guest", name: "Гость", role: "OWNER", orgId: "guest-org" }));
          localStorage.setItem("isGuest", "true");
          window.location.reload();`,
        to: `          localStorage.setItem("token", "guest-mock");
          localStorage.setItem("user", JSON.stringify({ id: "guest", name: "Гость", role: "OWNER", orgId: "guest-org" }));
          localStorage.setItem("isGuest", "true");
          localStorage.removeItem("guestEmailAttached");
          window.location.reload();`,
      },
    ],
  },
];

let total = 0;
let applied = 0;

for (const p of patches) {
  const fullPath = path.join(__dirname, p.file);
  if (!fs.existsSync(fullPath)) {
    console.error(`[SKIP] файл не найден: ${p.file}`);
    continue;
  }
  console.log(`\n── ${p.file} — ${p.description}`);

  let content = fs.readFileSync(fullPath, "utf8");
  const original = content;

  for (const r of p.replacements) {
    total++;
    if (content.includes(r.from)) {
      content = content.split(r.from).join(r.to);
      applied++;
      console.log(`  [OK]   ${r.from.slice(0, 70).replace(/\n/g, "\\n")}...`);
    } else {
      console.warn(`  [WARN] не найдено: ${r.from.slice(0, 70).replace(/\n/g, "\\n")}...`);
    }
  }

  if (content !== original) {
    fs.writeFileSync(fullPath, content, "utf8");
    console.log(`  [SAVE] записано`);
  } else {
    console.log(`  [NOOP] без изменений`);
  }
}

console.log(`\nИтого: применено ${applied} из ${total} фрагментов.`);