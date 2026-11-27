// frontend/src/lib/guestSeed.ts
// Единый источник данных для гостевого режима.
// Используется в: App.tsx, useGuestMode.ts, GuestApp.tsx, guestAdapter.ts, api/client.ts.

export type GuestEmployee = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
  position: string;
  hourlyRate: string;
  createdAt: string;
  locationIds: string[];
  areaIds: string[];
  paymentType: "HOURLY" | "MONTHLY";
  employmentType: "GPH" | "SHTAT";
  color: string;
  tempPassword: string | null;
  isTempPasswordSent: boolean;
};

export type GuestArea = { id: string; orgId: string; locationId: string; name: string };
export type GuestTemplate = { id: string; name: string; startTime: string; endTime: string; color: string };
export type GuestLocation = { id: string; name: string; orgId: string };
export type GuestShift = { id: string; weekId: string; templateId: string; userId: string; shiftDate: string; startTime: string; endTime: string; status: string; latenessMinutes?: number; earlyLeaveMinutes?: number; };

function getMonday(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const CURRENT_MONDAY = getMonday();
const SEED_START = addDays(CURRENT_MONDAY, -42); // Начинаем 6 недель назад
const WEEK_ID = "guest-week-7"; // Текущая неделя - седьмая по счету

const POSITIONS = [
  { id: "pos1", name: "Управляющий", color: "#3b82f6" },
  { id: "pos2", name: "Шеф-повар", color: "#ef4444" },
  { id: "pos3", name: "Бармен", color: "#8b5cf6" },
  { id: "pos4", name: "Официант", color: "#f59e0b" },
  { id: "pos5", name: "Повар", color: "#10b981" },
];

const AREAS: GuestArea[] = [
  { id: "garea1", orgId: "gorg", locationId: "gloc1", name: "Кухня" },
  { id: "garea2", orgId: "gorg", locationId: "gloc1", name: "Зал" },
  { id: "garea3", orgId: "gorg", locationId: "gloc1", name: "Бар" },
];

const EMPLOYEES: GuestEmployee[] = [
  { id: "gu1", name: "Алексей Смирнов", email: "alex@guest.ru", phone: null, role: "OWNER", position: "Управляющий", hourlyRate: "600", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: ["garea2"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#3b82f6", tempPassword: null, isTempPasswordSent: false },
  { id: "gu2", name: "Мария Иванова", email: "maria@guest.ru", phone: null, role: "MANAGER", position: "Шеф-повар", hourlyRate: "550", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: ["garea1"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#ef4444", tempPassword: null, isTempPasswordSent: false },
  { id: "gu3", name: "Дмитрий Петров", email: "dmitry@guest.ru", phone: null, role: "EMPLOYEE", position: "Бармен", hourlyRate: "450", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: ["garea3"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#8b5cf6", tempPassword: null, isTempPasswordSent: false },
  { id: "gu4", name: "Елена Козлова", email: "elena@guest.ru", phone: null, role: "EMPLOYEE", position: "Официант", hourlyRate: "400", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: ["garea2"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#f59e0b", tempPassword: null, isTempPasswordSent: false },
  { id: "gu5", name: "Сергей Волков", email: "sergey@guest.ru", phone: null, role: "EMPLOYEE", position: "Повар", hourlyRate: "450", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: ["garea1"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#10b981", tempPassword: null, isTempPasswordSent: false },
  { id: "gu6", name: "Анна Соколова", email: "anna.s@guest.ru", phone: null, role: "EMPLOYEE", position: "Официант", hourlyRate: "400", createdAt: new Date().toISOString(), locationIds: ["gloc2"], areaIds: ["garea2"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#ec4899", tempPassword: null, isTempPasswordSent: false },
  { id: "gu7", name: "Иван Морозов", email: "ivan@guest.ru", phone: null, role: "EMPLOYEE", position: "Официант", hourlyRate: "400", createdAt: new Date().toISOString(), locationIds: ["gloc3"], areaIds: ["garea2"], paymentType: "HOURLY", employmentType: "GPH", color: "#06b6d4", tempPassword: null, isTempPasswordSent: false },
  { id: "gu8", name: "Ольга Новикова", email: "olga@guest.ru", phone: null, role: "EMPLOYEE", position: "Хостес", hourlyRate: "350", createdAt: new Date().toISOString(), locationIds: ["gloc1", "gloc2"], areaIds: ["garea2"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#6366f1", tempPassword: null, isTempPasswordSent: false },
  { id: "gu9", name: "Павел Зайцев", email: "pavel@guest.ru", phone: null, role: "EMPLOYEE", position: "Кальянщик", hourlyRate: "500", createdAt: new Date().toISOString(), locationIds: ["gloc3"], areaIds: ["garea2"], paymentType: "HOURLY", employmentType: "GPH", color: "#84cc16", tempPassword: null, isTempPasswordSent: false },
  { id: "gu10", name: "Виктория Павлова", email: "vika@guest.ru", phone: null, role: "EMPLOYEE", position: "Уборщик", hourlyRate: "300", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#f97316", tempPassword: null, isTempPasswordSent: false },
  { id: "gu11", name: "Андрей Николаев", email: "andrey@guest.ru", phone: null, role: "EMPLOYEE", position: "Су-шеф", hourlyRate: "500", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: ["garea1"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#14b8a6", tempPassword: null, isTempPasswordSent: false },
  { id: "gu12", name: "Кристина Белова", email: "kristina@guest.ru", phone: null, role: "EMPLOYEE", position: "Повар", hourlyRate: "450", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: ["garea1"], paymentType: "HOURLY", employmentType: "SHTAT", color: "#a855f7", tempPassword: null, isTempPasswordSent: false },
].map(u => ({ ...u, locationIds: ["gloc1"] }));



const LOCATIONS: GuestLocation[] = [
  { id: "gloc1", name: "Основная точка", orgId: "gorg" },
];

const TEMPLATES: GuestTemplate[] = [
  { id: "gt1", name: "Утренняя (08-16)", startTime: "08:00", endTime: "16:00", color: "#f59e0b" },
  { id: "gt2", name: "Вечерняя (16-00)", startTime: "16:00", endTime: "00:00", color: "#8b5cf6" },
  { id: "gt3", name: "Ночная (00-08)", startTime: "00:00", endTime: "08:00", color: "#1e293b" },
  { id: "gt4", name: "Дневная (10-22)", startTime: "10:00", endTime: "22:00", color: "#3b82f6" },
];

const SHIFTS: GuestShift[] = [];
const todayStr = new Date().toISOString().slice(0, 10);
const todayOffset = Math.round((new Date(todayStr).getTime() - new Date(SEED_START).getTime()) / (1000 * 60 * 60 * 24));

function pushShift(dayOffset: number, userId: string, templateId: string) {
  const tpl = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];
  
  const weekIdx = Math.floor(dayOffset / 7) + 1;
  const shift: GuestShift = {
    id: `gshift-${SHIFTS.length + 1}`,
    weekId: `guest-week-${weekIdx}`,
    templateId: tpl.id,
    userId,
    shiftDate: addDays(SEED_START, dayOffset),
    startTime: tpl.startTime,
    endTime: tpl.endTime,
    status: "SCHEDULED",
  };
  
  if (dayOffset === todayOffset) {
    if (userId === "gu2") shift.latenessMinutes = 12; // утренняя 08:00-16:00
    if (userId === "gu4") shift.latenessMinutes = 25; // дневная 10:00-22:00
  }
  
  SHIFTS.push(shift);
}

for (let d = 0; d < 70; d++) {
  if (d % 7 < 5) pushShift(d, "gu1", "gt4");
  if (d % 7 < 5) pushShift(d, "gu2", "gt1");
  if (d % 4 < 2) pushShift(d, "gu3", "gt2");
  if (d % 4 >= 2) pushShift(d, "gu4", "gt4");
  if (d % 6 < 3) pushShift(d, "gu5", "gt2");
  if (d % 4 < 2) pushShift(d, "gu6", "gt1");
  if (d % 4 >= 2) pushShift(d, "gu7", "gt3");
  if (d % 7 >= 2) pushShift(d, "gu8", "gt4");
  if (d % 4 < 2) pushShift(d, "gu9", "gt2");
  if (d % 4 >= 2) pushShift(d, "gu10", "gt1");
  if (d % 4 < 2) pushShift(d, "gu11", "gt1");
  if (d % 4 >= 2) pushShift(d, "gu12", "gt2");
}

// Собираем неделю из сгенерированных смен, чтобы демо-режим работал корректно
const WEEKS = Array.from({ length: 10 }).map((_, i) => {
  const start = addDays(SEED_START, i * 7);
  const end = addDays(start, 6);
  return {
    id: `guest-week-${i + 1}`,
    weekStartDate: start,
    status: i >= 7 ? "DRAFT" : "PUBLISHED",
    shifts: SHIFTS.filter(s => s.shiftDate >= start && s.shiftDate <= end),
  };
});

export const GUEST_SEED = {
  weekId: WEEK_ID,
  weekStart: WEEKS[6].weekStartDate,
  employees: EMPLOYEES,
  locations: LOCATIONS,
  areas: AREAS,
  positions: POSITIONS,
  templates: TEMPLATES,
  weeks: WEEKS,
  shifts: WEEKS.find(w => w.id === WEEK_ID)?.shifts || [],
  organization: {
    id: "gorg", name: "Моя компания", city: null, directorName: null, inn: null, legalAddress: null,
    timeTrackingEnabled: false, createdAt: new Date().toISOString(), maxLocations: 5,
    positionHeaderOpacity: 70, positionRowOpacity: 20, taxRate: "13", tariffId: "pro",
    trialEndsAt: null, tariffExpiresAt: null, requireShiftApproval: true, disciplineEditWindowDays: 3,
  },
  me: {
    id: "gu1", name: "Алексей Смирнов", role: "OWNER", email: "alex@guest.ru", orgId: "gorg",
    position: "Управляющий", hourlyRate: "600", phone: null, createdAt: new Date().toISOString(), locationIds: ["gloc1"],
  },
};
