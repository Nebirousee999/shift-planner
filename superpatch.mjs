// superpatch.mjs
// Правка: Добавление кухни (зон), новых поваров и опозданий на текущий день.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const normalizeLF = (s) => s.replace(/\r\n/g, "\n");

function patchFile(relPath, replacements) {
  const filePath = resolve(process.cwd(), relPath);
  if (!existsSync(filePath)) {
    console.error(`✗ Файл не найден: ${relPath}`);
    process.exit(1);
  }

  const raw = readFileSync(filePath, "utf8");
  const hadCRLF = raw.includes("\r\n");
  let content = normalizeLF(raw);
  let applied = 0;

  for (const [from, to] of replacements) {
    const fromN = normalizeLF(from);
    const toN = normalizeLF(to);
    if (!content.includes(fromN)) {
      console.error(`✗ Паттерн не найден в ${relPath}:`);
      console.error("---");
      console.error(from);
      console.error("---");
      process.exit(1);
    }
    content = content.replace(fromN, toN);
    applied++;
  }

  const finalContent = hadCRLF ? content.replace(/\n/g, "\r\n") : content;
  writeFileSync(filePath, finalContent, "utf8");
  console.log(`✓ ${relPath} — применено замен: ${applied}`);
}

// ─── 1. ФРОНТЕНД: guestSeed.ts ───────────────────────────────────
patchFile("frontend/src/lib/guestSeed.ts", [
  // 1.1 Добавляем типы и структуру зон (Areas)
  [
    `export type GuestTemplate = { id: string; name: string; startTime: string; endTime: string; color: string };`,
    `export type GuestArea = { id: string; orgId: string; locationId: string; name: string };
export type GuestTemplate = { id: string; name: string; startTime: string; endTime: string; color: string };`
  ],
  // 1.2 Добавляем latenessMinutes в тип смены
  [
    `export type GuestShift = { id: string; weekId: string; templateId: string; userId: string; shiftDate: string; startTime: string; endTime: string; status: string };`,
    `export type GuestShift = { id: string; weekId: string; templateId: string; userId: string; shiftDate: string; startTime: string; endTime: string; status: string; latenessMinutes?: number; earlyLeaveMinutes?: number; };`
  ],
  // 1.3 Обновляем сотрудников (добавляем поваров и привязываем к зонам)
  [
    `const EMPLOYEES: GuestEmployee[] = [
  { id: "gu1", name: "Алексей Смирнов", email: "alex@guest.ru", phone: null, role: "OWNER", position: "Управляющий", hourlyRate: "600", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#3b82f6", tempPassword: null, isTempPasswordSent: false },
  { id: "gu2", name: "Мария Иванова", email: "maria@guest.ru", phone: null, role: "MANAGER", position: "Шеф-повар", hourlyRate: "550", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#ef4444", tempPassword: null, isTempPasswordSent: false },
  { id: "gu3", name: "Дмитрий Петров", email: "dmitry@guest.ru", phone: null, role: "EMPLOYEE", position: "Бармен", hourlyRate: "450", createdAt: new Date().toISOString(), locationIds: ["gloc1", "gloc3"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#8b5cf6", tempPassword: null, isTempPasswordSent: false },
  { id: "gu4", name: "Елена Козлова", email: "elena@guest.ru", phone: null, role: "EMPLOYEE", position: "Официант", hourlyRate: "400", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#f59e0b", tempPassword: null, isTempPasswordSent: false },
  { id: "gu5", name: "Сергей Волков", email: "sergey@guest.ru", phone: null, role: "EMPLOYEE", position: "Повар", hourlyRate: "450", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#10b981", tempPassword: null, isTempPasswordSent: false },
  { id: "gu6", name: "Анна Соколова", email: "anna.s@guest.ru", phone: null, role: "EMPLOYEE", position: "Официант", hourlyRate: "400", createdAt: new Date().toISOString(), locationIds: ["gloc2"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#ec4899", tempPassword: null, isTempPasswordSent: false },
  { id: "gu7", name: "Иван Морозов", email: "ivan@guest.ru", phone: null, role: "EMPLOYEE", position: "Официант", hourlyRate: "400", createdAt: new Date().toISOString(), locationIds: ["gloc3"], areaIds: [], paymentType: "HOURLY", employmentType: "GPH", color: "#06b6d4", tempPassword: null, isTempPasswordSent: false },
  { id: "gu8", name: "Ольга Новикова", email: "olga@guest.ru", phone: null, role: "EMPLOYEE", position: "Хостес", hourlyRate: "350", createdAt: new Date().toISOString(), locationIds: ["gloc1", "gloc2"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#6366f1", tempPassword: null, isTempPasswordSent: false },
  { id: "gu9", name: "Павел Зайцев", email: "pavel@guest.ru", phone: null, role: "EMPLOYEE", position: "Кальянщик", hourlyRate: "500", createdAt: new Date().toISOString(), locationIds: ["gloc3"], areaIds: [], paymentType: "HOURLY", employmentType: "GPH", color: "#84cc16", tempPassword: null, isTempPasswordSent: false },
  { id: "gu10", name: "Виктория Павлова", email: "vika@guest.ru", phone: null, role: "EMPLOYEE", position: "Уборщик", hourlyRate: "300", createdAt: new Date().toISOString(), locationIds: ["gloc1", "gloc2", "gloc3"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#f97316", tempPassword: null, isTempPasswordSent: false },
];`,
    `const AREAS: GuestArea[] = [
  { id: "garea1", orgId: "gorg", locationId: "gloc1", name: "Кухня" },
  { id: "garea2", orgId: "gorg", locationId: "gloc1", name: "Зал" },
  { id: "garea3", orgId: "gorg", locationId: "gloc1", name: "Бар" },
];

const EMPLOYEES: GuestEmployee[] = [
  { id: "gu1", name: "Алексей Смирнов", email: "alex@guest.ru", phone: null, role: "OWNER", position: "Управляющий", hourlyRate: "600", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: ["garea2"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#3b82f6", tempPassword: null, isTempPasswordSent: false },
  { id: "gu2", name: "Мария Иванова", email: "maria@guest.ru", phone: null, role: "MANAGER", position: "Шеф-повар", hourlyRate: "550", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: ["garea1"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#ef4444", tempPassword: null, isTempPasswordSent: false },
  { id: "gu3", name: "Дмитрий Петров", email: "dmitry@guest.ru", phone: null, role: "EMPLOYEE", position: "Бармен", hourlyRate: "450", createdAt: new Date().toISOString(), locationIds: ["gloc1", "gloc3"], areaIds: ["garea3"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#8b5cf6", tempPassword: null, isTempPasswordSent: false },
  { id: "gu4", name: "Елена Козлова", email: "elena@guest.ru", phone: null, role: "EMPLOYEE", position: "Официант", hourlyRate: "400", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: ["garea2"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#f59e0b", tempPassword: null, isTempPasswordSent: false },
  { id: "gu5", name: "Сергей Волков", email: "sergey@guest.ru", phone: null, role: "EMPLOYEE", position: "Повар", hourlyRate: "450", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: ["garea1"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#10b981", tempPassword: null, isTempPasswordSent: false },
  { id: "gu6", name: "Анна Соколова", email: "anna.s@guest.ru", phone: null, role: "EMPLOYEE", position: "Официант", hourlyRate: "400", createdAt: new Date().toISOString(), locationIds: ["gloc2"], areaIds: ["garea2"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#ec4899", tempPassword: null, isTempPasswordSent: false },
  { id: "gu7", name: "Иван Морозов", email: "ivan@guest.ru", phone: null, role: "EMPLOYEE", position: "Официант", hourlyRate: "400", createdAt: new Date().toISOString(), locationIds: ["gloc3"], areaIds: ["garea2"], paymentType: "HOURLY", employmentType: "GPH", color: "#06b6d4", tempPassword: null, isTempPasswordSent: false },
  { id: "gu8", name: "Ольга Новикова", email: "olga@guest.ru", phone: null, role: "EMPLOYEE", position: "Хостес", hourlyRate: "350", createdAt: new Date().toISOString(), locationIds: ["gloc1", "gloc2"], areaIds: ["garea2"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#6366f1", tempPassword: null, isTempPasswordSent: false },
  { id: "gu9", name: "Павел Зайцев", email: "pavel@guest.ru", phone: null, role: "EMPLOYEE", position: "Кальянщик", hourlyRate: "500", createdAt: new Date().toISOString(), locationIds: ["gloc3"], areaIds: ["garea2"], paymentType: "HOURLY", employmentType: "GPH", color: "#84cc16", tempPassword: null, isTempPasswordSent: false },
  { id: "gu10", name: "Виктория Павлова", email: "vika@guest.ru", phone: null, role: "EMPLOYEE", position: "Уборщик", hourlyRate: "300", createdAt: new Date().toISOString(), locationIds: ["gloc1", "gloc2", "gloc3"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#f97316", tempPassword: null, isTempPasswordSent: false },
  { id: "gu11", name: "Андрей Николаев", email: "andrey@guest.ru", phone: null, role: "EMPLOYEE", position: "Су-шеф", hourlyRate: "500", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: ["garea1"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#14b8a6", tempPassword: null, isTempPasswordSent: false },
  { id: "gu12", name: "Кристина Белова", email: "kristina@guest.ru", phone: null, role: "EMPLOYEE", position: "Повар", hourlyRate: "450", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: ["garea1"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#a855f7", tempPassword: null, isTempPasswordSent: false },
];`
  ],
  // 1.4 Добавляем опоздания в генератор смен
  [
    `// Генерируем график на 4 недели (28 дней) для 10 сотрудников
for (let d = 0; d < 28; d++) {
  // Алексей (5/2, дневная)
  if (d % 7 < 5) pushShift(d, "gu1", "gt4");
  // Мария (5/2, утренняя)
  if (d % 7 < 5) pushShift(d, "gu2", "gt1");
  // Дмитрий (2/2, вечерняя)
  if (d % 4 < 2) pushShift(d, "gu3", "gt2");
  // Елена (2/2, дневная)
  if (d % 4 >= 2) pushShift(d, "gu4", "gt4");
  // Сергей (3/3, вечерняя)
  if (d % 6 < 3) pushShift(d, "gu5", "gt2");
  // Анна С. (2/2, утренняя)
  if (d % 4 < 2) pushShift(d, "gu6", "gt1");
  // Иван (2/2, ночная)
  if (d % 4 >= 2) pushShift(d, "gu7", "gt3");
  // Ольга (5/2, дневная)
  if (d % 7 >= 2) pushShift(d, "gu8", "gt4");
  // Павел (2/2, вечерняя)
  if (d % 4 < 2) pushShift(d, "gu9", "gt2");
  // Виктория (2/2, утренняя)
  if (d % 4 >= 2) pushShift(d, "gu10", "gt1");
}`,
    `// Генерируем график на 4 недели (28 дней) для 12 сотрудников
// Определяем, какой сегодня день недели (0 - Пн, 6 - Вс)
const today = new Date();
const todayOffset = (today.getDay() === 0 ? 6 : today.getDay() - 1);

function pushShiftWithLateness(dayOffset: number, userId: string, templateId: string) {
  const tpl = TEMPLATES.find((t) => t.id === templateId)!;
  const shift: GuestShift = {
    id: \`gshift-\${SHIFTS.length + 1}\`,
    weekId: WEEK_ID,
    templateId,
    userId,
    shiftDate: addDays(WEEK_START, dayOffset),
    startTime: tpl.startTime,
    endTime: tpl.endTime,
    status: "SCHEDULED",
  };
  
  // Если это сегодняшний день, добавляем опоздания для некоторых
  if (dayOffset === todayOffset) {
    if (userId === "gu1" || userId === "gu5") {
      shift.latenessMinutes = 15; // Опоздание на 15 минут
    }
    if (userId === "gu3") {
      shift.latenessMinutes = 30; // Опоздание на 30 минут
    }
  }
  
  SHIFTS.push(shift);
}

for (let d = 0; d < 28; d++) {
  // Алексей (5/2, дневная)
  if (d % 7 < 5) pushShiftWithLateness(d, "gu1", "gt4");
  // Мария (5/2, утренняя)
  if (d % 7 < 5) pushShiftWithLateness(d, "gu2", "gt1");
  // Дмитрий (2/2, вечерняя)
  if (d % 4 < 2) pushShiftWithLateness(d, "gu3", "gt2");
  // Елена (2/2, дневная)
  if (d % 4 >= 2) pushShiftWithLateness(d, "gu4", "gt4");
  // Сергей (3/3, вечерняя)
  if (d % 6 < 3) pushShiftWithLateness(d, "gu5", "gt2");
  // Анна С. (2/2, утренняя)
  if (d % 4 < 2) pushShiftWithLateness(d, "gu6", "gt1");
  // Иван (2/2, ночная)
  if (d % 4 >= 2) pushShiftWithLateness(d, "gu7", "gt3");
  // Ольга (5/2, дневная)
  if (d % 7 >= 2) pushShiftWithLateness(d, "gu8", "gt4");
  // Павел (2/2, вечерняя)
  if (d % 4 < 2) pushShiftWithLateness(d, "gu9", "gt2");
  // Виктория (2/2, утренняя)
  if (d % 4 >= 2) pushShiftWithLateness(d, "gu10", "gt1");
  
  // Новые повара (2/2)
  if (d % 4 < 2) pushShiftWithLateness(d, "gu11", "gt1");
  if (d % 4 >= 2) pushShiftWithLateness(d, "gu12", "gt2");
}`
  ],
  // 1.5 Экспортируем AREAS
  [
    `  locations: LOCATIONS,
  templates: TEMPLATES,
  shifts: SHIFTS,`,
    `  locations: LOCATIONS,
  areas: AREAS,
  templates: TEMPLATES,
  shifts: SHIFTS,`
  ]
]);

// ─── 2. ФРОНТЕНД: guestAdapter.ts (Обновляем версию БД) ───────────
patchFile("frontend/src/api/guestAdapter.ts", [
  [
    `const initDb = () => {
  if (!localStorage.getItem("guest_db") || localStorage.getItem("guest_db_version") !== "4") {
    localStorage.setItem("guest_db_version", "4");`,
    `const initDb = () => {
  if (!localStorage.getItem("guest_db") || localStorage.getItem("guest_db_version") !== "5") {
    localStorage.setItem("guest_db_version", "5");`
  ]
]);

console.log("\nПравка применена успешно.");