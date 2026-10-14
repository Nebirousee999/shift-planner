import { eq, and } from "drizzle-orm";
import mammoth from "mammoth";
import { db } from "../../../db/client.js";
import {
  documentCustomTemplates,
  organizations,
  users,
} from "../../../db/schema.js";
import { htmlToDocxBuffer } from "../../lib/documents/html-to-docx.js";
import { getDocumentType } from "../../lib/documents/templates.js";

// ─── Утилиты ────────────────────────────────────────
function formatDateRU(iso: string): string {
  if (!iso) return "";
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} г.`;
}

function today(): string {
  return formatDateRU(new Date().toISOString().slice(0, 10));
}

export function substitute(
  content: string,
  values: Record<string, string>
): string {
  return content.replace(/\{([^{}]+)\}/g, (match, key) => {
    const trimmed = String(key).replace(/\s+/g, " ").trim();
    return values[trimmed] ?? match;
  });
}

// ─── Разворачиваем параграфы вокруг табличных плейсхолдеров ───
function unwrapTablePlaceholders(html: string): string {
  const PLACEHOLDER = "{Таблица журнала регистрации}";
  let result = html;
  let changed = true;
  let safety = 0;

  const escapeRegex = (s: string) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  while (changed && safety < 10) {
    safety++;
    changed = false;

    const patterns = [
      new RegExp(`<p[^>]*>\\s*${escapeRegex(PLACEHOLDER)}\\s*</p>`, "gi"),
      new RegExp(`<span[^>]*>\\s*${escapeRegex(PLACEHOLDER)}\\s*</span>`, "gi"),
      new RegExp(`<strong[^>]*>\\s*${escapeRegex(PLACEHOLDER)}\\s*</strong>`, "gi"),
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

// ─── DOCX → HTML (при загрузке) ────────────────────
async function docxBufferToHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  return result.value;
}

// ─── Список сотрудников как HTML-таблица ───────────
function buildEmployeeListHtml(
  employees: { name: string; position: string | null }[]
): string {
  if (employees.length === 0) {
    return "<p><i>Список сотрудников пуст.</i></p>";
  }

  const header =
    "<table><tr>" +
    "<th>№</th>" +
    "<th>ФИО</th>" +
    "<th>Должность</th>" +
    "<th>Дата</th>" +
    "<th>Вид</th>" +
    "<th>Подпись инструктируемого</th>" +
    "<th>Подпись инструктирующего</th>" +
    "</tr>";

  const rows = employees
    .map(
      (e, i) =>
        `<tr>` +
        `<td>${i + 1}</td>` +
        `<td>${escapeHtml(e.name)}</td>` +
        `<td>${escapeHtml(e.position ?? "—")}</td>` +
        `<td>__________</td>` +
        `<td>вводный</td>` +
        `<td>__________</td>` +
        `<td>__________</td>` +
        `</tr>`
    )
    .join("");

  return `${header}${rows}</table>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const customTemplatesService = {
  async get(orgId: string, type: string) {
    const [tpl] = await db
      .select()
      .from(documentCustomTemplates)
      .where(
        and(
          eq(documentCustomTemplates.orgId, orgId),
          eq(documentCustomTemplates.type, type)
        )
      );
    return tpl ?? null;
  },

  async list(orgId: string) {
    return db
      .select()
      .from(documentCustomTemplates)
      .where(eq(documentCustomTemplates.orgId, orgId));
  },

  async uploadDocx(input: {
    orgId: string;
    type: string;
    base64: string;
    fileName?: string;
  }) {
    const buffer = Buffer.from(input.base64, "base64");
    let html: string;
    try {
      html = await docxBufferToHtml(buffer);
    } catch (e) {
      throw new Error("INVALID_DOCX");
    }
    if (!html || html.trim().length === 0) {
      throw new Error("EMPTY_DOCX");
    }

    const existing = await this.get(input.orgId, input.type);
    if (existing) {
      const [updated] = await db
        .update(documentCustomTemplates)
        .set({ content: html, fileName: input.fileName })
        .where(eq(documentCustomTemplates.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(documentCustomTemplates)
      .values({
        orgId: input.orgId,
        type: input.type,
        content: html,
        fileName: input.fileName,
      })
      .returning();
    return created;
  },

  async remove(orgId: string, type: string) {
    await db
      .delete(documentCustomTemplates)
      .where(
        and(
          eq(documentCustomTemplates.orgId, orgId),
          eq(documentCustomTemplates.type, type)
        )
      );
  },

  async buildValues(input: {
    orgId: string;
    params: Record<string, any>;
    employeeIds?: string[];
  }): Promise<Record<string, string>> {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, input.orgId));

    const values: Record<string, string> = {};

    values["Организация"] = org?.name ?? "";
    values["Название организации"] = org?.name ?? "";
    values["Город"] = org?.city ?? "";
    values["Директор"] = org?.directorName ?? "";
    values["ФИО директора"] = org?.directorName ?? "";
    values["ИНН"] = org?.inn ?? "";
    values["Адрес"] = org?.legalAddress ?? "";
    values["Юридический адрес"] = org?.legalAddress ?? "";
    values["Адрес организации"] = org?.legalAddress ?? "";
    values["Сегодня"] = today();

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

    for (const [k, v] of Object.entries(input.params ?? {})) {
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

    values["СписокСотрудников"] = "";
    values["Сотрудники"] = "";
    values["Сотрудник"] = "";
    values["ФИО сотрудника"] = "";
    values["Email сотрудника"] = "";
    values["Телефон сотрудника"] = "";
    values["Ставка сотрудника"] = "";
    values["Должность сотрудника"] = "";
    values["Должность"] = "";
    values["Таблица журнала регистрации"] = "";

    if (input.employeeIds && input.employeeIds.length > 0) {
      const list = await db
        .select()
        .from(users)
        .where(eq(users.orgId, input.orgId));
      const selected = list.filter((u) => input.employeeIds!.includes(u.id));

      const lines = selected.map((u, i) => {
        const rate = u.hourlyRate ? `${u.hourlyRate} ₽/ч` : "—";
        const pos = u.position ? ` — ${u.position}` : "";
        return `${i + 1}. ${u.name}${pos} — ${u.email} — ${rate}`;
      });
      values["СписокСотрудников"] = lines.join("\n");
      values["Сотрудники"] = lines.join("\n");

      values["Таблица журнала регистрации"] = buildEmployeeListHtml(
        selected.map((u) => ({
          name: u.name,
          position: u.position ?? null,
        }))
      );

      if (selected.length > 0) {
        const main = selected[0];
        values["Сотрудник"] = main.name;
        values["ФИО сотрудника"] = main.name;
        values["Email сотрудника"] = main.email;
        values["Телефон сотрудника"] = main.phone ?? "";
        values["Ставка сотрудника"] = main.hourlyRate
          ? `${main.hourlyRate} ₽/ч`
          : "";
        values["Должность сотрудника"] = main.position ?? "";
        values["Должность"] = main.position ?? "";
      }
    }

    return values;
  },

  async renderToDocx(input: {
    orgId: string;
    type: string;
    params: Record<string, any>;
    employeeIds?: string[];
  }): Promise<Buffer | null> {
    const tpl = await this.get(input.orgId, input.type);
    if (!tpl) return null;

    const employeeIds: string[] = [];
    if (Array.isArray(input.params?.employees)) {
      for (const id of input.params.employees) {
        if (typeof id === "string" && !employeeIds.includes(id)) {
          employeeIds.push(id);
        }
      }
    }
    if (Array.isArray(input.employeeIds)) {
      for (const id of input.employeeIds) {
        if (typeof id === "string" && !employeeIds.includes(id)) {
          employeeIds.push(id);
        }
      }
    }

    const values = await this.buildValues({
      orgId: input.orgId,
      params: input.params,
      employeeIds,
    });

    // Разворачиваем параграфы вокруг табличных плейсхолдеров
    let content = unwrapTablePlaceholders(tpl.content);

    // Заменяем плейсхолдеры
    let filledHtml = substitute(content, values);

    // \n → <br>
    filledHtml = filledHtml.replace(
      /\{СписокСотрудников\}/g,
      (values["СписокСотрудников"] ?? "").replace(/\n/g, "<br>")
    );

    // Ориентация из типа документа
    const docType = getDocumentType(input.type);
    const landscape = docType?.landscape ?? false;

    return htmlToDocxBuffer(filledHtml, { landscape });
  },
};