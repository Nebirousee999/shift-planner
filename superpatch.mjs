// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touched = 0;

function patchFile(relPath, search, replace, label) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf-8");
  const hadCRLF = content.includes("\r\n");
  let normalized = hadCRLF ? content.replace(/\r\n/g, "\n") : content;

  if (normalized.includes(replace)) return;

  if (normalized.includes(search)) {
    normalized = normalized.replace(search, replace);
    fs.writeFileSync(filePath, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
    touched++;
    console.log("✅ [" + label + "] Применено");
  } else {
    console.log("⚠️ [" + label + "] Не найдено.");
  }
}

// ═══ 1. Фикс выхода из профиля (очищаем токен чата) ═══
patchFile(
  "frontend/src/store/auth.ts",
  `  logout: () => {\n    localStorage.removeItem("token");\n    localStorage.removeItem("user");`,
  `  logout: () => {\n    localStorage.removeItem("token");\n    localStorage.removeItem("user");\n    localStorage.removeItem("support_session_token"); // Очищаем сессию чата`,
  "auth.ts (очистка сессии при выходе)"
);

// ═══ 2. Фикс виджета (показываем почту, если она пустая) ═══
patchFile(
  "frontend/src/components/SupportChat.tsx",
  `  const [email, setEmail] = useState(user?.email || "");`,
  `  const [email, setEmail] = useState(user?.email || "");\n\n  useEffect(() => {\n    if (user?.email) setEmail(user.email);\n  }, [user?.email]);`,
  "SupportChat.tsx (обновление email при смене юзера)"
);

patchFile(
  "frontend/src/components/SupportChat.tsx",
  `        {messages.length === 0 && (`,
  `        {(!email || messages.length === 0) && (`,
  "SupportChat.tsx (показ почты, если пустая)"
);

console.log("\n──────────────────────────────────────");
if (touched > 0) {
  console.log("🎉 Готово! Чат очищается при выходе, почта всегда запрашивается.");
} else {
  console.log("⚠️ Изменений не внесено.");
}