import { useState } from "react";
import {
  FileText,
  FileCheck2,
  ScrollText,
  Sparkles,
  Download,
  Check,
  ChevronRight,
  ArrowLeft,
  Package,
  User,
} from "lucide-react";
// Импортируем генератор Word
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell } from "docx";

// ─── Демо-сотрудники ───────────────────────────────
type DemoEmployee = {
  id: string;
  name: string;
  position: string;
};

const DEMO_EMPLOYEES: DemoEmployee[] = [
  { id: "e1", name: "Мария Иванова", position: "продавец" },
  { id: "e2", name: "Иван Петров", position: "повар" },
  { id: "e3", name: "Анна Сидорова", position: "официант" },
  { id: "e4", name: "Олег Кузнецов", position: "бариста" },
  { id: "e5", name: "Екатерина Смирнова", position: "администратор" },
];

// ─── Генератор DOCX (библиотека docx) ──────────────
async function generateDocxBlob(templateId: string, v: Record<string, string>): Promise<Blob> {
  let doc: Document;

  if (templateId === "hire") {
    doc = new Document({
      sections: [{
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ООО «Ромашка»", bold: true, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `ПРИКАЗ № ${v.orderNumber || "—"}`, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `от ${formatDate(v.orderDate)}`, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ text: "" }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "О ПРИЁМЕ НА РАБОТУ", bold: true, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun({ text: "ПРИНЯТЬ ", bold: true, font: "Times New Roman", size: 24 }), new TextRun({ text: `на работу ${v.employeeName || "____________"}`, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ children: [new TextRun({ text: "на должность ", font: "Times New Roman", size: 24 }), new TextRun({ text: v.position || "____________", bold: true, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ children: [new TextRun({ text: "с окладом ", font: "Times New Roman", size: 24 }), new TextRun({ text: v.salary ? formatMoney(Number(v.salary)) : "____________", bold: true, font: "Times New Roman", size: 24 }), new TextRun({ text: " рублей в месяц", font: "Times New Roman", size: 24 })] }),
          new Paragraph({ children: [new TextRun({ text: "с ", font: "Times New Roman", size: 24 }), new TextRun({ text: formatDate(v.startDate), bold: true, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun({ text: "Директор _________________ / ____________ /", font: "Times New Roman", size: 24 })] }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun({ text: "С приказом ознакомлен(а):", font: "Times New Roman", size: 24 })] }),
          new Paragraph({ children: [new TextRun({ text: `_________________ / ${v.employeeName || "____________"} /`, font: "Times New Roman", size: 24 })] }),
        ],
      }],
    });
  } else if (templateId === "vacation") {
    const days = calcVacationDays(v.startDate, v.endDate);
    doc = new Document({
      sections: [{
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ООО «Ромашка»", bold: true, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `ПРИКАЗ № ${v.orderNumber || "—"}`, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `от ${formatDate(v.orderDate)}`, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ text: "" }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "О ПРЕДОСТАВЛЕНИИ ОТПУСКА", bold: true, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun({ text: "ПРЕДОСТАВИТЬ ", bold: true, font: "Times New Roman", size: 24 }), new TextRun({ text: `отпуск ${v.employeeName || "____________"}`, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ children: [new TextRun({ text: "на должности ", font: "Times New Roman", size: 24 }), new TextRun({ text: v.position || "____________", bold: true, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ children: [new TextRun({ text: "ежегодный основной оплачиваемый отпуск", font: "Times New Roman", size: 24 })] }),
          new Paragraph({ children: [new TextRun({ text: "с ", font: "Times New Roman", size: 24 }), new TextRun({ text: formatDate(v.startDate), bold: true, font: "Times New Roman", size: 24 }), new TextRun({ text: " по ", font: "Times New Roman", size: 24 }), new TextRun({ text: formatDate(v.endDate), bold: true, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ children: [new TextRun({ text: "на ", font: "Times New Roman", size: 24 }), new TextRun({ text: `${days} календарных дней`, bold: true, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun({ text: "Директор _________________ / ____________ /", font: "Times New Roman", size: 24 })] }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun({ text: "С приказом ознакомлен(а):", font: "Times New Roman", size: 24 })] }),
          new Paragraph({ children: [new TextRun({ text: `_________________ / ${v.employeeName || "____________"} /`, font: "Times New Roman", size: 24 })] }),
        ],
      }],
    });
  } else {
    // Журнал
    const table = new Table({
      width: { size: 100, type: "pct" },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "№", bold: true, font: "Times New Roman", size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Дата", bold: true, font: "Times New Roman", size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ФИО", bold: true, font: "Times New Roman", size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Должность", bold: true, font: "Times New Roman", size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Инструкция", bold: true, font: "Times New Roman", size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Подпись", bold: true, font: "Times New Roman", size: 20 })] })] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "1", font: "Times New Roman", size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: formatDate(v.instructionDate), font: "Times New Roman", size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.employeeName || "—", font: "Times New Roman", size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.position || "—", font: "Times New Roman", size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v.instructionNumber || "—", font: "Times New Roman", size: 20 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "_________", font: "Times New Roman", size: 20 })] })] }),
          ],
        }),
        ...[2, 3].map((num) => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(num), font: "Times New Roman", size: 20 })] })] }),
            new TableCell({ children: [new Paragraph("")] }),
            new TableCell({ children: [new Paragraph("")] }),
            new TableCell({ children: [new Paragraph("")] }),
            new TableCell({ children: [new Paragraph("")] }),
            new TableCell({ children: [new Paragraph("")] }),
          ],
        })),
      ],
    });

    doc = new Document({
      sections: [{
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "ЖУРНАЛ РЕГИСТРАЦИИ ВВОДНОГО ИНСТРУКТАЖА", bold: true, font: "Times New Roman", size: 24 })] }),
          new Paragraph({ text: "" }),
          table,
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun({ text: "Инструктаж провёл: _________________ / ____________ /", font: "Times New Roman", size: 24 })] }),
        ],
      }],
    });
  }

  return await Packer.toBlob(doc);
}

