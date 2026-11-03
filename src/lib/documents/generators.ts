import HTMLtoDOCX from "html-to-docx";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  PageOrientation,
} from "docx";
import { getDocumentType } from "./templates.js";

// ─── Утилиты ────────────────────────────────────────
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTHS_GEN[d.getUTCMonth()]} ${d.getUTCFullYear()} г.`;
}

function p(
  text: string,
  opts: {
    bold?: boolean;
    align?: any;
    size?: number;
    spacing?: number;
    italic?: boolean;
  } = {}
) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.spacing ?? 200 },
    children: [
      new TextRun({
        text: text || " ",
        bold: opts.bold,
        italics: opts.italic,
        size: opts.size ?? 24,
      }),
    ],
  });
}

/**
 * Аналог p(), но подсвечивает все {плейсхолдеры} жёлтой заливкой.
 */
function pYellow(
  text: string,
  opts: {
    bold?: boolean;
    align?: any;
    size?: number;
    spacing?: number;
  } = {}
) {
  const regex = /(\{[^{}]+\})/g;
  const parts = text.split(regex).filter((part) => part.length > 0);

  const runs = parts.map((part) => {
    const isPlaceholder = /^\{[^{}]+\}$/.test(part);
    return new TextRun({
      text: part,
      bold: opts.bold,
      size: opts.size ?? 24,
      highlight: isPlaceholder ? "yellow" : undefined,
    });
  });

  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.spacing ?? 200 },
    children: runs.length > 0 ? runs : [new TextRun({ text: " " })],
  });
}
// Оранжевый цвет для плейсхолдеров (amber-500)
const PLACEHOLDER_COLOR = "F59E0B";

/**
 * Аналог p(), но автоматически выделяет все {плейсхолдеры}
 * оранжевым полужирным цветом.
 */
function pWithHighlight(
  text: string,
  opts: {
    bold?: boolean;
    align?: any;
    size?: number;
    spacing?: number;
    italic?: boolean;
  } = {}
) {
  // Разбиваем текст на сегменты: {ключ} и остальное
  const regex = /(\{[^{}]+\})/g;
  const parts = text.split(regex).filter((part) => part.length > 0);

  const runs = parts.map((part) => {
    const isPlaceholder = /^\{[^{}]+\}$/.test(part);
    return new TextRun({
      text: part,
      bold: isPlaceholder ? true : opts.bold,
      italics: opts.italic,
      size: opts.size ?? 24,
      color: isPlaceholder ? PLACEHOLDER_COLOR : undefined,
    });
  });

  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.spacing ?? 200 },
    children: runs.length > 0 ? runs : [new TextRun({ text: " " })],
  });
}

function blank(count = 1) {
  return Array.from({ length: count }, () => p(" "));
}

function lines(text: string | undefined | null): string[] {
  if (!text) return [];
  return String(text)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Общие блоки ────────────────────────────────────
function header(
  orgName: string,
  city: string,
  docNumber: string,
  docType: string,
  date: string,
  title: string
): Paragraph[] {
  return [
    p(orgName, { bold: true, align: AlignmentType.CENTER }),
    p(`${docType} № ${docNumber}`, {
      bold: true,
      align: AlignmentType.CENTER,
      spacing: 100,
    }),
    p(city, { align: AlignmentType.CENTER, spacing: 100 }),
    p(`от ${date}`, { align: AlignmentType.CENTER, spacing: 400 }),
    p(title, { bold: true, align: AlignmentType.CENTER, spacing: 400 }),
  ];
}

function footer(directorName: string, extra?: string[]): Paragraph[] {
  const out: Paragraph[] = [];
  out.push(...blank(1));
  out.push(
    p(`Директор: _________________________ / ${directorName} /`, {
      align: AlignmentType.LEFT,
    })
  );
  if (extra) {
    for (const line of extra) {
      out.push(p(line, { align: AlignmentType.LEFT, spacing: 100 }));
    }
  }
  return out;
}

// ─── Таблица ────────────────────────────────────────
function makeTable(headers: string[], rows: string[][]): Table {
  const border = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: "999999",
  };
  const allBorders = { top: border, bottom: border, left: border, right: border };

  const safeRows = rows.length > 0 ? rows : [headers.map(() => "")];

  const normalizedRows = safeRows.map((r) => {
    const out = [...r];
    while (out.length < headers.length) out.push("");
    return out.slice(0, headers.length);
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map(
          (h) =>
            new TableCell({
              borders: allBorders,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: h || " ", bold: true, size: 20 }),
                  ],
                }),
              ],
            })
        ),
      }),
      ...normalizedRows.map(
        (r) =>
          new TableRow({
            children: r.map(
              (c) =>
                new TableCell({
                  borders: allBorders,
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: c || " ", size: 20 })],
                    }),
                  ],
                })
            ),
          })
      ),
    ],
  });
}

// ═══════════════════════════════════════════════════════
// 1. ПРИКАЗ О НАЗНАЧЕНИИ ОТВЕТСТВЕННОГО ЗА ОХРАНУ ТРУДА
// ═══════════════════════════════════════════════════════
function generateSafetyOrder(params: any): Document {
  const date = formatDate(params.orderDate);
  return new Document({
    sections: [
      {
        children: [
          ...header(
            params.orgName,
            params.city,
            params.orderNumber,
            "ПРИКАЗ",
            date,
            "О назначении ответственного за охрану труда"
          ),
          p(
            `В соответствии со статьёй 217 Трудового кодекса Российской Федерации, в целях обеспечения соблюдения требований охраны труда, ПРИКАЗЫВАЮ:`,
            { align: AlignmentType.JUSTIFIED, spacing: 300 }
          ),
          p(
            `1. Назначить ${params.responsiblePosition} ${params.responsibleName} ответственным за организацию и соблюдение требований охраны труда в организации.`,
            { align: AlignmentType.JUSTIFIED }
          ),
          p(
            `2. Утвердить должностную инструкцию ответственного за охрану труда.`,
            { align: AlignmentType.JUSTIFIED }
          ),
          p(
            `3. Контроль за исполнением настоящего приказа оставляю за собой.`,
            { align: AlignmentType.JUSTIFIED, spacing: 400 }
          ),
          ...footer(params.directorName, [
            `С приказом ознакомлен(а): _________________________ / ${params.responsibleName} /`,
          ]),
        ],
      },
    ],
  });
}

// ═══════════════════════════════════════════════════════
// 2. ПРИКАЗ О ПОЖАРНОЙ БЕЗОПАСНОСТИ
// ═══════════════════════════════════════════════════════
function generateFireOrder(params: any): Document {
  const date = formatDate(params.orderDate);
  return new Document({
    sections: [
      {
        children: [
          ...header(
            params.orgName,
            params.city,
            params.orderNumber,
            "ПРИКАЗ",
            date,
            "О назначении ответственного за пожарную безопасность"
          ),
          p(
            `В соответствии с Федеральным законом от 21.12.1994 № 69-ФЗ «О пожарной безопасности», Правилами противопожарного режима в Российской Федерации, ПРИКАЗЫВАЮ:`,
            { align: AlignmentType.JUSTIFIED, spacing: 300 }
          ),
          p(
            `1. Назначить ${params.responsiblePosition} ${params.responsibleName} ответственным за пожарную безопасность в организации.`,
            { align: AlignmentType.JUSTIFIED }
          ),
          p(
            `2. Возложить на ответственного проведение противопожарных инструктажей с сотрудниками.`,
            { align: AlignmentType.JUSTIFIED }
          ),
          p(
            `3. Контроль за исполнением настоящего приказа оставляю за собой.`,
            { align: AlignmentType.JUSTIFIED, spacing: 400 }
          ),
          ...footer(params.directorName, [
            `С приказом ознакомлен(а): _________________________ / ${params.responsibleName} /`,
          ]),
        ],
      },
    ],
  });
}

// ═══════════════════════════════════════════════════════
// 4. ПРИКАЗ О ПРИЁМЕ НА РАБОТУ
// ═══════════════════════════════════════════════════════
function generateHireOrder(params: any): Document {
  const date = formatDate(params.orderDate);
  const start = formatDate(params.startDate);
  return new Document({
    sections: [
      {
        children: [
          ...header(
            params.orgName,
            params.city,
            params.orderNumber,
            "ПРИКАЗ",
            date,
            "О приёме на работу"
          ),
          p(
            `ПРИНЯТЬ на работу ${params.employeeName} на должность ${params.position} с окладом ${params.salary} рублей в месяц.`,
            { align: AlignmentType.JUSTIFIED, spacing: 300 }
          ),
          p(`Дата начала работы: ${start}.`, {
            align: AlignmentType.JUSTIFIED,
            spacing: 300,
          }),
          p(`Основание: трудовой договор от ${date}.`, {
            align: AlignmentType.JUSTIFIED,
            spacing: 400,
          }),
          ...footer(params.directorName, [
            `С приказом ознакомлен(а): _________________________ / ${params.employeeName} /`,
          ]),
        ],
      },
    ],
  });
}

// ═══════════════════════════════════════════════════════
// 5. ГРАФИК ОТПУСКОВ (ТАБЛИЦА)
// ═══════════════════════════════════════════════════════
function generateVacationScheduleTable(params: any): Document {
  const date = formatDate(params.approveDate);
  const vacations: any[] = params.__vacations ?? [];

  const rows: string[][] = vacations.map((v, i) => {
    const start = new Date(v.startDate + "T00:00:00Z");
    const end = new Date(v.endDate + "T00:00:00Z");
    const days =
      Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    return [
      String(i + 1),
      v.userName ?? "—",
      String(days),
      formatDate(v.startDate),
    ];
  });

  const children: Paragraph[] = [
    // ─── Шапка приказа ───
    p(params.orgName, { bold: true, align: AlignmentType.CENTER }),
    p(`ПРИКАЗ № ${params.orderNumber}`, {
      bold: true,
      align: AlignmentType.CENTER,
      spacing: 100,
    }),
    p(params.city, { align: AlignmentType.CENTER, spacing: 100 }),
    p(`от ${date}`, { align: AlignmentType.CENTER, spacing: 300 }),
    p(`Об утверждении графика отпусков на ${params.year} год`, {
      bold: true,
      align: AlignmentType.CENTER,
      spacing: 400,
    }),

    // ─── Текст приказа ───
    p(
      "В соответствии со статьёй 123 Трудового кодекса Российской Федерации ПРИКАЗЫВАЮ:",
      { align: AlignmentType.JUSTIFIED, spacing: 200 }
    ),
    p(`1. Утвердить график отпусков сотрудников на ${params.year} год (приложение 1).`, {
      align: AlignmentType.JUSTIFIED,
      spacing: 100,
    }),
    p("2. Ознакомить всех сотрудников с графиком отпусков под подпись.", {
      align: AlignmentType.JUSTIFIED,
      spacing: 100,
    }),
    p("3. Контроль за исполнением настоящего приказа оставляю за собой.", {
      align: AlignmentType.JUSTIFIED,
      spacing: 300,
    }),
    p(`Директор: _________________ / ${params.directorName} /`, {
      align: AlignmentType.LEFT,
      spacing: 400,
    }),

    // ─── Таблица ───
    p(`Приложение 1. ГРАФИК ОТПУСКОВ на ${params.year} год`, {
      bold: true,
      align: AlignmentType.CENTER,
      spacing: 400,
    }),
    makeTable(
      ["№", "ФИО сотрудника", "Кол-во дней", "Дата начала отпуска"],
      rows
    ),
    blank(1),
    p(`Директор: _________________ / ${params.directorName} /`, {
      align: AlignmentType.LEFT,
      spacing: 200,
    }),
  ];

  if (vacations.length === 0) {
    children.push(
      blank(1),
      p(
        "В разделе «Отпуска» нет данных за указанный год. Добавьте отпуска сотрудникам — они появятся здесь.",
        { align: AlignmentType.LEFT, italic: true, size: 20 }
      )
    );
  }

  return new Document({ sections: [{ children }] });
}

// ═══════════════════════════════════════════════════════
// 6. ИНСТРУКЦИЯ ПО ОХРАНЕ ТРУДА
// ═══════════════════════════════════════════════════════
function generateSafetyInstruction(params: any): Document {
  const date = formatDate(params.approveDate);
  const hazards = lines(params.hazards);
  const requirements = lines(params.requirements);

  const children: Paragraph[] = [
    p(params.orgName, { bold: true, align: AlignmentType.CENTER }),
    p("УТВЕРЖДАЮ", { align: AlignmentType.RIGHT, spacing: 100 }),
    p(`Директор: ___________ / ${params.directorName} /`, {
      align: AlignmentType.RIGHT,
      spacing: 100,
    }),
    p(`от ${date}`, { align: AlignmentType.RIGHT, spacing: 400 }),
    p(
      `ИНСТРУКЦИЯ № ${params.instructionNumber} по охране труда для должности «${params.position}»`,
      { bold: true, align: AlignmentType.CENTER, spacing: 400 }
    ),

    p("1. ОБЩИЕ ТРЕБОВАНИЯ ОХРАНЫ ТРУДА", { bold: true, spacing: 200 }),
    p(
      `К работе в должности ${params.position} допускаются лица, прошедшие вводный и первичный инструктаж по охране труда, ознакомленные с настоящей инструкцией.`,
      { align: AlignmentType.JUSTIFIED }
    ),

    p("2. ОСНОВНЫЕ ОПАСНЫЕ И ВРЕДНЫЕ ФАКТОРЫ", {
      bold: true,
      spacing: 200,
    }),
    ...hazards.map((h) =>
      p(`— ${h}`, { align: AlignmentType.JUSTIFIED, spacing: 100 })
    ),

    p("3. ТРЕБОВАНИЯ ПЕРЕД НАЧАЛОМ РАБОТЫ", { bold: true, spacing: 200 }),
    ...requirements.map((r) =>
      p(`— ${r}`, { align: AlignmentType.JUSTIFIED, spacing: 100 })
    ),

    p("4. ТРЕБОВАНИЯ ВО ВРЕМЯ РАБОТЫ", { bold: true, spacing: 200 }),
    p(
      `Выполнять только ту работу, которая поручена непосредственным руководителем. Не допускать посторонних лиц на рабочее место.`,
      { align: AlignmentType.JUSTIFIED }
    ),

    p("5. ТРЕБОВАНИЯ ПО ОКОНЧАНИИ РАБОТЫ", { bold: true, spacing: 200 }),
    p(
      `Привести в порядок рабочее место, выключить оборудование, снять спецодежду, сообщить руководителю о любых замечаниях.`,
      { align: AlignmentType.JUSTIFIED, spacing: 400 }
    ),
  ];

  return new Document({ sections: [{ children }] });
}

// ═══════════════════════════════════════════════════════
// 7. ЖУРНАЛ РЕГИСТРАЦИИ ИНСТРУКТАЖЕЙ
// ═══════════════════════════════════════════════════════
function generateBriefingJournal(params: any): Document {
  const employees: any[] = params.__employees ?? [];

  const rows = employees.map((e) => [
    e.name ?? "—",
    e.position ?? "—",
    "__________",
    "вводный",
    "__________",
    "__________",
  ]);

  return new Document({
    sections: [
      {
        children: [
          p(params.orgName, { bold: true, align: AlignmentType.CENTER }),
          p("ЖУРНАЛ РЕГИСТРАЦИИ ИНСТРУКТАЖЕЙ ПО ОХРАНЕ ТРУДА", {
            bold: true,
            align: AlignmentType.CENTER,
            spacing: 200,
          }),
          p(`на ${params.year} год`, {
            align: AlignmentType.CENTER,
            spacing: 400,
          }),
          p(
            `Ответственный за проведение инструктажа: ${params.responsible}`,
            { spacing: 300 }
          ),
          blank(1),
          makeTable(
            [
              "ФИО",
              "Должность",
              "Дата",
              "Вид",
              "Подпись инструктируемого",
              "Подпись инструктирующего",
            ],
            rows
          ),
        ],
      },
    ],
  });
}

// ═══════════════════════════════════════════════════════
// 8. ТРУДОВОЙ ДОГОВОР
// ═══════════════════════════════════════════════════════
function generateEmploymentContract(params: any): Document {
  const date = formatDate(params.contractDate);
  const start = formatDate(params.startDate);
  const probation =
    params.probation && Number(params.probation) > 0
      ? `с испытательным сроком ${params.probation} мес.`
      : "без испытательного срока";

  return new Document({
    sections: [
      {
        children: [
          p(`ТРУДОВОЙ ДОГОВОР № ${params.contractNumber}`, {
            bold: true,
            align: AlignmentType.CENTER,
            spacing: 200,
          }),
          p(params.city, { align: AlignmentType.CENTER, spacing: 100 }),
          p(`от ${date}`, { align: AlignmentType.CENTER, spacing: 400 }),

          p(
            `${params.orgName} (ИНН ${params.orgInn}), в лице директора ${params.directorName}, действующего на основании Устава, именуемое в дальнейшем «Работодатель», с одной стороны, и ${params.employeeName}, паспорт ${params.employeePassport}, зарегистрированный по адресу ${params.employeeAddress}, именуемый в дальнейшем «Работник», с другой стороны, заключили настоящий договор о нижеследующем:`,
            { align: AlignmentType.JUSTIFIED, spacing: 300 }
          ),

          p("1. ПРЕДМЕТ ДОГОВОРА", { bold: true, spacing: 200 }),
          p(
            `1.1. Работодатель принимает Работника на должность ${params.position} ${probation}.`,
            { align: AlignmentType.JUSTIFIED }
          ),
          p(`1.2. Дата начала работы: ${start}.`, {
            align: AlignmentType.JUSTIFIED,
          }),

          p("2. ОПЛАТА ТРУДА", { bold: true, spacing: 200 }),
          p(
            `2.1. Работнику устанавливается оклад в размере ${params.salary} рублей в месяц.`,
            { align: AlignmentType.JUSTIFIED }
          ),
          p(
            `2.2. Выплата заработной платы производится два раза в месяц в порядке, установленном Правилами внутреннего трудового распорядка.`,
            { align: AlignmentType.JUSTIFIED }
          ),

          p("3. РЕЖИМ РАБОТЫ И ОТДЫХА", { bold: true, spacing: 200 }),
          p(
            `3.1. Работнику устанавливается 40-часовая рабочая неделя с выходными днями согласно графику сменности.`,
            { align: AlignmentType.JUSTIFIED }
          ),

          p("4. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ", { bold: true, spacing: 200 }),
          p(
            `4.1. Договор составлен в двух экземплярах — по одному для каждой стороны.`,
            { align: AlignmentType.JUSTIFIED, spacing: 400 }
          ),

          p("РЕКВИЗИТЫ И ПОДПИСИ СТОРОН", { bold: true, spacing: 300 }),

          p("РАБОТОДАТЕЛЬ", { bold: true, spacing: 100 }),
          p(`Организация: ${params.orgName}`, { spacing: 100 }),
          p(`ИНН: ${params.orgInn ?? "—"}`, { spacing: 100 }),
          p(`Адрес: ${params.orgAddress}`, { spacing: 100 }),
          p(`Директор: ______________ / ${params.directorName} /`, {
            spacing: 300,
          }),

          p("РАБОТНИК", { bold: true, spacing: 100 }),
          p(`ФИО: ${params.employeeName}`, { spacing: 100 }),
          p(`Паспорт: ${params.employeePassport ?? "—"}`, { spacing: 100 }),
          p(`Адрес: ${params.employeeAddress ?? "—"}`, { spacing: 100 }),
          p(`Подпись: ______________`, { spacing: 200 }),
        ],
      },
    ],
  });
}

// ═══════════════════════════════════════════════════════
// 9. СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ
// ═══════════════════════════════════════════════════════
function generatePersonalDataConsent(params: any): Document {
  const date = formatDate(params.consentDate);
  return new Document({
    sections: [
      {
        children: [
          p("СОГЛАСИЕ", {
            bold: true,
            align: AlignmentType.CENTER,
            spacing: 100,
          }),
          p("на обработку персональных данных", {
            bold: true,
            align: AlignmentType.CENTER,
            spacing: 200,
          }),
          p(params.orgName, {
            align: AlignmentType.CENTER,
            spacing: 100,
          }),
          p(date, { align: AlignmentType.CENTER, spacing: 400 }),

          p(
            `Я, ${params.personName}, паспорт ${params.personPassport}, зарегистрированный по адресу ${params.personAddress}, в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных» даю своё согласие ${params.orgName}, расположенному по адресу ${params.orgAddress}, на обработку моих персональных данных.`,
            { align: AlignmentType.JUSTIFIED, spacing: 300 }
          ),

          p(
            `Согласие даётся на обработку следующих персональных данных: фамилия, имя, отчество; дата рождения; паспортные данные; адрес регистрации; контактный телефон; адрес электронной почты; сведения об образовании и трудовой деятельности.`,
            { align: AlignmentType.JUSTIFIED }
          ),

          p(
            `Цель обработки: трудовые отношения, ведение кадрового учёта, исполнение требований законодательства РФ.`,
            { align: AlignmentType.JUSTIFIED }
          ),

          p(
            `Согласие действует в течение всего срока трудовых отношений и может быть отозвано мной в письменной форме.`,
            { align: AlignmentType.JUSTIFIED, spacing: 400 }
          ),

          p(`Подпись: ______________ / ${params.personName} /`, {
            spacing: 200,
          }),
          p(`Дата: ${date}`),
        ],
      },
    ],
  });
}

// ═══════════════════════════════════════════════════════
// 10. ПРАВИЛА ВНУТРЕННЕГО ТРУДОВОГО РАСПОРЯДКА
// ═══════════════════════════════════════════════════════
function generateInternalRules(params: any): Document {
  const date = formatDate(params.approveDate);
  return new Document({
    sections: [
      {
        children: [
          p(params.orgName, { bold: true, align: AlignmentType.CENTER }),
          p("УТВЕРЖДАЮ", { align: AlignmentType.RIGHT, spacing: 100 }),
          p(`Директор: ___________ / ${params.directorName} /`, {
            align: AlignmentType.RIGHT,
            spacing: 100,
          }),
          p(`от ${date}`, { align: AlignmentType.RIGHT, spacing: 400 }),

          p("ПРАВИЛА ВНУТРЕННЕГО ТРУДОВОГО РАСПОРЯДКА", {
            bold: true,
            align: AlignmentType.CENTER,
            spacing: 400,
          }),

          p("1. ОБЩИЕ ПОЛОЖЕНИЯ", { bold: true, spacing: 200 }),
          p(
            `Настоящие Правила регулируют трудовые отношения между работниками и ${params.orgName}, режим работы, порядок оплаты труда и дисциплину.`,
            { align: AlignmentType.JUSTIFIED }
          ),

          p("2. РЕЖИМ РАБОТЫ И ОТДЫХА", { bold: true, spacing: 200 }),
          p(
            `2.1. Рабочее время: с ${params.workStart} до ${params.workEnd}.`,
            { align: AlignmentType.JUSTIFIED, spacing: 100 }
          ),
          p(
            `2.2. Перерыв для отдыха и питания: с ${params.lunchStart} до ${params.lunchEnd} (1 час).`,
            { align: AlignmentType.JUSTIFIED, spacing: 100 }
          ),
          p(`2.3. Выходные дни: ${params.weekendDays}.`, {
            align: AlignmentType.JUSTIFIED,
          }),

          p("3. ПОРЯДОК ПРИЁМА И УВОЛЬНЕНИЯ", {
            bold: true,
            spacing: 200,
          }),
          p(
            `3.1. Приём на работу оформляется трудовым договором и приказом руководителя.`,
            { align: AlignmentType.JUSTIFIED, spacing: 100 }
          ),
          p(
            `3.2. Увольнение производится по основаниям, предусмотренным Трудовым кодексом РФ.`,
            { align: AlignmentType.JUSTIFIED }
          ),

          p("4. ОПЛАТА ТРУДА", { bold: true, spacing: 200 }),
          p(
            `4.1. Заработная плата выплачивается два раза в месяц: не позднее 15 числа (аванс) и не позднее последнего числа месяца (окончательный расчёт).`,
            { align: AlignmentType.JUSTIFIED }
          ),

          p("5. ТРУДОВАЯ ДИСЦИПЛИНА", { bold: true, spacing: 200 }),
          p(
            `5.1. Работники обязаны соблюдать трудовую дисциплину, правила охраны труда, бережно относиться к имуществу работодателя.`,
            { align: AlignmentType.JUSTIFIED }
          ),
          p(
            `5.2. За нарушение трудовой дисциплины применяются дисциплинарные взыскания в соответствии с ТК РФ.`,
            { align: AlignmentType.JUSTIFIED, spacing: 400 }
          ),

          p("6. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ", { bold: true, spacing: 200 }),
          p(
            `Настоящие Правила вступают в силу с момента их утверждения и действуют до замены новыми.`,
            { align: AlignmentType.JUSTIFIED }
          ),
        ],
      },
    ],
  });
}

// ═══════════════════════════════════════════════════════
// 12. ЗАЯВЛЕНИЕ НА ОТПУСК
// ═══════════════════════════════════════════════════════
function generateVacationApplication(params: any): Document {
  const start = formatDate(params.startDate);
  const end = formatDate(params.endDate);
  const applyDate = formatDate(params.applyDate);

  const s = new Date(params.startDate + "T00:00:00Z").getTime();
  const e = new Date(params.endDate + "T00:00:00Z").getTime();
  const days = Math.max(1, Math.round((e - s) / 86400000) + 1);

  return new Document({
    sections: [
      {
        children: [
          // Шапка (справа)
          p(params.orgName, { bold: true, align: AlignmentType.RIGHT, spacing: 100 }),
          p(`Директору: ${params.directorName}`, {
            align: AlignmentType.RIGHT,
            spacing: 100,
          }),
          p(`от: ${params.employeeName}`, {
            align: AlignmentType.RIGHT,
            spacing: 100,
          }),
          p(`Должность: ${params.position}`, {
            align: AlignmentType.RIGHT,
            spacing: 400,
          }),

          // Заголовок
          p("ЗАЯВЛЕНИЕ", {
            bold: true,
            align: AlignmentType.CENTER,
            spacing: 400,
          }),

          // Тело
          p(
            `Прошу предоставить мне ежегодный основной оплачиваемый отпуск на ${days} календарных дней с ${start} по ${end}.`,
            { align: AlignmentType.JUSTIFIED, spacing: 400 }
          ),

          // Подпись
          p(applyDate, { align: AlignmentType.LEFT, spacing: 400 }),
          p(`Подпись: _________________ / ${params.employeeName} /`, {
            align: AlignmentType.LEFT,
            spacing: 200,
          }),
        ],
      },
    ],
  });
}

// ═══════════════════════════════════════════════════════
// ДИСПЕТЧЕР
// ═══════════════════════════════════════════════════════
const GENERATORS: Record<string, (params: any) => Document> = {
  order_safety_responsible: generateSafetyOrder,
  order_fire_safety: generateFireOrder,
  order_hire: generateHireOrder,
  order_vacation_schedule_table: generateVacationScheduleTable,
  instruction_safety: generateSafetyInstruction,
  journal_briefing: generateBriefingJournal,
  contract_employment: generateEmploymentContract,
  consent_personal_data: generatePersonalDataConsent,
  rules_internal: generateInternalRules,
  application_vacation: generateVacationApplication,
};

export async function generateDocx(
  typeId: string,
  params: any
): Promise<Buffer> {
  const generator = GENERATORS[typeId];
  if (!generator) {
    console.error("UNKNOWN_DOCUMENT_TYPE:", typeId);
    console.error("Available keys:", Object.keys(GENERATORS));
    throw new Error("UNKNOWN_DOCUMENT_TYPE");
  }

  const docType = getDocumentType(typeId);
  if (docType) {
    for (const field of docType.fields) {
      if (field.required && !params[field.name]) {
        throw new Error(`MISSING_FIELD:${field.name}`);
      }
    }
  }

  const doc = generator(params);
  return Packer.toBuffer(doc);
}

export function buildFilename(typeId: string, params: any): string {
  const docType = getDocumentType(typeId);
  if (!docType) return "document.docx";
  return `${docType.title}.docx`.replace(/[<>:"/\\|?*]/g, "_");
}

// ═══════════════════════════════════════════════════════
// ОБРАЗЕЦ ШАБЛОНА (DOCX)
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// ОБРАЗЕЦ ШАБЛОНА (DOCX) — только документ, без инструкции
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// ОБРАЗЕЦ ШАБЛОНА (DOCX) — плейсхолдеры оранжевым
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// ОБРАЗЦЫ ШАБЛОНОВ ПО ТИПУ ДОКУМЕНТА
// ═══════════════════════════════════════════════════════

// Общая шапка приказа
function sampleHeaderDoc(): Paragraph[] {
  return [
    pYellow("{Название организации}", {
      bold: true,
      align: AlignmentType.CENTER,
      spacing: 120,
    }),
    pYellow("ПРИКАЗ № {orderNumber}", {
      bold: true,
      align: AlignmentType.CENTER,
      spacing: 120,
    }),
    pYellow("{Город}", { align: AlignmentType.CENTER, spacing: 120 }),
    pYellow("от {Дата приказа}", {
      align: AlignmentType.CENTER,
      spacing: 400,
    }),
  ];
}

// Общий хвост со справкой
function sampleFooterDoc(): Paragraph[] {
  return [
    p("", { spacing: 400 }),
    p("СПРАВКА. После редактирования эту часть текста удалить!", {
      bold: true,
      spacing: 120,
    }),
    p("Доступные плейсхолдеры:", { bold: true, spacing: 200 }),
    pYellow(
      "Организация: {Организация}, {Город}, {Директор}, {ИНН}, {Адрес}, {Сегодня}",
      { spacing: 100, size: 20 }
    ),
    pYellow(
      "Сотрудник: {Сотрудник}, {Email сотрудника}, {Телефон сотрудника}, {Ставка сотрудника}, {Должность сотрудника}",
      { spacing: 100, size: 20 }
    ),
    pYellow("Список: {СписокСотрудников}", {
      spacing: 100,
      size: 20,
    }),
    pYellow(
      "Из формы: {orderNumber}, {Дата приказа}, {salary}, {position}",
      { spacing: 100, size: 20 }
    ),
    pYellow(
      "Все плейсхолдеры вида {Ключ} автоматически заменяются реальными данными при генерации.",
      { spacing: 200, size: 20 }
    ),
  ];
}

// ─── Словарь образцов ────────────────────────────────
function buildSampleChildren(
  typeId: string,
  templateTitle: string
): Paragraph[] {
  switch (typeId) {
    // 1. ПРИКАЗ ОБ ОХРАНЕ ТРУДА
    case "order_safety_responsible":
      return [
        ...sampleHeaderDoc(),
        p(templateTitle, {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 400,
        }),
        p(
          "В соответствии со статьёй 217 Трудового кодекса Российской Федерации, ПРИКАЗЫВАЮ:",
          { align: AlignmentType.JUSTIFIED, spacing: 300 }
        ),
        pYellow(
          "1. Назначить {Сотрудник} - {Должность сотрудника} ответственным за организацию и соблюдение требований охраны труда.",
          { align: AlignmentType.JUSTIFIED, spacing: 200 }
        ),
        p("2. Утвердить должностную инструкцию ответственного.", {
          align: AlignmentType.JUSTIFIED,
          spacing: 200,
        }),
        p("3. Контроль за исполнением настоящего приказа оставляю за собой.", {
          align: AlignmentType.JUSTIFIED,
          spacing: 400,
        }),
        pYellow("Директор: _____________ / {Директор} /", {
          align: AlignmentType.LEFT,
          spacing: 200,
        }),
        pYellow(
          "С приказом ознакомлен(а): _____________ / {Сотрудник} /",
          { align: AlignmentType.LEFT, spacing: 200 }
        ),
        ...sampleFooterDoc(),
      ];

    // 2. ПРИКАЗ О ПОЖАРНОЙ БЕЗОПАСНОСТИ
    case "order_fire_safety":
      return [
        ...sampleHeaderDoc(),
        p(templateTitle, {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 400,
        }),
        p(
          "В соответствии с Федеральным законом от 21.12.1994 № 69-ФЗ «О пожарной безопасности», ПРИКАЗЫВАЮ:",
          { align: AlignmentType.JUSTIFIED, spacing: 300 }
        ),
        pYellow(
          "1. Назначить {Сотрудник} - {Должность сотрудника} ответственным за пожарную безопасность.",
          { align: AlignmentType.JUSTIFIED, spacing: 200 }
        ),
        p(
          "2. Возложить на ответственного проведение противопожарных инструктажей.",
          { align: AlignmentType.JUSTIFIED, spacing: 200 }
        ),
        p("3. Контроль за исполнением настоящего приказа оставляю за собой.", {
          align: AlignmentType.JUSTIFIED,
          spacing: 400,
        }),
        pYellow("Директор: _____________ / {Директор} /", {
          align: AlignmentType.LEFT,
          spacing: 200,
        }),
        pYellow(
          "С приказом ознакомлен(а): _____________ / {Сотрудник} /",
          { align: AlignmentType.LEFT, spacing: 200 }
        ),
        ...sampleFooterDoc(),
      ];

    // 4. ПРИКАЗ О ПРИЁМЕ НА РАБОТУ
    case "order_hire":
      return [
        ...sampleHeaderDoc(),
        p("О приёме на работу", {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 400,
        }),
        pYellow(
          "ПРИНЯТЬ на работу {Сотрудник} на должность {position} с окладом {salary} рублей в месяц.",
          { align: AlignmentType.JUSTIFIED, spacing: 300 }
        ),
        pYellow("Дата начала работы: {startDate}.", {
          align: AlignmentType.JUSTIFIED,
          spacing: 200,
        }),
        p("Основание: трудовой договор.", {
          align: AlignmentType.JUSTIFIED,
          spacing: 400,
        }),
        pYellow("Директор: _____________ / {Директор} /", {
          align: AlignmentType.LEFT,
          spacing: 200,
        }),
        pYellow(
          "С приказом ознакомлен(а): _____________ / {Сотрудник} /",
          { align: AlignmentType.LEFT, spacing: 200 }
        ),
        ...sampleFooterDoc(),
      ];

    // 5. ГРАФИК ОТПУСКОВ С ПРИКАЗОМ (ОБЪЕДИНЁННЫЙ ДОКУМЕНТ)
    case "order_vacation_schedule_table":
      return [
        pYellow("{Название организации}", {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 120,
        }),
        pYellow("ПРИКАЗ № {orderNumber}", {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 100,
        }),
        pYellow("{Город}", { align: AlignmentType.CENTER, spacing: 100 }),
        pYellow("от {Дата утверждения}", {
          align: AlignmentType.CENTER,
          spacing: 300,
        }),
        pYellow("Об утверждении графика отпусков на {year} год", {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 400,
        }),
        p("В соответствии со статьёй 123 Трудового кодекса РФ ПРИКАЗЫВАЮ:", {
          align: AlignmentType.JUSTIFIED,
          spacing: 200,
        }),
        p("1. Утвердить график отпусков сотрудников на {year} год (приложение 1).", {
          align: AlignmentType.JUSTIFIED,
          spacing: 100,
        }),
        p("2. Ознакомить всех сотрудников с графиком отпусков под подпись.", {
          align: AlignmentType.JUSTIFIED,
          spacing: 100,
        }),
        p("3. Контроль за исполнением настоящего приказа оставляю за собой.", {
          align: AlignmentType.JUSTIFIED,
          spacing: 300,
        }),
        pYellow("Директор: _____________ / {Директор} /", {
          align: AlignmentType.LEFT,
          spacing: 400,
        }),
        pYellow("Приложение 1. ГРАФИК ОТПУСКОВ на {year} год", {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 400,
        }),
        p("№ | ФИО сотрудника | Кол-во дней | Дата начала отпуска", {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 200,
        }),
        p("1 | {Сотрудник} | 14 | 01.07.2026", {
          align: AlignmentType.LEFT,
          spacing: 100,
        }),
        p("2 | (следующий сотрудник) | 14 | 15.08.2026", {
          align: AlignmentType.LEFT,
          spacing: 400,
        }),
        ...sampleFooterDoc(),
      ];

    // 6. ИНСТРУКЦИЯ ПО ОХРАНЕ ТРУДА
    case "instruction_safety":
      return [
        pYellow("{Название организации}", {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 120,
        }),
        p("УТВЕРЖДАЮ", { align: AlignmentType.RIGHT, spacing: 100 }),
        pYellow("Директор: ___________ / {Директор} /", {
          align: AlignmentType.RIGHT,
          spacing: 100,
        }),
        pYellow("от {Дата утверждения}", {
          align: AlignmentType.RIGHT,
          spacing: 400,
        }),
        pYellow(
          "ИНСТРУКЦИЯ № {instructionNumber} по охране труда для должности «{position}»",
          { bold: true, align: AlignmentType.CENTER, spacing: 400 }
        ),
        p("1. ОБЩИЕ ТРЕБОВАНИЯ ОХРАНЫ ТРУДА", {
          bold: true,
          spacing: 200,
        }),
        p(
          "К работе допускаются лица, прошедшие вводный и первичный инструктаж по охране труда, ознакомленные с настоящей инструкцией.",
          { align: AlignmentType.JUSTIFIED, spacing: 200 }
        ),
        p("2. ОСНОВНЫЕ ОПАСНЫЕ И ВРЕДНЫЕ ФАКТОРЫ", {
          bold: true,
          spacing: 200,
        }),
        p("- Электрический ток в розетках и оборудовании", {
          spacing: 100,
        }),
        p("- Скользкие полы в мокрых зонах", { spacing: 100 }),
        p("- Острые предметы и оборудование", { spacing: 200 }),
        p("3. ТРЕБОВАНИЯ ПЕРЕД НАЧАЛОМ РАБОТЫ", {
          bold: true,
          spacing: 200,
        }),
        p("- Надеть спецодежду, привести её в порядок", {
          spacing: 100,
        }),
        p("- Проверить исправность оборудования", { spacing: 100 }),
        p("- Осмотреть рабочее место", { spacing: 200 }),
        p("4. ТРЕБОВАНИЯ ПО ОКОНЧАНИИ РАБОТЫ", {
          bold: true,
          spacing: 200,
        }),
        p(
          "Привести в порядок рабочее место, выключить оборудование, снять спецодежду.",
          { align: AlignmentType.JUSTIFIED, spacing: 400 }
        ),
        ...sampleFooterDoc(),
      ];

    // 7. ЖУРНАЛ РЕГИСТРАЦИИ ИНСТРУКТАЖЕЙ
    case "journal_briefing":
      return [
        pYellow("{Название организации}", {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 120,
        }),
        pYellow(
          "ЖУРНАЛ РЕГИСТРАЦИИ ИНСТРУКТАЖЕЙ ПО ОХРАНЕ ТРУДА на {year} год",
          { bold: true, align: AlignmentType.CENTER, spacing: 200 }
        ),
        pYellow(
          "Ответственный за проведение инструктажа: {Сотрудник}",
          { spacing: 300 }
        ),
        p("", { spacing: 200 }),
        pYellow("{Таблица журнала регистрации}", {
          spacing: 200,
        }),
        p("", { spacing: 200 }),
        ...sampleFooterDoc(),
      ];
    // 8. ТРУДОВОЙ ДОГОВОР
    case "contract_employment":
      return [
        pYellow("ТРУДОВОЙ ДОГОВОР № {contractNumber}", {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 200,
        }),
        pYellow("{Город}", { align: AlignmentType.CENTER, spacing: 100 }),
        pYellow("от {Дата договора}", {
          align: AlignmentType.CENTER,
          spacing: 400,
        }),
        pYellow(
          "{Название организации} (ИНН {ИНН}), в лице директора {Директор}, именуемое «Работодатель», и {Сотрудник}, именуемый «Работник», заключили настоящий договор:",
          { align: AlignmentType.JUSTIFIED, spacing: 300 }
        ),
        p("1. ПРЕДМЕТ ДОГОВОРА", { bold: true, spacing: 200 }),
        pYellow(
          "1.1. Работодатель принимает Работника на должность {Должность сотрудника}.",
          { align: AlignmentType.JUSTIFIED, spacing: 100 }
        ),
        pYellow("1.2. Дата начала работы: {Дата начала}.", {
          align: AlignmentType.JUSTIFIED,
          spacing: 200,
        }),
        p("2. ОПЛАТА ТРУДА", { bold: true, spacing: 200 }),
        pYellow(
          "2.1. Работнику устанавливается оклад в размере {Оклад} рублей в месяц.",
          { align: AlignmentType.JUSTIFIED, spacing: 200 }
        ),
        p("3. РЕЖИМ РАБОТЫ И ОТДЫХА", { bold: true, spacing: 200 }),
        p("3.1. 40-часовая рабочая неделя с выходными согласно графику.", {
          align: AlignmentType.JUSTIFIED,
          spacing: 400,
        }),

        p("РЕКВИЗИТЫ И ПОДПИСИ СТОРОН", { bold: true, spacing: 300 }),

        pYellow("РАБОТОДАТЕЛЬ", { bold: true, spacing: 100 }),
        pYellow("Организация: {Название организации}", { spacing: 100 }),
        pYellow("ИНН: {ИНН}", { spacing: 100 }),
        pYellow("Адрес: {Адрес организации}", { spacing: 100 }),
        pYellow("Директор: ______________ / {Директор} /", {
          spacing: 300,
        }),

        pYellow("РАБОТНИК", { bold: true, spacing: 100 }),
        pYellow("ФИО: {Сотрудник}", { spacing: 100 }),
        pYellow("Паспорт: {employeePassport}", { spacing: 100 }),
        pYellow("Адрес: {Адрес сотрудника}", { spacing: 100 }),
        pYellow("Подпись: ______________", { spacing: 200 }),

        ...sampleFooterDoc(),
      ];
    // 9. СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ
    case "consent_personal_data":
      return [
        p("СОГЛАСИЕ", {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 100,
        }),
        p("на обработку персональных данных", {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 200,
        }),
        pYellow("{Название организации}", {
          align: AlignmentType.CENTER,
          spacing: 100,
        }),
        pYellow("{Сегодня}", { align: AlignmentType.CENTER, spacing: 400 }),
        pYellow(
          "Я, {Сотрудник}, даю своё согласие {Название организации} на обработку моих персональных данных в соответствии с Федеральным законом № 152-ФЗ.",
          { align: AlignmentType.JUSTIFIED, spacing: 300 }
        ),
        p(
          "Согласие даётся на обработку следующих персональных данных: ФИО, дата рождения, паспортные данные, адрес регистрации, контактный телефон, email.",
          { align: AlignmentType.JUSTIFIED, spacing: 200 }
        ),
        p(
          "Цель обработки: трудовые отношения, ведение кадрового учёта.",
          { align: AlignmentType.JUSTIFIED, spacing: 300 }
        ),
        pYellow("Подпись: ______________ / {Сотрудник} /", {
          spacing: 200,
        }),
        pYellow("Дата: {Сегодня}", { spacing: 200 }),
        ...sampleFooterDoc(),
      ];

    // 10. ПРАВИЛА ВНУТРЕННЕГО ТРУДОВОГО РАСПОРЯДКА
    case "rules_internal":
      return [
        pYellow("{Название организации}", {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 120,
        }),
        p("УТВЕРЖДАЮ", { align: AlignmentType.RIGHT, spacing: 100 }),
        pYellow("Директор: ___________ / {Директор} /", {
          align: AlignmentType.RIGHT,
          spacing: 100,
        }),
        pYellow("от {Дата утверждения}", {
          align: AlignmentType.RIGHT,
          spacing: 400,
        }),
        p("ПРАВИЛА ВНУТРЕННЕГО ТРУДОВОГО РАСПОРЯДКА", {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 400,
        }),
        p("1. ОБЩИЕ ПОЛОЖЕНИЯ", { bold: true, spacing: 200 }),
        pYellow(
          "Настоящие Правила регулируют трудовые отношения между работниками и {Название организации}.",
          { align: AlignmentType.JUSTIFIED, spacing: 200 }
        ),
        p("2. РЕЖИМ РАБОТЫ И ОТДЫХА", { bold: true, spacing: 200 }),
        p("2.1. Рабочее время: с 09:00 до 18:00.", {
          align: AlignmentType.JUSTIFIED,
          spacing: 100,
        }),
        p("2.2. Перерыв для отдыха и питания: с 13:00 до 14:00.", {
          align: AlignmentType.JUSTIFIED,
          spacing: 100,
        }),
        p("2.3. Выходные дни: суббота, воскресенье.", {
          align: AlignmentType.JUSTIFIED,
          spacing: 200,
        }),
        p("3. ОПЛАТА ТРУДА", { bold: true, spacing: 200 }),
        p(
          "3.1. Заработная плата выплачивается два раза в месяц.",
          { align: AlignmentType.JUSTIFIED, spacing: 200 }
        ),
        p("4. ТРУДОВАЯ ДИСЦИПЛИНА", { bold: true, spacing: 200 }),
        p(
          "4.1. Работники обязаны соблюдать трудовую дисциплину и правила охраны труда.",
          { align: AlignmentType.JUSTIFIED, spacing: 200 }
        ),
        p("5. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ", { bold: true, spacing: 200 }),
        p(
          "Настоящие Правила вступают в силу с момента их утверждения.",
          { align: AlignmentType.JUSTIFIED, spacing: 400 }
        ),
        ...sampleFooterDoc(),
      ];

    // 12. ЗАЯВЛЕНИЕ НА ОТПУСК
    case "application_vacation":
      return [
        pYellow("{Название организации}", {
          bold: true,
          align: AlignmentType.RIGHT,
          spacing: 120,
        }),
        pYellow("Директору: {Директор}", {
          align: AlignmentType.RIGHT,
          spacing: 100,
        }),
        pYellow("от: {Сотрудник}", {
          align: AlignmentType.RIGHT,
          spacing: 100,
        }),
        pYellow("Должность: {Должность сотрудника}", {
          align: AlignmentType.RIGHT,
          spacing: 400,
        }),
        p("ЗАЯВЛЕНИЕ", {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 400,
        }),
        pYellow(
          "Прошу предоставить мне ежегодный основной оплачиваемый отпуск с {startDate} по {endDate}.",
          { align: AlignmentType.JUSTIFIED, spacing: 400 }
        ),
        pYellow("{Дата заявления}", {
          align: AlignmentType.LEFT,
          spacing: 400,
        }),
        pYellow("Подпись: _____________ / {Сотрудник} /", {
          align: AlignmentType.LEFT,
          spacing: 200,
        }),
        ...sampleFooterDoc(),
      ];

    // По умолчанию
    default:
      return [
        ...sampleHeaderDoc(),
        p(templateTitle, {
          bold: true,
          align: AlignmentType.CENTER,
          spacing: 400,
        }),
        p("Основная часть документа.", {
          align: AlignmentType.JUSTIFIED,
          spacing: 200,
        }),
        ...sampleFooterDoc(),
      ];
  }
}

// ─── Экспортируемая функция ───────────────────────────
export async function buildSampleDocx(
  typeId: string,
  templateTitle: string
): Promise<Buffer> {
  const children = buildSampleChildren(typeId, templateTitle);

  const docType = getDocumentType(typeId);
  const isLandscape = docType?.landscape === true;

  const doc = new Document({
    creator: "Планировщик смен",
    title: templateTitle,
    description: "Образец шаблона",
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: isLandscape
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}