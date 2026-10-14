import ExcelJS from "exceljs";
import JSZip from "jszip";
import { getDocumentType } from "./templates.js";
import { generateDocx } from "./generators.js";
import { htmlToDocxBuffer } from "./html-to-docx.js";

// Поля, которые заполняются из организации (не в Excel)
const ORG_FIELDS = [
  "orgName",
  "city",
  "directorName",
  "orgInn",
  "orgAddress",
];

// Поля, которые не показываются и не идут в Excel
const HIDDEN_FIELDS = [
  ...ORG_FIELDS,
  "responsiblePosition",
  "employeePosition",
  "personPosition",
];

function isHiddenField(name: string): boolean {
  return HIDDEN_FIELDS.includes(name);
}

// Поля типа "employee_select" — не выводим в Excel отдельно
const EMPLOYEE_FIELD_NAMES = new Set([
  "employeeName",
  "responsibleName",
  "personName",
]);

// ─── Excel-шаблон ───────────────────────────────────
export async function buildExcelTemplate(typeId: string): Promise<Buffer> {
  const docType = getDocumentType(typeId);
  if (!docType) throw new Error("UNKNOWN_DOCUMENT_TYPE");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Планировщик смен";

  const ws = wb.addWorksheet("Данные", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  const columns: { key: string; header: string; width: number }[] = [];

  // ФИО — единственная колонка для связи с сотрудником
  columns.push({
    key: "__employee_name",
    header: "ФИО сотрудника",
    width: 32,
  });

  // Остальные поля документа
  for (const f of docType.fields) {
    if (isHiddenField(f.name)) continue;
    if (EMPLOYEE_FIELD_NAMES.has(f.name)) continue;
    if (f.name === "position") continue;
    columns.push({
      key: f.name,
      header: f.label,
      width: Math.max(15, Math.min(35, f.label.length + 5)),
    });
  }

  ws.columns = columns;

  // Шапка
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  };
  headerRow.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  headerRow.height = 40;

  // Пример заполнения
  const exampleData: Record<string, any> = {};
  for (const col of columns) {
    if (col.key === "__employee_name") {
      exampleData[col.key] = "Иванов Иван Иванович";
    } else {
      const field = docType.fields.find((f) => f.name === col.key);
      if (field?.type === "date") {
        exampleData[col.key] = "2026-10-14";
      } else {
        exampleData[col.key] = field?.defaultValue ?? "";
      }
    }
  }
  const exampleRow = ws.addRow(exampleData);
  exampleRow.font = { italic: true, color: { argb: "FF9CA3AF" } };

  // Рамки
  for (let i = 1; i <= columns.length; i++) {
    const cell = headerRow.getCell(i);
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  }

  // Подсказка
  const hintRow = ws.addRow([]);
  const hintCell = ws.getRow(hintRow.number + 1).getCell(1);
  hintCell.value =
    "Заполните по одной строке на каждого сотрудника. " +
    "ФИО должно совпадать с ФИО в разделе «Сотрудники» — тогда email и должность подтянутся автоматически. " +
    "Первая строка — пример, удалите её перед заполнением.";
  hintCell.font = { italic: true, color: { argb: "FF6B7280" }, size: 9 };

  return (await wb.xlsx.writeBuffer()) as Buffer;
}

// ─── Парсинг Excel ──────────────────────────────────
export type ParsedRow = Record<string, string>;

export async function parseExcel(
  buffer: Buffer,
  typeId: string
): Promise<ParsedRow[]> {
  const docType = getDocumentType(typeId);
  if (!docType) throw new Error("UNKNOWN_DOCUMENT_TYPE");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  const ws = wb.worksheets[0];
  if (!ws) throw new Error("EMPTY_EXCEL");

  const headerRow = ws.getRow(1);
  const headers: Record<number, string> = {};
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const labelToField: Record<string, string> = {
    "ФИО сотрудника": "__employee_name",
  };
  for (const f of docType.fields) {
    labelToField[f.label] = f.name;
  }

  const rows: ParsedRow[] = [];

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const parsed: ParsedRow = {};

    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      const fieldName = labelToField[header];
      if (!fieldName) return;

      let value: any = cell.value;

      if (value instanceof Date) {
        value = value.toISOString().slice(0, 10);
      } else if (value && typeof value === "object") {
        if ("text" in value) value = (value as any).text;
        else if ("result" in value) value = (value as any).result;
        else value = String(value);
      }

      parsed[fieldName] = String(value ?? "").trim();
    });

    const hasData = Object.values(parsed).some((v) => v);
    if (hasData) rows.push(parsed);
  }

  return rows;
}