// Функция для запуска скачивания
async function downloadWordDocument(templateId: string, values: Record<string, string>, filename: string) {
  try {
    const blob = await generateDocxBlob(templateId, values);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    alert("Ошибка генерации файла.");
  }
}

// ─── Типы шаблонов ─────────────────────────────────
type FieldType = "text" | "date" | "number" | "employee_select";

type TemplateField = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  defaultValue?: string;
};

type Template = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: React.ElementType;
  color: string;
  category: string;
  fields: TemplateField[];
  render: (values: Record<string, string>) => string;
};

// ВНИМАНИЕ: Здесь мы оставляем HTML для ПРЕВЬЮ. Он 1 в 1 совпадает с DOCX.
const TEMPLATES: Template[] = [
  {
    id: "hire",
    title: "Приказ о приёме на работу",
    shortTitle: "Приём",
    description: "Форма №Т-1 · выберите сотрудника — должность подтянется",
    icon: FileCheck2,
    color: "#3b82f6",
    category: "Приказы",
    fields: [
      { key: "orderNumber", label: "Номер приказа", type: "text", defaultValue: "42" },
      { key: "orderDate", label: "Дата приказа", type: "date", defaultValue: "2026-10-22" },
      { key: "employeeName", label: "Сотрудник", type: "employee_select" },
      { key: "position", label: "Должность", type: "text", placeholder: "Заполнится при выборе" },
      { key: "salary", label: "Оклад, ₽", type: "number", placeholder: "45000" },
      { key: "startDate", label: "Дата начала работы", type: "date", defaultValue: "2026-10-23" },
    ],
    render: (v) => `
      <p style="text-align: center; margin: 0 0 5px 0; font-weight: bold; font-size: 14px;">ООО «Ромашка»</p>
      <p style="text-align: center; margin: 0 0 5px 0; font-size: 14px;">ПРИКАЗ № ${v.orderNumber || "—"}</p>
      <p style="text-align: center; margin: 0 0 25px 0; font-size: 14px;">от ${formatDate(v.orderDate)}</p>
      <p style="text-align: center; margin: 20px 0; font-weight: bold; font-size: 14px;">О ПРИЁМЕ НА РАБОТУ</p>
      <p style="margin: 10px 0; font-size: 14px;"><b>ПРИНЯТЬ</b> на работу ${v.employeeName || "____________"}</p>
      <p style="margin: 10px 0; font-size: 14px;">на должность <b>${v.position || "____________"}</b></p>
      <p style="margin: 10px 0; font-size: 14px;">с окладом <b>${v.salary ? formatMoney(Number(v.salary)) : "____________"}</b> рублей в месяц</p>
      <p style="margin: 10px 0; font-size: 14px;">с <b>${formatDate(v.startDate)}</b></p>
      <p style="margin-top: 50px; font-size: 14px;">Директор _________________ / ____________ /</p>
      <p style="margin-top: 20px; font-size: 14px;">С приказом ознакомлен(а):</p>
      <p style="font-size: 14px;">_________________ / ${v.employeeName || "____________"} /</p>
    `,
  },
  {
    id: "vacation",
    title: "Приказ на отпуск",
    shortTitle: "Отпуск",
    description: "Форма №Т-6 · ежегодный оплачиваемый",
    icon: FileText,
    color: "#10b981",
    category: "Приказы",
    fields: [
      { key: "orderNumber", label: "Номер приказа", type: "text", defaultValue: "43" },
      { key: "orderDate", label: "Дата приказа", type: "date", defaultValue: "2026-10-22" },
      { key: "employeeName", label: "Сотрудник", type: "employee_select" },
      { key: "position", label: "Должность", type: "text", placeholder: "Заполнится при выборе" },
      { key: "startDate", label: "Отпуск с", type: "date", defaultValue: "2026-11-01" },
      { key: "endDate", label: "Отпуск по", type: "date", defaultValue: "2026-11-14" },
    ],
    render: (v) => {
      const days = calcVacationDays(v.startDate, v.endDate);
      return `
        <p style="text-align: center; margin: 0 0 5px 0; font-weight: bold; font-size: 14px;">ООО «Ромашка»</p>
        <p style="text-align: center; margin: 0 0 5px 0; font-size: 14px;">ПРИКАЗ № ${v.orderNumber || "—"}</p>
        <p style="text-align: center; margin: 0 0 25px 0; font-size: 14px;">от ${formatDate(v.orderDate)}</p>
        <p style="text-align: center; margin: 20px 0; font-weight: bold; font-size: 14px;">О ПРЕДОСТАВЛЕНИИ ОТПУСКА</p>
        <p style="margin: 10px 0; font-size: 14px;"><b>ПРЕДОСТАВИТЬ</b> отпуск ${v.employeeName || "____________"}</p>
        <p style="margin: 10px 0; font-size: 14px;">на должности <b>${v.position || "____________"}</b></p>
        <p style="margin: 10px 0; font-size: 14px;">ежегодный основной оплачиваемый отпуск</p>
        <p style="margin: 10px 0; font-size: 14px;">с <b>${formatDate(v.startDate)}</b> по <b>${formatDate(v.endDate)}</b></p>
        <p style="margin: 10px 0; font-size: 14px;">на <b>${days} календарных дней</b></p>
        <p style="margin-top: 50px; font-size: 14px;">Директор _________________ / ____________ /</p>
        <p style="margin-top: 20px; font-size: 14px;">С приказом ознакомлен(а):</p>
        <p style="font-size: 14px;">_________________ / ${v.employeeName || "____________"} /</p>
      `;
    },
  },
  {
    id: "journal",
    title: "Журнал инструктажа",
    shortTitle: "Инструктаж",
    description: "Вводный инструктаж · заполняется из карточки",
    icon: ScrollText,
    color: "#8b5cf6",
    category: "Журналы",
    fields: [
      { key: "employeeName", label: "Сотрудник", type: "employee_select" },
      { key: "position", label: "Должность", type: "text", placeholder: "Заполнится при выборе" },
      { key: "instructionDate", label: "Дата инструктажа", type: "date", defaultValue: "2026-10-22" },
      { key: "instructionNumber", label: "Номер инструкции", type: "text", defaultValue: "ИОТ-001" },
    ],
    render: (v) => `
      <p style="text-align: center; margin: 0 0 20px 0; font-weight: bold; font-size: 14px;">ЖУРНАЛ РЕГИСТРАЦИИ ВВОДНОГО ИНСТРУКТАЖА</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <tr>
          <th style="border: 1px solid #000; padding: 6px; text-align: center;">№</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center;">Дата</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center;">ФИО</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center;">Должность</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center;">Инструкция</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center;">Подпись</th>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">1</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">${formatDate(v.instructionDate)}</td>
          <td style="border: 1px solid #000; padding: 6px;">${v.employeeName || "—"}</td>
          <td style="border: 1px solid #000; padding: 6px;">${v.position || "—"}</td>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">${v.instructionNumber || "—"}</td>
          <td style="border: 1px solid #000; padding: 6px;">_________</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000; padding: 6px; text-align: center;">2</td>
          <td style="border: 1px solid #000; padding: 6px;"></td>
          <td style="border: 1px solid #000; padding: 6px;"></td>
          <td style="border: 1px solid #000; padding: 6px;"></td>
          <td style="border: 1px solid #000; padding: 6px;"></td>
          <td style="border: 1px solid #000; padding: 6px;"></td>
        </tr>
      </table>
      <p style="margin-top: 30px; font-size: 14px;">Инструктаж провёл: _________________ / ____________ /</p>
    `,
  },
];

