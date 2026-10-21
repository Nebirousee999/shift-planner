import { createRequire } from "node:module";
import type { AnalyticsSummary } from "../../modules/analytics/analytics.service.js";

const require = createRequire(import.meta.url);

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Владелец",
  MANAGER: "Менеджер",
  EMPLOYEE: "Сотрудник",
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(n) + " ₽";
const fmtPct = (n: number) => (n > 0 ? "+" : "") + n.toFixed(1) + "%";
const pctColor = (n: number) =>
  n > 0 ? "#16A34A" : n < 0 ? "#DC2626" : "#6B7280";

// ─── Инициализация PdfPrinter (кэшируется) ─────────────
// ─── Инициализация PdfPrinter (кэшируется) ─────────────
let printerInstance: any = null;
let initError: Error | null = null;

function getPrinter(): any {
  if (printerInstance) return printerInstance;
  if (initError) throw initError;

  try {
    const pdfMakeMod = require("pdfmake");

    // pdfmake 0.2.x: module.exports = PdfPrinter (сама функция)
    // pdfmake 0.3.x: module.exports = { PdfPrinter?, createPdf?, ... } или { default: ... }
    let PdfPrinter: any = null;

    if (typeof pdfMakeMod === "function") {
      // ← самый частый случай для 0.2.x
      PdfPrinter = pdfMakeMod;
    } else if (typeof pdfMakeMod?.PdfPrinter === "function") {
      PdfPrinter = pdfMakeMod.PdfPrinter;
    } else if (typeof pdfMakeMod?.default === "function") {
      PdfPrinter = pdfMakeMod.default;
    } else if (typeof pdfMakeMod?.default?.PdfPrinter === "function") {
      PdfPrinter = pdfMakeMod.default.PdfPrinter;
    }

    if (typeof PdfPrinter !== "function") {
      // Диагностика на случай, если всё ещё 0.3.x
      const diag =
        typeof pdfMakeMod === "object" && pdfMakeMod
          ? `keys: [${Object.keys(pdfMakeMod).join(", ")}], typeof: ${typeof pdfMakeMod}`
          : `typeof: ${typeof pdfMakeMod}`;
      throw new Error(
        `pdfmake: PdfPrinter не найден. ${diag}. ` +
          `Проверь версию: npm ls pdfmake (нужна 0.2.20)`
      );
    }

    // vfs_fonts.js в 0.2.x: module.exports = { pdfMake: { vfs: {...} } }
    // В некоторых сборках — просто { vfs: {...} } или { "Roboto-...ttf": "..." }
    const vfsMod = require("pdfmake/build/vfs_fonts.js");
    const vfs =
      vfsMod?.pdfMake?.vfs ??
      vfsMod?.vfs ??
      vfsMod?.default?.pdfMake?.vfs ??
      vfsMod?.default?.vfs ??
      (vfsMod && typeof vfsMod === "object" &&
       Object.keys(vfsMod).some((k) => k.endsWith(".ttf"))
        ? vfsMod
        : null);

    if (!vfs || !Object.keys(vfs).some((k) => k.endsWith(".ttf"))) {
      const diag =
        vfsMod && typeof vfsMod === "object"
          ? `keys: [${Object.keys(vfsMod).slice(0, 6).join(", ")}]`
          : `typeof: ${typeof vfsMod}`;
      throw new Error(
        `vfs_fonts.js: не найдены .ttf. ${diag}`
      );
    }

    printerInstance = new PdfPrinter({
      Roboto: {
        normal: Buffer.from(vfs["Roboto-Regular.ttf"], "base64"),
        bold: Buffer.from(vfs["Roboto-Medium.ttf"], "base64"),
        italics: Buffer.from(vfs["Roboto-Italic.ttf"], "base64"),
        bolditalics: Buffer.from(vfs["Roboto-MediumItalic.ttf"], "base64"),
      },
    });

    return printerInstance;
  } catch (e: any) {
    initError = e;
    throw e;
  }
}

// ─── Хелперы для таблиц ────────────────────────────────
function headerRow(labels: string[]) {
  return labels.map((t) => ({ text: t, style: "th" as const }));
}

