export type FieldType =
  | "text"
  | "date"
  | "textarea"
  | "employee_select"
  | "employee_multi_select";

export type DocumentField = {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
};

export type DocumentType = {
  id: string;
  title: string;
  description: string;
  category:
    | "Приказы"
    | "Инструкции"
    | "Журналы"
    | "Договоры"
    | "Согласия"
    | "Правила";
  fields: DocumentField[];
  notStored?: boolean;
  /** Альбомная ориентация страницы */
  landscape?: boolean;
};

export const DOCUMENT_TYPES: DocumentType[] = [
  // ═══ ПРИКАЗЫ ═══
  {
    id: "order_safety_responsible",
    title: "Приказ о назначении ответственного за охрану труда",
    description: "Назначает сотрудника ответственным за охрану труда в организации.",
    category: "Приказы",
    fields: [
      { name: "orgName", label: "Название организации", type: "text", required: true },
      { name: "city", label: "Город", type: "text", required: true, defaultValue: "Москва" },
      { name: "orderNumber", label: "Номер приказа", type: "text", required: true, defaultValue: "1" },
      { name: "orderDate", label: "Дата приказа", type: "date", required: true },
      { name: "directorName", label: "ФИО директора", type: "text", required: true },
      { name: "responsibleName", label: "ФИО ответственного", type: "employee_select", required: true },
      { name: "responsiblePosition", label: "Должность ответственного", type: "text", required: true, defaultValue: "менеджер" },
    ],
  },
  {
    id: "order_fire_safety",
    title: "Приказ о назначении ответственного за пожарную безопасность",
    description: "Назначает ответственного за пожарную безопасность и проведение инструктажей.",
    category: "Приказы",
    fields: [
      { name: "orgName", label: "Название организации", type: "text", required: true },
      { name: "city", label: "Город", type: "text", required: true, defaultValue: "Москва" },
      { name: "orderNumber", label: "Номер приказа", type: "text", required: true, defaultValue: "2" },
      { name: "orderDate", label: "Дата приказа", type: "date", required: true },
      { name: "directorName", label: "ФИО директора", type: "text", required: true },
      { name: "responsibleName", label: "ФИО ответственного", type: "employee_select", required: true },
      { name: "responsiblePosition", label: "Должность ответственного", type: "text", required: true, defaultValue: "администратор" },
    ],
  },
  {
    id: "order_vacation_schedule",
    title: "Приказ об утверждении графика отпусков",
    description: "Утверждает график отпусков сотрудников на календарный год.",
    category: "Приказы",
    fields: [
      { name: "orgName", label: "Название организации", type: "text", required: true },
      { name: "city", label: "Город", type: "text", required: true, defaultValue: "Москва" },
      { name: "orderNumber", label: "Номер приказа", type: "text", required: true, defaultValue: "3" },
      { name: "orderDate", label: "Дата приказа", type: "date", required: true },
      { name: "directorName", label: "ФИО директора", type: "text", required: true },
      { name: "year", label: "Год", type: "text", required: true, defaultValue: String(new Date().getFullYear()) },
    ],
  },
  {
    id: "order_hire",
    title: "Приказ о приёме на работу",
    description: "Оформляет приём сотрудника на работу с указанием должности и оклада.",
    category: "Приказы",
    fields: [
      { name: "orgName", label: "Название организации", type: "text", required: true },
      { name: "city", label: "Город", type: "text", required: true, defaultValue: "Москва" },
      { name: "orderNumber", label: "Номер приказа", type: "text", required: true, defaultValue: "1-к" },
      { name: "orderDate", label: "Дата приказа", type: "date", required: true },
      { name: "employeeName", label: "Сотрудник", type: "employee_select", required: true },
      { name: "position", label: "Должность", type: "text", required: true, defaultValue: "продавец" },
      { name: "salary", label: "Оклад (₽/мес)", type: "text", required: true, placeholder: "50000" },
      { name: "startDate", label: "Дата начала работы", type: "date", required: true },
      { name: "directorName", label: "ФИО директора", type: "text", required: true },
    ],
  },
  {
    id: "order_vacation_schedule_table",
    title: "График отпусков на год (таблица)",
    description:
      "Таблица отпусков сотрудников за год. Данные берутся из раздела «Отпуска».",
    category: "Приказы",
    fields: [
      { name: "orgName", label: "Название организации", type: "text", required: true },
      { name: "city", label: "Город", type: "text", required: true, defaultValue: "Москва" },
      { name: "year", label: "Год", type: "text", required: true, defaultValue: String(new Date().getFullYear()) },
      { name: "approveDate", label: "Дата утверждения", type: "date", required: true },
      { name: "directorName", label: "ФИО директора", type: "text", required: true },
    ],
  },

  // ═══ ИНСТРУКЦИИ ═══
  {
    id: "instruction_safety",
    title: "Инструкция по охране труда",
    description: "Типовая инструкция по охране труда для сотрудника определённой должности.",
    category: "Инструкции",
    fields: [
      { name: "orgName", label: "Название организации", type: "text", required: true },
      { name: "position", label: "Должность", type: "text", required: true, defaultValue: "продавец" },
      { name: "instructionNumber", label: "Номер инструкции", type: "text", required: true, defaultValue: "1" },
      { name: "approveDate", label: "Дата утверждения", type: "date", required: true },
      { name: "directorName", label: "ФИО директора", type: "text", required: true },
      { name: "hazards", label: "Основные опасности (по одной на строку)", type: "textarea", required: true, defaultValue: "Электрический ток в розетках и оборудовании\nСкользкие полы в мокрых зонах\nОстрые предметы и оборудование" },
      { name: "requirements", label: "Требования перед началом работы (по одному на строку)", type: "textarea", required: true, defaultValue: "Надеть спецодежду, привести её в порядок\nПроверить исправность оборудования\nОсмотреть рабочее место" },
    ],
  },

  // ═══ ЖУРНАЛЫ ═══
  {
    id: "journal_briefing",
    title: "Журнал регистрации инструктажей по охране труда",
    description:
      "Таблица для ведения учёта инструктажей: выбранные сотрудники, даты, подписи.",
    category: "Журналы",
    landscape: true,
    fields: [
      { name: "orgName", label: "Название организации", type: "text", required: true },
      { name: "year", label: "Год", type: "text", required: true, defaultValue: String(new Date().getFullYear()) },
      { name: "responsible", label: "Ответственный за инструктаж", type: "employee_select", required: true },
      { name: "employees", label: "Сотрудники для журнала", type: "employee_multi_select", required: true },
    ],
  },

  // ═══ ДОГОВОРЫ ═══
  {
    id: "contract_employment",
    title: "Трудовой договор",
    description: "Стандартный трудовой договор между работодателем и сотрудником.",
    category: "Договоры",
    notStored: true,
    fields: [
      { name: "orgName", label: "Название организации", type: "text", required: true },
      { name: "orgInn", label: "ИНН организации", type: "text", required: true, placeholder: "7701234567" },
      { name: "orgAddress", label: "Юридический адрес", type: "text", required: true },
      { name: "directorName", label: "ФИО директора", type: "text", required: true },
      { name: "contractNumber", label: "Номер договора", type: "text", required: true, defaultValue: "1" },
      { name: "contractDate", label: "Дата договора", type: "date", required: true },
      { name: "city", label: "Город", type: "text", required: true, defaultValue: "Москва" },
      { name: "employeeName", label: "Сотрудник", type: "employee_select", required: true },
      { name: "employeePassport", label: "Паспорт сотрудника", type: "text", required: true, placeholder: "4501 123456, выдан ОВД ... 01.01.2020" },
      { name: "employeeAddress", label: "Адрес регистрации сотрудника", type: "text", required: true },
      { name: "position", label: "Должность", type: "text", required: true },
      { name: "salary", label: "Оклад (₽/мес)", type: "text", required: true },
      { name: "startDate", label: "Дата начала работы", type: "date", required: true },
      { name: "probation", label: "Испытательный срок (мес., 0 — без срока)", type: "text", required: true, defaultValue: "3" },
    ],
  },

  // ═══ СОГЛАСИЯ ═══
  {
    id: "consent_personal_data",
    title: "Согласие на обработку персональных данных",
    description: "Согласие сотрудника на обработку персональных данных в соответствии с 152-ФЗ.",
    category: "Согласия",
    notStored: true,
    fields: [
      { name: "orgName", label: "Название организации", type: "text", required: true },
      { name: "orgAddress", label: "Адрес организации", type: "text", required: true },
      { name: "personName", label: "Сотрудник", type: "employee_select", required: true },
      { name: "personPassport", label: "Паспорт", type: "text", required: true, placeholder: "4501 123456" },
      { name: "personAddress", label: "Адрес регистрации", type: "text", required: true },
      { name: "consentDate", label: "Дата подписания", type: "date", required: true },
    ],
  },

  // ═══ ПРАВИЛА ═══
  {
    id: "rules_internal",
    title: "Правила внутреннего трудового распорядка",
    description: "Локальный нормативный акт, регулирующий режим работы и отдыха.",
    category: "Правила",
    fields: [
      { name: "orgName", label: "Название организации", type: "text", required: true },
      { name: "city", label: "Город", type: "text", required: true, defaultValue: "Москва" },
      { name: "approveDate", label: "Дата утверждения", type: "date", required: true },
      { name: "directorName", label: "ФИО директора", type: "text", required: true },
      { name: "workStart", label: "Начало рабочего дня", type: "text", required: true, defaultValue: "09:00" },
      { name: "workEnd", label: "Конец рабочего дня", type: "text", required: true, defaultValue: "18:00" },
      { name: "lunchStart", label: "Начало обеда", type: "text", required: true, defaultValue: "13:00" },
      { name: "lunchEnd", label: "Конец обеда", type: "text", required: true, defaultValue: "14:00" },
      { name: "weekendDays", label: "Выходные дни", type: "text", required: true, defaultValue: "суббота, воскресенье" },
    ],
  },
];

export function getDocumentType(id: string): DocumentType | undefined {
  return DOCUMENT_TYPES.find((d) => d.id === id);
}