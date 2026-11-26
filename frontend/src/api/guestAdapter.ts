import type { AxiosAdapter, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { GUEST_SEED } from "../lib/guestSeed";

// Инициализация пустой базы (версия 3 — чтобы сбросить старые ошибки)
const initDb = () => {
  if (!localStorage.getItem("guest_db") || localStorage.getItem("guest_db_version") !== "3") {
    localStorage.setItem("guest_db_version", "3");
    localStorage.setItem("guest_db", JSON.stringify({
      weeks: [{
        id: GUEST_SEED.weekId,
        weekStartDate: GUEST_SEED.weekStart,
        status: "PUBLISHED",
        shifts: GUEST_SEED.shifts,
      }],
      users: GUEST_SEED.employees,
      templates: GUEST_SEED.templates,
      locations: GUEST_SEED.locations,
    }));
  }
};

const getDb = () => JSON.parse(localStorage.getItem("guest_db") || "{}");
const saveDb = (db: any) => localStorage.setItem("guest_db", JSON.stringify(db));

export const guestAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
  initDb();
  const db = getDb();
  const url = config.url || "";
  const method = (config.method || "get").toLowerCase();
  
  let data: any = null;
  let status = 200;

  // === ДОКУМЕНТЫ (строго в начале, чтобы не перехватывались шаблонами смен) ===
  if (url.includes("/documents/templates") && method === "get") {
    data = [
      { id: "order_safety_responsible", title: "Приказ о назначении ответственного за охрану труда", category: "Приказы", description: "Назначает сотрудника ответственным за охрану труда.", fields: [ { name: "orgName", label: "Название организации", type: "text", required: true }, { name: "city", label: "Город", type: "text", required: true, defaultValue: "Москва" }, { name: "orderNumber", label: "Номер приказа", type: "text", required: true, defaultValue: "1" }, { name: "orderDate", label: "Дата приказа", type: "date", required: true }, { name: "directorName", label: "ФИО директора", type: "text", required: true }, { name: "responsibleName", label: "ФИО ответственного", type: "employee_select", required: true }, { name: "responsiblePosition", label: "Должность ответственного", type: "text", required: true, defaultValue: "менеджер" } ] },
      { id: "order_fire_safety", title: "Приказ о назначении ответственного за пожарную безопасность", category: "Приказы", description: "Назначает ответственного за пожарную безопасность.", fields: [ { name: "orgName", label: "Название организации", type: "text", required: true }, { name: "city", label: "Город", type: "text", required: true, defaultValue: "Москва" }, { name: "orderNumber", label: "Номер приказа", type: "text", required: true, defaultValue: "2" }, { name: "orderDate", label: "Дата приказа", type: "date", required: true }, { name: "directorName", label: "ФИО директора", type: "text", required: true }, { name: "responsibleName", label: "ФИО ответственного", type: "employee_select", required: true }, { name: "responsiblePosition", label: "Должность ответственного", type: "text", required: true, defaultValue: "администратор" } ] },
      { id: "order_hire", title: "Приказ о приёме на работу", category: "Приказы", description: "Оформляет приём сотрудника на работу.", fields: [ { name: "orgName", label: "Название организации", type: "text", required: true }, { name: "city", label: "Город", type: "text", required: true, defaultValue: "Москва" }, { name: "orderNumber", label: "Номер приказа", type: "text", required: true, defaultValue: "1-к" }, { name: "orderDate", label: "Дата приказа", type: "date", required: true }, { name: "employeeName", label: "Сотрудник", type: "employee_select", required: true }, { name: "position", label: "Должность", type: "text", required: true, defaultValue: "продавец" }, { name: "salary", label: "Оклад (₽/мес)", type: "text", required: true, placeholder: "50000" }, { name: "startDate", label: "Дата начала работы", type: "date", required: true }, { name: "directorName", label: "ФИО директора", type: "text", required: true } ] },
      { id: "order_vacation_schedule_table", title: "График отпусков с приказом об утверждении", category: "Приказы", description: "Готовый документ по ст. 123 ТК РФ.", fields: [ { name: "orgName", label: "Название организации", type: "text", required: true }, { name: "city", label: "Город", type: "text", required: true, defaultValue: "Москва" }, { name: "orderNumber", label: "Номер приказа", type: "text", required: true, defaultValue: "3" }, { name: "year", label: "Год", type: "text", required: true, defaultValue: String(new Date().getFullYear()) }, { name: "approveDate", label: "Дата утверждения", type: "date", required: true }, { name: "directorName", label: "ФИО директора", type: "text", required: true } ] },
      { id: "instruction_safety", title: "Инструкция по охране труда", category: "Инструкции", description: "Типовая инструкция по охране труда.", fields: [ { name: "orgName", label: "Название организации", type: "text", required: true }, { name: "position", label: "Должность", type: "text", required: true, defaultValue: "продавец" }, { name: "instructionNumber", label: "Номер инструкции", type: "text", required: true, defaultValue: "1" }, { name: "approveDate", label: "Дата утверждения", type: "date", required: true }, { name: "directorName", label: "ФИО директора", type: "text", required: true }, { name: "hazards", label: "Основные опасности", type: "textarea", required: true, defaultValue: "Электрический ток\nСкользкие полы\nОстрые предметы" }, { name: "requirements", label: "Требования перед началом работы", type: "textarea", required: true, defaultValue: "Надеть спецодежду\nПроверить оборудование" } ] },
      { id: "journal_briefing", title: "Журнал регистрации инструктажей", category: "Журналы", description: "Таблица для ведения учёта инструктажей.", landscape: true, fields: [ { name: "orgName", label: "Название организации", type: "text", required: true }, { name: "year", label: "Год", type: "text", required: true, defaultValue: String(new Date().getFullYear()) }, { name: "responsible", label: "Ответственный за инструктаж", type: "employee_select", required: true }, { name: "employees", label: "Сотрудники для журнала", type: "employee_multi_select", required: true } ] },
      { id: "contract_employment", title: "Трудовой договор", category: "Договоры", description: "Стандартный трудовой договор.", notStored: true, fields: [ { name: "orgName", label: "Название организации", type: "text", required: true }, { name: "orgInn", label: "ИНН организации", type: "text", required: true, placeholder: "7701234567" }, { name: "orgAddress", label: "Юридический адрес", type: "text", required: true }, { name: "directorName", label: "ФИО директора", type: "text", required: true }, { name: "contractNumber", label: "Номер договора", type: "text", required: true, defaultValue: "1" }, { name: "contractDate", label: "Дата договора", type: "date", required: true }, { name: "city", label: "Город", type: "text", required: true, defaultValue: "Москва" }, { name: "employeeName", label: "Сотрудник", type: "employee_select", required: true }, { name: "employeePassport", label: "Паспорт", type: "text", required: true, placeholder: "4501 123456" }, { name: "employeeAddress", label: "Адрес регистрации", type: "text", required: true }, { name: "position", label: "Должность", type: "text", required: true }, { name: "salary", label: "Оклад (₽/мес)", type: "text", required: true }, { name: "startDate", label: "Дата начала работы", type: "date", required: true }, { name: "probation", label: "Испытательный срок", type: "text", required: true, defaultValue: "3" } ] },
      { id: "consent_personal_data", title: "Согласие на обработку персональных данных", category: "Согласия", description: "Согласие сотрудника на обработку ПДн.", notStored: true, fields: [ { name: "orgName", label: "Название организации", type: "text", required: true }, { name: "orgAddress", label: "Адрес организации", type: "text", required: true }, { name: "personName", label: "Сотрудник", type: "employee_select", required: true }, { name: "personPassport", label: "Паспорт", type: "text", required: true }, { name: "personAddress", label: "Адрес регистрации", type: "text", required: true }, { name: "consentDate", label: "Дата подписания", type: "date", required: true } ] },
      { id: "rules_internal", title: "Правила внутреннего трудового распорядка", category: "Правила", description: "Локальный нормативный акт.", fields: [ { name: "orgName", label: "Название организации", type: "text", required: true }, { name: "city", label: "Город", type: "text", required: true, defaultValue: "Москва" }, { name: "approveDate", label: "Дата утверждения", type: "date", required: true }, { name: "directorName", label: "ФИО директора", type: "text", required: true }, { name: "workStart", label: "Начало рабочего дня", type: "text", required: true, defaultValue: "09:00" }, { name: "workEnd", label: "Конец рабочего дня", type: "text", required: true, defaultValue: "18:00" }, { name: "lunchStart", label: "Начало обеда", type: "text", required: true, defaultValue: "13:00" }, { name: "lunchEnd", label: "Конец обеда", type: "text", required: true, defaultValue: "14:00" }, { name: "weekendDays", label: "Выходные дни", type: "text", required: true, defaultValue: "суббота, воскресенье" } ] },
      { id: "application_vacation", title: "Заявление на отпуск", category: "Заявления", description: "Заявление на ежегодный оплачиваемый отпуск.", fields: [ { name: "orgName", label: "Название организации", type: "text", required: true }, { name: "directorName", label: "ФИО директора", type: "text", required: true }, { name: "employeeName", label: "Сотрудник", type: "employee_select", required: true }, { name: "position", label: "Должность", type: "text", required: true }, { name: "startDate", label: "Отпуск с", type: "date", required: true }, { name: "endDate", label: "Отпуск по", type: "date", required: true }, { name: "applyDate", label: "Дата заявления", type: "date", required: true } ] },
    ];
  } else if (url.endsWith("/documents") && method === "get") {
    data = []; // История документов пуста
  }

  // === ШАБЛОНЫ СМЕН ===
  else if (url.includes("/templates") && method === "get") {
    data = db.templates;
  }

  // 1. Получение недели (GET /weeks/:id)
  else if (url.includes("/weeks") && method === "get") {
      if (url.endsWith("/weeks")) {
        data = [db.weeks[0]];
      } else {
        data = db.weeks[0];
      }
    }
  // 2. Публикация недели (POST /weeks/:id/publish)
  else if (url.includes("/publish") && method === "post") {
    db.weeks[0].status = "PUBLISHED";
    saveDb(db);
    data = { ok: true };
  }
  // 3. Добавление смены (POST /shifts)
  else if (url.includes("/shifts") && method === "post") {
    const payload = typeof config.data === "string" ? JSON.parse(config.data || "{}") : (config.data || {});
    db.weeks[0].shifts.push({ ...payload, id: "shift-" + Date.now() });
    saveDb(db);
    data = { ok: true };
  }
  // 4. Удаление смены (DELETE /shifts/:id)
  else if (url.includes("/shifts/") && method === "delete") {
    const id = url.split("/").pop();
    db.weeks[0].shifts = db.weeks[0].shifts.filter((s: any) => s.id !== id);
    saveDb(db);
    data = { ok: true };
  }
  // 5. Получение списка сотрудников (GET /users)
  else if (url.includes("/users") && method === "get") {
    data = db.users;
  }
  // 7. Получение локаций (GET /locations)
  else if (url.includes("/locations") && method === "get") {
    data = db.locations;
  }
  // Заглушки для страниц
  else if (url.includes("/vacations") && method === "get") {
    data = [
      { id: "v1", userId: "gu2", startDate: "2026-11-20", endDate: "2026-11-25", status: "PENDING", userName: "Дмитрий Козлов", userColor: "#F59E0B", days: 5 }
    ];
  }
  else if (url.includes("/sick-leaves") && method === "get") {
    data = [
      { id: "sl1", userId: "gu3", startDate: "2026-11-10", endDate: "2026-11-12", status: "APPROVED", userName: "Елена Волкова", userColor: "#8B5CF6", days: 3 }
    ];
  }
  else if (url.includes("/swaps") && method === "get") {
    data = [
      { id: "sw1", status: "PENDING", initiatorUser: { name: "Анна" }, targetUser: { name: "Елена" }, shiftDate: GUEST_SEED.weekStart }
    ];
  }
  else if (url.includes("/analytics") && method === "get") {
    data = { totalHours: 120, totalCost: 50000, shiftsCount: 30, chartData: [] };
  }
  else if (url.includes("/history") && method === "get") {
    data = [
      { id: "h1", action: "PUBLISH_WEEK", createdAt: new Date().toISOString(), userName: "Анна Смирнова" }
    ];
  }
  else if (url.includes("/count")) {
    data = { count: 0 };
  }
  // Заглушка для Табеля
  else if (url.includes("/timesheet")) {
    data = {
      users: GUEST_SEED.employees.map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        position: emp.position,
        paymentType: emp.paymentType,
        employmentType: emp.employmentType,
        days: Array.from({ length: 30 }, (_, i) => ({
          date: `2026-11-${String(i + 1).padStart(2, "0")}`,
          cell: { status: null },
          isWeekend: false
        })),
        totalHours: 0,
        totalPayGross: 0,
        totalPayNet: 0
      })),
      daysInMonth: 30,
      totals: { attendance: 0, hours: 0, gross: 0, tax: 0, net: 0 },
      taxRate: 13,
      timeTrackingOn: false
    };
  }
  // Для всех остальных GET-запросов возвращаем пустой массив
  else if (method === "get" && data === null) {
    data = [];
  }
  else {
    data = { ok: true, mock: true };
  }

  return {
    data,
    status,
    statusText: "OK",
    headers: {},
    config,
  };
};