// ─── Утилиты ───────────────────────────────────────
const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function formatDate(iso: string): string {
  if (!iso) return "____________";
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return "____________";
  return `${d.getUTCDate()} ${MONTHS_RU[d.getUTCMonth()]} ${d.getUTCFullYear()} г.`;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

function calcVacationDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start + "T00:00:00Z").getTime();
  const e = new Date(end + "T00:00:00Z").getTime();
  if (isNaN(s) || isNaN(e)) return 0;
  return Math.max(0, Math.round((e - s) / 86400000) + 1);
}

// ─── Компонент ─────────────────────────────────────
type Props = {
  onInteract?: () => void;
};

export default function DocumentsDemo({ onInteract }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [downloading, setDownloading] = useState(false);

  const interact = () => onInteract?.();

  const selected = TEMPLATES.find((t) => t.id === selectedId) ?? null;

  const openTemplate = (t: Template) => {
    setSelectedId(t.id);
    const initial: Record<string, string> = {};
    for (const f of t.fields) {
      initial[f.key] = f.defaultValue ?? "";
    }
    setValues(initial);
    interact();
  };

  const closeForm = () => {
    setSelectedId(null);
    setValues({});
  };

  const generate = () => {
    if (!selected) return;
    const html = selected.render(values);
    setPreview(html);
    setPreviewTitle(selected.title);
    interact();
  };

  const closePreview = () => {
    setPreview(null);
    setPreviewTitle("");
  };

  const handleDownload = async () => {
    if (!selected) return;
    setDownloading(true);
    await downloadWordDocument(selected.id, values, selected.title);
    setDownloading(false);
    interact();
  };

  const onEmployeeSelect = (fieldKey: string, employeeName: string) => {
    const emp = DEMO_EMPLOYEES.find((e) => e.name === employeeName);
    setValues((v) => {
      const next = { ...v, [fieldKey]: employeeName };
      if (emp) {
        if (selected?.fields.some((f) => f.key === "employeeName")) {
          next.employeeName = emp.name;
        }
        if (selected?.fields.some((f) => f.key === "position")) {
          next.position = emp.position;
        }
      }
      return next;
    });
  };

  // ─── Режим «превью документа» ────────────────────
  if (preview && selected) {
    return (
      <div className="bg-white rounded-xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <button
            onClick={closePreview}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            К шаблонам
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium transition-colors shadow-sm"
            >
              {downloading ? (
                <span className="animate-pulse">Генерация...</span>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Скачать DOCX
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-slate-100 rounded-xl p-4 sm:p-8 overflow-x-auto">
          <div
            className="bg-white mx-auto shadow-lg rounded-sm"
            style={{
              width: "100%",
              maxWidth: "680px",
              minHeight: "800px",
              padding: "56px 64px",
              fontFamily: "'Times New Roman', serif",
              color: "#000000",
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: preview }} />
          </div>
        </div>

        <div className="mt-4 text-xs text-center text-slate-500">
          📄 Превью документа «{previewTitle}» · при скачивании откроется в Word
        </div>
      </div>
    );
  }

  // ─── Режим «форма» ───────────────────────────────
  if (selected) {
    const Icon = selected.icon;
    return (
      <div className="bg-white rounded-xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <button
            onClick={closeForm}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            К шаблонам
          </button>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium ring-1 ring-slate-200">
            {selected.category}
          </span>
        </div>

        <div className="flex items-start gap-3 mb-5">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: selected.color + "20", color: selected.color }}
          >
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-lg">
              {selected.title}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {selected.description}
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          {selected.fields.map((f) => {
            const isPositionAutoFilled = f.key === "position" && !!values.employeeName;

            return (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {f.label}
                </label>

                {f.type === "employee_select" ? (
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select
                      value={values[f.key] ?? ""}
                      onChange={(e) => onEmployeeSelect(f.key, e.target.value)}
                      className="!text-sm !pl-9"
                    >
                      <option value="">— Выберите сотрудника —</option>
                      {DEMO_EMPLOYEES.map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name} — {emp.position}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <input
                    type={f.type}
                    value={values[f.key] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                    className="!text-sm"
                  />
                )}

                {isPositionAutoFilled && (
                  <div className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" />
                    Заполнено из карточки
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <button
            onClick={closeForm}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={generate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 text-sm font-medium transition-colors shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            Сгенерировать документ
          </button>
        </div>
      </div>
    );
  }

  // ─── Режим «каталог шаблонов» ────────────────────
  return (
    <div className="bg-white rounded-xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-600" />
            Документы по ТК
          </div>
          <div className="text-sm text-slate-500 mt-1">
            Выберите шаблон → сотрудника → скачайте DOCX
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 font-medium">
          <Check className="w-3.5 h-3.5" />
          {TEMPLATES.length} шаблона
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TEMPLATES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => openTemplate(t)}
              className="group text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-brand-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: t.color + "20", color: t.color }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 text-sm leading-tight">
                    {t.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {t.description}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-brand-600 group-hover:text-brand-700 pt-2 border-t border-slate-100">
                <Sparkles className="w-3.5 h-3.5" />
                Заполнить
                <ChevronRight className="w-3.5 h-3.5 ml-auto" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 bg-gradient-to-br from-violet-50 to-brand-50 rounded-xl border border-violet-200 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
          <Package className="w-5 h-5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900 text-sm">
            Свой шаблон .docx
          </div>
          <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">
            Загрузите свой DOCX с плейсхолдерами{" "}
            <code className="px-1 py-0.5 bg-white rounded text-brand-600 font-mono text-[10px]">
              {"{ФИО}"}
            </code>{" "}
            — данные подставятся автоматически.
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 text-xs sm:text-sm text-slate-500 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="hidden sm:inline">
            💡 Выберите шаблон, сотрудника — должность подтянется сама
          </span>
          <span className="sm:hidden">💡 Нажмите на шаблон</span>
        </div>
      </div>
    </div>
  );
}