// ─── Безопасная генерация ───────────────────────────
async function safeGenerateDocx(
  typeId: string,
  params: Record<string, any>
): Promise<Buffer> {
  const docType = getDocumentType(typeId);
  if (!docType) throw new Error("UNKNOWN_DOCUMENT_TYPE");

  const safeParams = { ...params };
  for (const f of docType.fields) {
    if (
      f.required &&
      (!safeParams[f.name] || String(safeParams[f.name]).trim() === "")
    ) {
      safeParams[f.name] = "—";
    }
  }

  return generateDocx(typeId, safeParams);
}

// ─── ZIP с документами ──────────────────────────────
export type BatchGenerateInput = {
  typeId: string;
  rows: ParsedRow[];
  orgData: {
    name: string | null;
    city: string | null;
    directorName: string | null;
    inn: string | null;
    legalAddress: string | null;
  };
  employees: {
    id: string;
    name: string;
    email: string;
    position: string | null;
  }[];
  customTemplateContent?: string | null;
};

export type BatchResult = {
  buffer: Buffer;
  totalRows: number;
  generatedFiles: number;
  errors: string[];
};

// Нормализация ФИО для сравнения
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateRU(iso: string): string {
  if (!iso) return "";
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} г.`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Собираем values для подстановки в HTML-шаблон
function buildHtmlValues(
  params: Record<string, any>,
  employee: { name: string; email: string; position: string | null } | null,
  orgData: BatchGenerateInput["orgData"]
): Record<string, string> {
  const values: Record<string, string> = {};

  // Организация
  values["Организация"] = orgData.name ?? "";
  values["Название организации"] = orgData.name ?? "";
  values["Город"] = orgData.city ?? "";
  values["Директор"] = orgData.directorName ?? "";
  values["ФИО директора"] = orgData.directorName ?? "";
  values["ИНН"] = orgData.inn ?? "";
  values["Адрес"] = orgData.legalAddress ?? "";
  values["Юридический адрес"] = orgData.legalAddress ?? "";
  values["Адрес организации"] = orgData.legalAddress ?? "";
  values["Сегодня"] = formatDateRU(new Date().toISOString().slice(0, 10));

  // Сотрудник
  if (employee) {
    values["Сотрудник"] = employee.name;
    values["ФИО сотрудника"] = employee.name;
    values["Email сотрудника"] = employee.email;
    values["Телефон сотрудника"] = "";
    values["Ставка сотрудника"] = "";
    values["Должность сотрудника"] = employee.position ?? "";
    values["Должность"] = employee.position ?? "";
    values["СписокСотрудников"] = employee.name;
  } else {
    values["Сотрудник"] = "—";
    values["ФИО сотрудника"] = "—";
    values["Email сотрудника"] = "";
    values["Телефон сотрудника"] = "";
    values["Ставка сотрудника"] = "";
    values["Должность сотрудника"] = "";
    values["Должность"] = "";
    values["СписокСотрудников"] = "—";
  }

  // Одна строка таблицы (для журнала) — один сотрудник
  values["Таблица журнала регистрации"] = employee
    ? `<table><tr>` +
      `<th>№</th><th>ФИО</th><th>Должность</th><th>Дата</th><th>Вид</th><th>Подпись инструктируемого</th><th>Подпись инструктирующего</th>` +
      `</tr><tr>` +
      `<td>1</td>` +
      `<td>${escapeHtml(employee.name)}</td>` +
      `<td>${escapeHtml(employee.position ?? "—")}</td>` +
      `<td>__________</td>` +
      `<td>вводный</td>` +
      `<td>__________</td>` +
      `<td>__________</td>` +
      `</tr></table>`
    : "";

  // Параметры формы
  const paramLabels: Record<string, string> = {
    orderNumber: "Номер приказа",
    orderDate: "Дата приказа",
    startDate: "Дата начала",
    salary: "Оклад",
    position: "Должность",
    employeeName: "ФИО сотрудника",
    employeeAddress: "Адрес сотрудника",
    employeePassport: "Паспорт сотрудника",
    year: "Год",
    instructionNumber: "Номер инструкции",
    approveDate: "Дата утверждения",
    consentDate: "Дата подписания",
    contractNumber: "Номер договора",
    contractDate: "Дата договора",
  };

  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" || typeof v === "number") {
      values[k] = String(v);
      const label = paramLabels[k];
      if (label) {
        const isDate =
          k.includes("Date") ||
          k === "approveDate" ||
          k === "consentDate" ||
          k === "contractDate";
        values[label] = isDate ? formatDateRU(String(v)) : String(v);
      }
    }
  }

  return values;
}

function substitute(
  content: string,
  values: Record<string, string>
): string {
  return content.replace(/\{([^{}]+)\}/g, (match, key) => {
    const trimmed = String(key).replace(/\s+/g, " ").trim();
    return values[trimmed] ?? match;
  });
}

// ─── Разворачиваем параграф вокруг табличных плейсхолдеров ───
// ─── Разворачиваем параграф вокруг табличных плейсхолдеров ───
function unwrapTablePlaceholders(html: string): string {
  const PLACEHOLDER = "{Таблица журнала регистрации}";

  let result = html;
  let changed = true;
  let safety = 0;

  while (changed && safety < 10) {
    safety++;
    changed = false;

    const patterns = [
      new RegExp(`<p[^>]*>\\s*${escapeRegex(PLACEHOLDER)}\\s*</p>`, "gi"),
      new RegExp(
        `<span[^>]*>\\s*${escapeRegex(PLACEHOLDER)}\\s*</span>`,
        "gi"
      ),
      new RegExp(
        `<strong[^>]*>\\s*${escapeRegex(PLACEHOLDER)}\\s*</strong>`,
        "gi"
      ),
      new RegExp(`<b[^>]*>\\s*${escapeRegex(PLACEHOLDER)}\\s*</b>`, "gi"),
      new RegExp(`<em[^>]*>\\s*${escapeRegex(PLACEHOLDER)}\\s*</em>`, "gi"),
      new RegExp(`<i[^>]*>\\s*${escapeRegex(PLACEHOLDER)}\\s*</i>`, "gi"),
      new RegExp(`<div[^>]*>\\s*${escapeRegex(PLACEHOLDER)}\\s*</div>`, "gi"),
    ];

    for (const pat of patterns) {
      const next = result.replace(pat, PLACEHOLDER);
      if (next !== result) {
        result = next;
        changed = true;
      }
    }
  }

  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Генерация пакета ───────────────────────────────
export async function generateBatchZip(
  input: BatchGenerateInput
): Promise<BatchResult> {
  const docType = getDocumentType(input.typeId);
  if (!docType) throw new Error("UNKNOWN_DOCUMENT_TYPE");

  const customTpl = input.customTemplateContent ?? null;

  const zip = new JSZip();
  const folder = zip.folder(sanitize(docType.title))!;

  const employeeByName = new Map<
    string,
    BatchGenerateInput["employees"][number]
  >();
  for (const e of input.employees) {
    employeeByName.set(normalizeName(e.name), e);
  }

  const errors: string[] = [];
  let index = 1;

  for (const row of input.rows) {
    const params: Record<string, any> = {};

    const nameFromExcel = row["__employee_name"] ?? "";
    const employee = nameFromExcel
      ? employeeByName.get(normalizeName(nameFromExcel))
      : undefined;

    for (const [key, value] of Object.entries(row)) {
      if (key === "__employee_name") continue;
      if (!value) continue;
      params[key] = value;
    }

    const finalName = nameFromExcel || employee?.name || "Сотрудник";
    const finalPosition = employee?.position ?? "";
    const finalEmail = employee?.email ?? "";

    // Подставляем ФИО во все employee_select поля
    for (const f of docType.fields) {
      if (f.type === "employee_select" || f.type === "employee_multi_select") {
        params[f.name] = finalName;
      }
    }

    if (finalPosition) {
      const positionFields = [
        "responsiblePosition",
        "position",
        "employeePosition",
        "personPosition",
      ];
      for (const pf of positionFields) {
        if (docType.fields.some((f) => f.name === pf)) {
          params[pf] = finalPosition;
        }
      }
    }

    try {
      let buffer: Buffer;

      if (customTpl) {
        // ─── Генерация по кастомному HTML-шаблону ───
        const htmlValues = buildHtmlValues(
          params,
          {
            name: finalName,
            email: finalEmail,
            position: finalPosition || null,
          },
          input.orgData
        );

        // 1. Разворачиваем параграфы вокруг табличных плейсхолдеров
        const unwrapped = unwrapTablePlaceholders(customTpl);

        // 2. Подставляем значения
        let filledHtml = substitute(unwrapped, htmlValues);

        // 3. \n → <br>
        filledHtml = filledHtml.replace(
          /\{СписокСотрудников\}/g,
          (htmlValues["СписокСотрудников"] ?? "").replace(/\n/g, "<br>")
        );

        const landscape = docType.landscape ?? false;

        buffer = await htmlToDocxBuffer(filledHtml, { landscape });
      }

      const filename = `${index}. ${sanitize(finalName)}.docx`;
      folder.file(filename, buffer);
      index++;
    } catch (e: any) {
      const errMsg = `${finalName}: ${e.message ?? "неизвестная ошибка"}`;
      errors.push(errMsg);
      // eslint-disable-next-line no-console
      console.error(`Ошибка генерации:`, errMsg);
    }
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  return {
    buffer,
    totalRows: input.rows.length,
    generatedFiles: index - 1,
    errors,
  };
}

function sanitize(s: string): string {
  return s.replace(/[<>:"/\\|?*]/g, "_").trim();
}