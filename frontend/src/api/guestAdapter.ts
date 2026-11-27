import type { AxiosAdapter, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { GUEST_SEED } from "../lib/guestSeed";

// Инициализация пустой базы (версия 3 — чтобы сбросить старые ошибки)
const initDb = () => {
  const dbStr = localStorage.getItem("guest_db");
  let needsUpdate = !dbStr || localStorage.getItem("guest_db_version") !== "15";
  
  if (!needsUpdate && dbStr) {
    try {
      const db = JSON.parse(dbStr);
      const todayStr = new Date().toISOString().slice(0, 10);
      const hasCurrent = db.weeks?.some((w: any) => {
        const start = new Date(w.weekStartDate + "T00:00:00Z");
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 6);
        return todayStr >= w.weekStartDate && todayStr <= end.toISOString().slice(0, 10);
      });
      if (!hasCurrent) needsUpdate = true;
    } catch { needsUpdate = true; }
  }

  if (needsUpdate) {
    localStorage.setItem("guest_db_version", "15");
    localStorage.setItem("guest_db", JSON.stringify({
      weeks: GUEST_SEED.weeks,
      users: GUEST_SEED.employees,
      templates: GUEST_SEED.templates,
      locations: GUEST_SEED.locations,
      areas: GUEST_SEED.areas,
      positions: GUEST_SEED.positions,
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

  // Перехватываем все запросы счетчиков (чтобы не было NaN)
  if (url.includes("count") && method === "get") {
    return { data: { count: 0 }, status: 200, statusText: "OK", headers: {}, config };
  }

  // === ДАШБОРД ===
  if (url.includes("/dashboard") && method === "get") {
      const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD по местному времени
      let weeks = (db.weeks && db.weeks.length > 0) ? db.weeks : GUEST_SEED.weeks;

      let currentWeek = weeks.find((w: any) => {
        if (!w.weekStartDate) return false;
        const start = new Date(w.weekStartDate + "T00:00:00Z");
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 6);
        return todayStr >= w.weekStartDate && todayStr <= end.toISOString().slice(0, 10);
      });
      if (!currentWeek) {
        currentWeek = weeks[6] || weeks[0] || null;
      }

      const users = db.users || GUEST_SEED.employees;
      const templates = db.templates || GUEST_SEED.templates;

      // Обогащаем смены: подставляем user/template и считаем статус в реальном времени
      const enrich = (s: any) => {
        const start = new Date(`${s.shiftDate}T${s.startTime || "00:00"}:00`);
        const end = new Date(`${s.shiftDate}T${s.endTime || "00:00"}:00`);
        if ((s.endTime || "00:00") <= (s.startTime || "00:00")) end.setDate(end.getDate() + 1); // ночная через полночь
        const now = new Date();
        return {
          ...s,
          startTime: s.startTime || "00:00",
          endTime: s.endTime || "00:00",
          user: users.find((u: any) => u.id === s.userId) || null,
          template: templates.find((t: any) => t.id === s.templateId) || null,
          status: now >= start && now <= end ? "ACTIVE" : (s.status || "SCHEDULED"),
          // опоздание только у тех, кто уже начал работать
          latenessMinutes: s.latenessMinutes != null && now < start ? null : (s.latenessMinutes ?? null),
        };
      };

      const safeShifts = currentWeek ? (currentWeek.shifts || []).map(enrich) : [];
      const todayShifts = safeShifts.filter((s: any) => s.shiftDate === todayStr);

      data = {
        currentWeek: currentWeek ? { ...currentWeek, shifts: safeShifts } : null,
        weekTimeEntries: [],
        users,
        userCount: users.length,
        todayShifts,
        monthlyHours: 0,
      };
    }
    
    // === ПРОФИЛЬ (me) ===
  else if (url.endsWith("/me") && method === "get") {
    data = GUEST_SEED.me;
  }
  // === ДОКУМЕНТЫ ===
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
  else if ((url.includes("/templates") || url.includes("/shift-templates")) && method === "get") {
    data = db.templates;
  }
  // === ДОЛЖНОСТИ ===
  else if (url.includes("/positions") && method === "get") {
    data = GUEST_SEED.positions || [];
  }
  // === ЛОКАЦИИ (зоны) ===
  else if (url.includes("/areas") && method === "get") {
    data = GUEST_SEED.areas || [];
  }

  // 1. Получение недели (GET /weeks/:id)
  else if ((url.includes("/weeks") || url.includes("/schedule-weeks")) && method === "get") {
      const cleanUrl = url.split("?")[0];
      const parts = cleanUrl.split("/");
      const isDetail = parts.length > 2 && parts[2] !== "";
      if (isDetail) {
        const weekId = parts[2];
        if (weekId === "current" || weekId === "current-week") {
          const todayStr = new Date().toISOString().slice(0, 10);
          data = db.weeks.find((w: any) => {
            const start = new Date(w.weekStartDate + "T00:00:00Z");
            const end = new Date(start);
            end.setUTCDate(end.getUTCDate() + 6);
            return todayStr >= w.weekStartDate && todayStr <= end.toISOString().slice(0, 10);
          }) || db.weeks[0];
        } else {
          data = db.weeks.find((w: any) => w.id === weekId) || db.weeks[0];
        }
      } else {
        data = db.weeks;
      }
    }
  // 2. Публикация недели (POST /weeks/:id/publish)
  else if (url.includes("/publish") && method === "post") {
    const parts = url.split("?")[0].split("/");
    const id = parts.length > 2 ? parts[parts.length - 2] : null;
    if (id) {
      const week = db.weeks.find((w: any) => w.id === id);
      if (week) week.status = "PUBLISHED";
    } else {
      db.weeks[0].status = "PUBLISHED";
    }
    saveDb(db);
    data = { ok: true };
  }
  // 3. Добавление смены (POST /shifts)
  else if (url.includes("/shifts") && method === "post") {
    const payload = typeof config.data === "string" ? JSON.parse(config.data || "{}") : (config.data || {});
    const targetWeek = db.weeks.find((w: any) => w.id === payload.weekId) || db.weeks[0];
    targetWeek.shifts.push({ ...payload, id: "shift-" + Date.now() });
    saveDb(db);
    data = { ok: true };
  }
  // 4. Удаление смены (DELETE /shifts/:id)
  else if (url.includes("/shifts/") && method === "delete") {
    const id = url.split("/").pop();
    for (const w of db.weeks) {
      w.shifts = w.shifts.filter((s: any) => s.id !== id);
    }
    saveDb(db);
    data = { ok: true };
  }
  // Мок для привязки почты
  else if (url.includes("/auth/update-email") && method === "post") {
    data = { ok: true };
  }
  // 5. Получение списка сотрудников (GET /users)
  else if (url.includes("/users") && method === "get") {
    data = db.users;
  }
  // 5.1 Создание пользователя (POST /users)
  else if (url.includes("/users") && method === "post") {
    const payload = typeof config.data === "string" ? JSON.parse(config.data || "{}") : (config.data || {});
    const newUser = {
      id: "gu" + Date.now(),
      name: payload.name || "Новый сотрудник",
      email: payload.email || `demo_${Date.now()}@guest.ru`,
      phone: payload.phone || null,
      role: payload.role || "EMPLOYEE",
      position: payload.position || null,
      hourlyRate: payload.hourlyRate || null,
      createdAt: new Date().toISOString(),
      locationIds: payload.locationIds && payload.locationIds.length > 0 ? payload.locationIds : ["gloc1"],
      areaIds: payload.areaIds || [],
      paymentType: payload.paymentType || "HOURLY",
      employmentType: payload.employmentType || "SHTAT",
      color: payload.color || "#3B82F6",
      tempPassword: "123456",
      isTempPasswordSent: false
    };
    if (!db.users) db.users = [];
    db.users.push(newUser);
    saveDb(db);
    data = { user: newUser, tempPassword: "123456" };
  }
  // 5.2 Обновление пользователя (PATCH /users/:id)
  else if (url.includes("/users/") && method === "patch") {
    const parts = url.split("?")[0].split("/");
    const id = parts[parts.length - 1];
    const payload = typeof config.data === "string" ? JSON.parse(config.data || "{}") : (config.data || {});
    if (!db.users) db.users = [];
    const idx = db.users.findIndex((u: any) => u.id === id);
    if (idx !== -1) {
      db.users[idx] = { ...db.users[idx], ...payload };
      saveDb(db);
      data = db.users[idx];
    } else {
      data = { ok: true };
    }
  }
  // 5.3 Удаление пользователя (DELETE /users/:id)
  else if (url.includes("/users/") && method === "delete") {
    const parts = url.split("?")[0].split("/");
    const id = parts[parts.length - 1];
    if (!db.users) db.users = [];
    db.users = db.users.filter((u: any) => u.id !== id);
    saveDb(db);
    data = { ok: true };
  }
  // 7. Получение локаций (GET /locations)
  else if (url.includes("/locations") && method === "get") {
    data = db.locations;
  }
  // Заглушки для страниц
  else if (url.includes("/vacations") && method === "get") {
    const vs = new Date(GUEST_SEED.weekStart + "T00:00:00Z");
    vs.setUTCDate(vs.getUTCDate() + 7); // отпуск на следующей неделе
    const ve = new Date(vs); ve.setUTCDate(ve.getUTCDate() + 4);
    data = [
      { id: "v1", userId: "gu2", startDate: vs.toISOString().slice(0, 10), endDate: ve.toISOString().slice(0, 10), status: "PENDING", userName: "Мария Иванова", userColor: "#ef4444", days: 5 }
    ];
  }
  else if (url.includes("/sick-leaves") && method === "get") {
    data = [
      { id: "sl1", userId: "gu3", startDate: "2026-11-10", endDate: "2026-11-12", status: "APPROVED", userName: "Дмитрий Петров", userColor: "#8B5CF6", days: 3 }
    ];
  }
  else if (url.includes("/swaps") && method === "get") {
    data = [
      { id: "sw1", status: "PENDING", initiatorUser: { id: "gu6", name: "Анна Соколова" }, targetUser: { id: "gu4", name: "Елена Козлова" }, shiftDate: GUEST_SEED.weekStart }
    ];
  }
  else if (url.includes("/analytics") && method === "get") {
    data = { totalHours: 120, totalCost: 50000, shiftsCount: 30, chartData: [] };
  }
  else if (url.includes("/history") && method === "get") {
    data = [
      { id: "h1", action: "PUBLISH_WEEK", createdAt: new Date().toISOString(), userName: "Алексей Смирнов" }
    ];
  }
  
  // Заглушка для Табеля
  else if (url.includes("/timesheet")) {
    const tsNow = new Date();
    const tsYear = tsNow.getFullYear();
    const tsMonth = tsNow.getMonth() + 1;
    const daysInMonth = new Date(tsYear, tsMonth, 0).getDate();
    data = {
      users: GUEST_SEED.employees.map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        position: emp.position,
        paymentType: emp.paymentType,
        employmentType: emp.employmentType,
        days: Array.from({ length: daysInMonth }, (_, i) => ({
          date: `${tsYear}-${String(tsMonth).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
          cell: { status: null },
          isWeekend: false
        })),
        totalHours: 0,
        totalPayGross: 0,
        totalPayNet: 0
      })),
      daysInMonth,
      totals: { attendance: 0, hours: 0, gross: 0, tax: 0, net: 0 },
      taxRate: 13,
      timeTrackingOn: false
    };
  }
  // Для всех остальных GET-запросов возвращаем пустой массив
  else if (method === "get" && data === null) {
    data = [];
  }
  if (data === null) {
      data = method === "get" ? [] : { ok: true, mock: true };
    }

  return {
    data,
    status,
    statusText: "OK",
    headers: {},
    config,
  };
};
