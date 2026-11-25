// superpatch.mjs
// Задача: письмо с графиком на почту должно приходить архивом (ZIP),
// если сотрудников несколько (режим месяц/год), а не одним Excel за 1 месяц.
//
// Причины бага:
//   1) GuestRegisterModal не передаёт mode/year/exportMode/selectedEmpId в /auth/quick-register
//      → buildCalcExcel уходит в ветку «1 сотрудник, месяц» → возвращает один xlsx.
//   2) sendWelcomeEmail игнорирует 5-й аргумент (имя файла) и хардкодит
//      "График_на_месяц.xlsx" + content-type xlsx — даже ZIP уходит под именем xlsx.
//
// Что делает патч:
//   1) mailer.service.ts — принимает attachmentName, ставит content-type по расширению.
//   2) auth.service.ts — options берутся из input или guestData; по умолчанию
//      exportMode="all" при >1 сотруднике → ZIP.
//   3) GuestRegisterModal.tsx — принимает mode/year/exportMode/selectedEmpId
//      и прокидывает в /auth/quick-register.
//
// Скрипт идемпотентен: повторный запуск ничего не сломает.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Читаем с сохранением EOL (CRLF/LF), матчим в LF, пишем обратно в исходном EOL
function patchFile(file, replaceFn, checks) {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) {
    console.error(`[SKIP] файл не найден: ${file}`);
    return { ok: false };
  }
  const raw = fs.readFileSync(fullPath, "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const normalized = raw.replace(/\r\n/g, "\n");

  console.log(`\n── ${file} (EOL=${eol === "\r\n" ? "CRLF" : "LF"})`);
  const patched = replaceFn(normalized);

  if (patched === normalized) {
    console.log("  [NOOP] изменений нет (всё уже пропатчено или маркер не найден)");
  } else {
    const restored = patched.replace(/\n/g, eol);
    fs.writeFileSync(fullPath, restored, "utf8");
    console.log("  [SAVE] записано");
  }

  const finalContent = fs.readFileSync(fullPath, "utf8").replace(/\r\n/g, "\n");
  for (const [label, re, expectMin] of checks) {
    const n = (finalContent.match(new RegExp(re.source, "g")) || []).length;
    const ok = n >= expectMin;
    console.log(`  ${ok ? "✓" : "✗"} ${label} (встреч: ${n}, нужно ≥${expectMin})`);
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────
// 1) mailer.service.ts — attachmentName + content-type by extension
// ─────────────────────────────────────────────────────────
patchFile(
  "src/lib/mailer.service.ts",
  (c) => {
    const from = `  async sendWelcomeEmail(to: string, name: string, password: string, excelBuffer: Buffer | null) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log(\`⚠️ SMTP не настроен. Письмо для \${to} не отправлено. Пароль: \${password}\`);
      return false;
    }
    try {
      const attachments = [];
      if (excelBuffer) {
        attachments.push({
          filename: "График_на_месяц.xlsx",
          content: excelBuffer,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
      }`;
    const to = `  async sendWelcomeEmail(to: string, name: string, password: string, excelBuffer: Buffer | null, attachmentName?: string) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log(\`⚠️ SMTP не настроен. Письмо для \${to} не отправлено. Пароль: \${password}\`);
      return false;
    }
    try {
      const attachments = [];
      if (excelBuffer) {
        const filename = attachmentName || "График_на_месяц.xlsx";
        const lower = filename.toLowerCase();
        let contentType = "application/octet-stream";
        if (lower.endsWith(".zip")) contentType = "application/zip";
        else if (lower.endsWith(".xlsx")) contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        else if (lower.endsWith(".docx")) contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        else if (lower.endsWith(".pdf")) contentType = "application/pdf";
        attachments.push({
          filename,
          content: excelBuffer,
          contentType,
        });
      }`;
    if (!c.includes(from)) {
      // Возможно уже пропатчено — проверим по маркеру
      if (c.includes("attachmentName?: string")) return c;
      return c;
    }
    return c.split(from).join(to);
  },
  [
    ["sendWelcomeEmail принимает attachmentName", /attachmentName\?:\s*string/, 1],
    ["content-type по расширению (.zip)", /endsWith\("\.zip"\)\)\s*contentType\s*=\s*"application\/zip"/, 1],
  ],
);

// ─────────────────────────────────────────────────────────
// 2) auth.service.ts — options fallback + default exportMode="all"
// ─────────────────────────────────────────────────────────
patchFile(
  "src/modules/auth/auth.service.ts",
  (c) => {
    const from = `    // Генерируем Excel или ZIP для письма
    let attachmentBuffer = null;
    let attachmentName = "";
    if (input.guestData && input.guestData.employees && input.guestData.employees.length > 0) {
      try {
        const calcResult = await this.buildCalcExcel(input.guestData, {
          mode: input.mode,
          year: input.year,
          exportMode: input.exportMode,
          selectedEmpId: input.selectedEmpId
        });`;
    const to = `    // Генерируем Excel или ZIP для письма.
    // Опции могут приходить на верхнем уровне запроса, а могут лежать в guestData.
    // Если сотрудников несколько и exportMode не задан — по умолчанию собираем
    // ZIP (exportMode="all"), чтобы на почту пришёл архив, а не один Excel за месяц.
    const __multiEmps = Array.isArray((input.guestData as any)?.employees) && (input.guestData as any).employees.length > 1;
    const __optMode = input.mode ?? (input.guestData as any)?.mode;
    const __optYear = input.year ?? (input.guestData as any)?.year;
    const __optExportMode = input.exportMode ?? (input.guestData as any)?.exportMode ?? (__multiEmps ? "all" : undefined);
    const __optSelectedEmpId = input.selectedEmpId ?? (input.guestData as any)?.selectedEmpId;

    let attachmentBuffer = null;
    let attachmentName = "";
    if (input.guestData && input.guestData.employees && input.guestData.employees.length > 0) {
      try {
        const calcResult = await this.buildCalcExcel(input.guestData, {
          mode: __optMode,
          year: __optYear,
          exportMode: __optExportMode,
          selectedEmpId: __optSelectedEmpId
        });`;
    if (!c.includes(from)) {
      if (c.includes("__optExportMode")) return c;
      return c;
    }
    return c.split(from).join(to);
  },
  [
    ["quickRegister: fallback options из guestData", /__optExportMode\s*=\s*input\.exportMode\s*\?\?/, 1],
    ["quickRegister: default exportMode=\"all\" при >1", /__multiEmps\s*\?\s*"all"/, 1],
  ],
);

// ─────────────────────────────────────────────────────────
// 3) GuestRegisterModal.tsx — принимает и прокидывает options
// ─────────────────────────────────────────────────────────
patchFile(
  "frontend/src/components/GuestRegisterModal.tsx",
  (c) => {
    let r = c;

    const pFrom = `type Props = {
  guestData: any;
  onClose: () => void;
};

export default function GuestRegisterModal({ guestData, onClose }: Props) {`;
    const pTo = `type Props = {
  guestData: any;
  onClose: () => void;
  mode?: string;
  year?: number;
  exportMode?: string;
  selectedEmpId?: string;
};

export default function GuestRegisterModal({ guestData, onClose, mode, year, exportMode, selectedEmpId }: Props) {`;
    if (r.includes(pFrom)) {
      r = r.split(pFrom).join(pTo);
    } else if (!r.includes("mode?: string;")) {
      // не нашли — не патчим
    }

    const qFrom = `      const { data } = await api.post("/auth/quick-register", {
        email,
        name: "Владелец",
        guestData,
      });`;
    const qTo = `      const { data } = await api.post("/auth/quick-register", {
        email,
        name: "Владелец",
        guestData,
        mode,
        year,
        exportMode,
        selectedEmpId,
      });`;
    if (r.includes(qFrom)) {
      r = r.split(qFrom).join(qTo);
    }

    return r;
  },
  [
    ["Modal принимает mode/year/exportMode/selectedEmpId", /mode\?:\s*string;[\s\S]{0,120}selectedEmpId\?:\s*string;/, 1],
    ["Modal прокидывает options в /auth/quick-register", /guestData,\s*\n\s*mode,\s*\n\s*year,/, 1],
  ],
);

console.log("\nГотово.");
console.log("Если что-то ✗ — см. вывод выше. Если всё ✓ — пересоберите фронт/сервер.");