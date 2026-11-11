// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const filePath = path.join(process.cwd(), "frontend/src/api/support.ts");
let content = fs.readFileSync(filePath, "utf-8");

const search = `  adminReply: async (ticketId: string, text: string) => {\n    const { data } = await api.post(\`/support/admin/tickets/\${ticketId}/reply\`, { text });\n    return data;\n  }`;
const replace = `  adminReply: async (ticketId: string, text: string, images?: string[]) => {\n    const { data } = await api.post(\`/support/admin/tickets/\${ticketId}/reply\`, { text, images });\n    return data;\n  }`;

if (content.includes(search)) {
  content = content.replace(search, replace);
  fs.writeFileSync(filePath, content, "utf-8");
  console.log("✅ [api/support.ts] Исправлена функция adminReply (добавлены картинки).");
} else if (content.includes("images?: string[]")) {
  console.log("⏭  [api/support.ts] Уже исправлено.");
} else {
  console.log("⚠️ [api/support.ts] Не найдено. Проверьте вручную.");
}