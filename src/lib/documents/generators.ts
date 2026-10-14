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
// 3. ПРИКАЗ ОБ УТВЕРЖДЕНИИ ГРАФИКА ОТПУСКОВ
// ═══════════════════════════════════════════════════════
function generateVacationOrder(params: any): Document {
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
            `Об утверждении графика отпусков на ${params.year} год`
          ),
          p(
            `В соответствии со статьёй 123 Трудового кодекса Российской Федерации, ПРИКАЗЫВАЮ:`,
            { align: AlignmentType.JUSTIFIED, spacing: 300 }
          ),
          p(
            `1. Утвердить график отпусков сотрудников на ${params.year} год.`,
            { align: AlignmentType.JUSTIFIED }
          ),
          p(
            `2. Ознакомить всех сотрудников с графиком отпусков под подпись.`,
            { align: AlignmentType.JUSTIFIED }
          ),
          p(
            `3. Контроль за исполнением настоящего приказа оставляю за собой.`,
            { align: AlignmentType.JUSTIFIED, spacing: 400 }
          ),
          ...footer(params.directorName),
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
  const entries = lines(params.entries);

  const rows: string[][] = entries.map((line, i) => {
    const parts = line.split(";").map((s) => s.trim());
    const name = parts[0] ?? "";
    const days = parts[1] ?? "";
    const start = parts[2] ?? "";
    return [String(i + 1), name, days, start];
  });

  return new Document({
    sections: [
      {
        children: [
          p(params.orgName, { bold: true, align: AlignmentType.CENTER }),
          p("УТВЕРЖДЕНО", { align: AlignmentType.RIGHT, spacing: 100 }),
          p(`Приказом от ${date}`, {
            align: AlignmentType.RIGHT,
            spacing: 100,
          }),
          p(`Директор: ___________ / ${params.directorName} /`, {
            align: AlignmentType.RIGHT,
            spacing: 400,
          }),
          p(`ГРАФИК ОТПУСКОВ на ${params.year} год`, {
            bold: true,
            align: AlignmentType.CENTER,
            spacing: 400,
          }),
          blank(1),
          makeTable(
            ["№", "ФИО сотрудника", "Кол-во дней", "Дата начала отпуска"],
            rows
          ),
        ],
      },
    ],
  });
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
  const entries = lines(params.entries);
  const rows = entries.map((line) => {
    const parts = line.split(";").map((s) => s.trim());
    const name = parts[0] ?? "";
    const position = parts[1] ?? "";
    const date = parts[2] ?? "";
    return [name, position, date, "вводный", "__________", "__________"];
  });

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
          p(`Работодатель: ${params.orgName}`, { spacing: 100 }),
          p(`Адрес: ${params.orgAddress}`, { spacing: 100 }),
          p(`Директор: ______________ / ${params.directorName} /`, {
            spacing: 300,
          }),
          p(`Работник: ${params.employeeName}`, { spacing: 100 }),
          p(`Адрес: ${params.employeeAddress}`, { spacing: 100 }),
          p(`Подпись: ______________`, { spacing: 100 }),
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
// ДИСПЕТЧЕР
// ═══════════════════════════════════════════════════════
const GENERATORS: Record<string, (params: any) => Document> = {
  order_safety_responsible: generateSafetyOrder,
  order_fire_safety: generateFireOrder,
  order_vacation_schedule: generateVacationOrder,
  order_hire: generateHireOrder,
  order_vacation_schedule_table: generateVacationScheduleTable,
  instruction_safety: generateSafetyInstruction,
  journal_briefing: generateBriefingJournal,
  contract_employment: generateEmploymentContract,
  consent_personal_data: generatePersonalDataConsent,
  rules_internal: generateInternalRules,
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
export async function buildSampleDocx(
  templateTitle: string
): Promise<Buffer> {
  const children: Paragraph[] = [
    // ─── Шапка ───────────────────────────────────────
    pWithHighlight("{Название организации}", {
      bold: true,
      align: AlignmentType.CENTER,
      spacing: 100,
    }),
    pWithHighlight("ПРИКАЗ № {orderNumber}", {
      bold: true,
      align: AlignmentType.CENTER,
      spacing: 100,
    }),
    pWithHighlight("{Город}", {
      align: AlignmentType.CENTER,
      spacing: 100,
    }),
    pWithHighlight("от {orderDate}", {
      align: AlignmentType.CENTER,
      spacing: 400,
    }),

    // ─── Заголовок ───────────────────────────────────
    pWithHighlight(templateTitle, {
      bold: true,
      align: AlignmentType.CENTER,
      spacing: 400,
    }),

    // ─── Основная часть ──────────────────────────────
    pWithHighlight(
      "В соответствии с действующим законодательством Российской Федерации, ПРИКАЗЫВАЮ:",
      { align: AlignmentType.JUSTIFIED, spacing: 300 }
    ),

    pWithHighlight(
      "1. Назначить {Сотрудник} ответственным за соблюдение требований.",
      { align: AlignmentType.JUSTIFIED, spacing: 200 }
    ),

    pWithHighlight(
      "2. Установить должностной оклад в размере {salary} рублей в месяц.",
      { align: AlignmentType.JUSTIFIED, spacing: 200 }
    ),

    pWithHighlight(
      "3. Контроль за исполнением настоящего приказа оставляю за собой.",
      { align: AlignmentType.JUSTIFIED, spacing: 400 }
    ),

    // ─── Подписи ─────────────────────────────────────
    pWithHighlight("Директор: _________________________ / {Директор} /", {
      align: AlignmentType.LEFT,
      spacing: 200,
    }),

    pWithHighlight(
      "С приказом ознакомлен(а): _________________________ / {Сотрудник} /",
      { align: AlignmentType.LEFT }
    ),
  ];

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}