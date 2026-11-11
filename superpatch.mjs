// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILE = path.join(ROOT, "frontend/src/api/shiftChangeRequests.ts");

if (!fs.existsSync(FILE)) {
  console.error("❌ Файл shiftChangeRequests.ts не найден");
  process.exit(1);
}

let content = fs.readFileSync(FILE, "utf-8");
const hadCRLF = content.includes("\r\n");
if (hadCRLF) content = content.replace(/\r\n/g, "\n");

const search = `  cancel: async (id: string): Promise<void> => {
    // DELETE — Fastify не парсит тело, Content-Type можно оставить,
    // но тело не нужно. Оставляем как есть — работает.
    const res = await fetch(\`\${API_URL}/shift-change-requests/\${id}\`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Ошибка отмены");
  },`;

const replace = `  cancel: async (id: string): Promise<void> => {
    // 🔥 Для DELETE не отправляем Content-Type, чтобы Fastify не ждал тело
    const token = localStorage.getItem("token");
    const res = await fetch(\`\${API_URL}/shift-change-requests/\${id}\`, {
      method: "DELETE",
      headers: { Authorization: \`Bearer \${token}\` },
    });
    if (!res.ok) throw new Error("Ошибка отмены");
  },`;

if (content.includes(replace)) {
  console.log("⏭  [shiftChangeRequests.ts] уже исправлено.");
} else if (content.includes(search)) {
  content = content.replace(search, replace);
  fs.writeFileSync(FILE, hadCRLF ? content.replace(/\n/g, "\r\n") : content, "utf-8");
  console.log("✅ [shiftChangeRequests.ts] Убран Content-Type для запроса отмены.");
} else {
  console.log("❌ Не удалось найти функцию cancel. Проверьте файл вручную.");
}