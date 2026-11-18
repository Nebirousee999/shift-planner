import type { AxiosAdapter, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// Инициализация пустой базы
const initDb = () => {
  if (!localStorage.getItem("guest_db")) {
    localStorage.setItem("guest_db", JSON.stringify({
      weeks: [{
        id: "guest-week",
        weekStartDate: new Date().toISOString().slice(0, 10),
        status: "DRAFT",
        shifts: [],
      }],
      users: [
        { id: "u1", name: "Сотрудник 1", position: "Официант", hourlyRate: "300", locationIds: ["loc1"], areaIds: [] },
        { id: "u2", name: "Сотрудник 2", position: "Повар", hourlyRate: "400", locationIds: ["loc1"], areaIds: [] },
        { id: "u3", name: "Сотрудник 3", position: "Бариста", hourlyRate: "350", locationIds: ["loc1"], areaIds: [] }
      ],
      templates: [
        { id: "t1", name: "Утренняя", startTime: "09:00", endTime: "18:00", color: "#3B82F6" },
        { id: "t2", name: "Вечерняя", startTime: "14:00", endTime: "23:00", color: "#F59E0B" }
      ],
      locations: [
        { id: "loc1", name: "Основная точка" }
      ]
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

  // 1. Получение недели (GET /weeks/:id)
  if (url.includes("/weeks/") && method === "get") {
    data = db.weeks[0];
  }
  // 2. Публикация недели (POST /weeks/:id/publish)
  else if (url.includes("/publish") && method === "post") {
    db.weeks[0].status = "PUBLISHED";
    saveDb(db);
    data = { ok: true };
  }
  // 3. Добавление смены (POST /shifts)
  else if (url.includes("/shifts") && method === "post") {
    const payload = JSON.parse(config.data);
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
  // 6. Получение шаблонов (GET /templates)
  else if (url.includes("/templates") && method === "get") {
    data = db.templates;
  }
  // 7. Получение локаций (GET /locations)
  else if (url.includes("/locations") && method === "get") {
    data = db.locations;
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
