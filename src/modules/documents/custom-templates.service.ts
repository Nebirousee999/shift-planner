import { eq, and } from "drizzle-orm";
import mammoth from "mammoth";
import HTMLtoDOCX from "html-to-docx";
import { db } from "../../../db/client.js";
import {
  documentCustomTemplates,
  organizations,
  users,
} from "../../../db/schema.js";

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
    const trimmed = key.replace(/\s+/g, " ").trim();
    return values[trimmed] ?? match;
  });
}

// DOCX → HTML (при загрузке)
async function docxBufferToHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  return result.value;
}

// HTML → DOCX (при генерации)
async function htmlToDocxBuffer(bodyHtml: string): Promise<Buffer> {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5;">
${bodyHtml}
</body>
</html>`;

  const buffer = await HTMLtoDOCX(html, null, {
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false,
  });
  return buffer as Buffer;
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

  // Загрузка .docx → сохраняем HTML
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

  // Собираем значения для подстановки
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
    values["Сегодня"] = today();

    const paramLabels: Record<string, string> = {
      orderNumber: "Номер приказа",
      orderDate: "Дата приказа",
      startDate: "Дата начала",
      salary: "Оклад",
      position: "Должность",
      employeeName: "ФИО сотрудника",
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

    // Сотрудники
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

  // Генерация по кастомному шаблону
  async renderToDocx(input: {
    orgId: string;
    type: string;
    params: Record<string, any>;
    employeeIds?: string[];
  }): Promise<Buffer | null> {
    const tpl = await this.get(input.orgId, input.type);
    if (!tpl) return null;

    const values = await this.buildValues({
      orgId: input.orgId,
      params: input.params,
      employeeIds: input.employeeIds,
    });

    // Заменяем плейсхолдеры в HTML
    const filledHtml = substitute(tpl.content, values);

    // Заменяем \n на <br> для списка сотрудников
    const withBreaks = filledHtml.replace(
      /\{СписокСотрудников\}/g,
      values["СписокСотрудников"] ?? ""
    );

    // Генерируем DOCX из HTML
    return htmlToDocxBuffer(withBreaks);
  },
};