// ─── Основной билдер ───────────────────────────────────
export async function buildAnalyticsPdf(
  data: AnalyticsSummary
): Promise<Buffer> {
  const printer = getPrinter();

  const metricsBody: any[][] = [headerRow(["Показатель", "Значение", "MoM"])];

  const addMetric = (label: string, value: string | number, mom?: number) => {
    metricsBody.push([
      label,
      { text: String(value), alignment: "right" },
      mom !== undefined
        ? {
            text: fmtPct(mom),
            color: pctColor(mom),
            bold: true,
            alignment: "right",
          }
        : { text: "—", color: "#CBD5E1", alignment: "right" },
    ]);
  };

  addMetric("План часов", data.totals.hours, data.totals.mom.hours);
  addMetric("Смен", data.totals.shifts, data.totals.mom.shifts);
  addMetric("План ФОТ", fmtMoney(data.totals.payroll), data.totals.mom.payroll);
  addMetric(
    "Факт ФОТ",
    fmtMoney(data.totals.actualPayroll),
    data.totals.mom.actualPayroll
  );
  addMetric(
    "Средняя цена смены",
    fmtMoney(data.totals.avgCost),
    data.totals.mom.avgCost
  );
  addMetric("Стоимость переработок", fmtMoney(data.totals.overtimeCost));
  addMetric("Фактические часы", data.planVsFact.actualHours);
  addMetric("План vs Факт", fmtPct(data.planVsFact.diffPercent));

  const weekdayBody: any[][] = [
    headerRow(["День", "Смен", "Часы", "ФОТ"]),
    ...data.byWeekday.map((d) => [
      {
        text: d.label,
        bold: d.weekday >= 5,
        color: d.weekday >= 5 ? "#7C3AED" : undefined,
      },
      { text: String(d.shifts), alignment: "right" },
      { text: String(d.plannedHours), alignment: "right" },
      { text: fmtMoney(d.payroll), alignment: "right" },
    ]),
  ];

  const positionBody: any[][] = [
    headerRow(["Должность", "Смен", "Часы", "ФОТ", "%"]),
    ...data.byPosition.map((p) => [
      p.position,
      { text: String(p.shifts), alignment: "right" },
      { text: String(p.plannedHours), alignment: "right" },
      { text: fmtMoney(p.payroll), alignment: "right" },
      { text: p.percent.toFixed(1) + "%", alignment: "right" },
    ]),
  ];

  const usersBody: any[][] = [
    headerRow([
      "Сотрудник",
      "Роль",
      "Смен",
      "План ч",
      "Факт ч",
      "План ФОТ",
      "Факт ФОТ",
      "Переработка",
    ]),
    ...data.users.map((u) => [
      u.name,
      ROLE_LABELS[u.role] ?? u.role,
      { text: String(u.shiftsCount), alignment: "right" },
      { text: String(u.plannedHours), alignment: "right" },
      { text: String(u.actualHours), alignment: "right" },
      { text: fmtMoney(u.plannedPayroll), alignment: "right" },
      { text: fmtMoney(u.actualPayroll), alignment: "right" },
      u.overtimeCost > 0
        ? {
            text: fmtMoney(u.overtimeCost),
            alignment: "right",
            color: "#D97706",
          }
        : { text: "—", color: "#CBD5E1", alignment: "right" },
    ]),
    [
      { text: "ИТОГО", bold: true },
      "",
      { text: String(data.totals.shifts), bold: true, alignment: "right" },
      { text: String(data.totals.hours), bold: true, alignment: "right" },
      {
        text: String(data.planVsFact.actualHours),
        bold: true,
        alignment: "right",
      },
      {
        text: fmtMoney(data.totals.payroll),
        bold: true,
        alignment: "right",
      },
      {
        text: fmtMoney(data.totals.actualPayroll),
        bold: true,
        alignment: "right",
      },
      {
        text: fmtMoney(data.totals.overtimeCost),
        bold: true,
        alignment: "right",
      },
    ],
  ];

  const docDefinition: any = {
    pageSize: "A4",
    pageMargins: [30, 30, 30, 40],
    defaultStyle: { font: "Roboto", fontSize: 9, color: "#0F172A" },
    footer: (cur: number, total: number) => ({
      columns: [
        {
          text: "Планировщик смен · Аналитика",
          color: "#94A3B8",
          fontSize: 8,
          margin: [30, 0, 0, 0],
        },
        {
          text: `${cur} / ${total}`,
          alignment: "right",
          color: "#94A3B8",
          fontSize: 8,
          margin: [0, 0, 30, 0],
        },
      ],
    }),
    content: [
      { text: "Аналитика", style: "h1" },
      {
        text: `Период: ${data.period.from} — ${data.period.to}`,
        color: "#475569",
        margin: [0, 0, 0, 2],
      },
      {
        text: `Сравнение с: ${data.prevPeriod.from} — ${data.prevPeriod.to}`,
        color: "#94A3B8",
        fontSize: 8,
        italics: true,
        margin: [0, 0, 0, 14],
      },

      { text: "Сводные показатели", style: "h2" },
      {
        table: {
          headerRows: 1,
          widths: ["*", "*", 70],
          body: metricsBody,
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 14],
      },

      { text: "Нагрузка по дням недели", style: "h2" },
      {
        table: {
          headerRows: 1,
          widths: ["auto", "*", "*", "*"],
          body: weekdayBody,
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 14],
      },

      { text: "ФОТ по должностям", style: "h2" },
      {
        table: {
          headerRows: 1,
          widths: ["*", "auto", "auto", "auto", "auto"],
          body: positionBody,
        },
        layout: "lightHorizontalLines",
      },

      { text: "Детализация по сотрудникам", style: "h2", pageBreak: "before" },
      {
        table: {
          headerRows: 1,
          widths: ["*", "auto", "auto", "auto", "auto", "auto", "auto", "auto"],
          body: usersBody,
        },
        layout: "lightHorizontalLines",
      },
    ],
    styles: {
      h1: { fontSize: 20, bold: true, margin: [0, 0, 0, 4] },
      h2: {
        fontSize: 12,
        bold: true,
        margin: [0, 4, 0, 8],
        color: "#1E293B",
      },
      th: {
        bold: true,
        color: "#FFFFFF",
        fillColor: "#2563EB",
        fontSize: 8,
      },
    },
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}