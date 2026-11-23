// superpatch.mjs
// Финальный фикс рассинхрона пользователя (guest -> real user) и появление кнопок
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function patchFile(relPath, patcher) {
  const full = path.join(__dirname, relPath);
  if (!fs.existsSync(full)) { console.log(`[SKIP] ${relPath} не найден`); return; }
  const original = fs.readFileSync(full, "utf8");
  const isCRLF = original.includes("\r\n");
  let content = isCRLF ? original.replace(/\r\n/g, "\n") : original;
  let result;
  try { result = patcher(content); }
  catch (e) { console.log(`[ERROR] ${relPath}: ${e.message}`); return; }
  if (result !== content) {
    fs.writeFileSync(full, isCRLF ? result.replace(/\n/g, "\r\n") : result, "utf8");
    console.log(`[SAVE] ${relPath}`);
  } else {
    console.log(`[NOOP] ${relPath}`);
  }
}

// ─── 1. NavBar.tsx ───
patchFile("frontend/src/components/NavBar.tsx", (out) => {
  // Удаляем отладочные alert
  out = out.replace(/setTimeout\(\(\) => \{\s*alert\("NAVBAR DEBUG[^]*?\}, 500\);\n?/g, "");
  
  // Фиксим вход: сохраняем пользователя в localStorage
  const anchor = 'localStorage.setItem("token", tk);';
  if (out.includes(anchor) && !out.includes('localStorage.setItem("user", JSON.stringify(data.user))')) {
    out = out.replace(anchor, `${anchor}\n            if (data?.user) { localStorage.setItem("user", JSON.stringify(data.user)); }`);
    console.log("  [PATCH] NavBar: исправлено сохранение пользователя при входе");
  }
  
  return out;
});

// ─── 2. ProfilePage.tsx ───
patchFile("frontend/src/pages/ProfilePage.tsx", (out) => {
  // Удаляем отладочные alert
  out = out.replace(/setTimeout\(\(\) => \{\s*alert\("PROFILE DEBUG[^]*?\}, 1000\);\n?/g, "");
  console.log("  [PATCH] ProfilePage: отладочные окна удалены");
  return out;
});

// ─── 3. App.tsx ───
patchFile("frontend/src/App.tsx", (out) => {
  // Добавляем импорт meApi, если его нет
  if (!out.includes("import { meApi }")) {
    out = out.replace('import { useOrganization } from "./store/organization";', 'import { useOrganization } from "./store/organization";\nimport { meApi } from "./api/me";');
    console.log("  [PATCH] App.tsx: добавлен импорт meApi");
  }

  // Добавляем фоновую синхронизацию пользователя с сервером
  const anchor = 'useOrganization.getState().fetch();\n    }';
  const syncBlock = `useOrganization.getState().fetch();
      
      // Автосинхронизация профиля (лечит зависший guest_email)
      meApi.profile().then(p => {
        if (p) {
          const currentUser = useAuth.getState().user;
          if (currentUser && (currentUser.email !== p.email || currentUser.role !== p.role || currentUser.name !== p.name)) {
            const newUser = { ...currentUser, email: p.email, role: p.role, name: p.name };
            useAuth.setState({ user: newUser });
            localStorage.setItem("user", JSON.stringify(newUser));
          }
        }
      }).catch(() => {});
    }`;

  if (out.includes(anchor) && !out.includes("Автосинхронизация профиля")) {
    out = out.replace(anchor, syncBlock);
    console.log("  [PATCH] App.tsx: добавлена фоновая синхронизация профиля");
  }

  return out;
});

console.log("\n✅ Готово! Перезапустите Vite (Ctrl+C → npm run dev) и обновите страницу.");