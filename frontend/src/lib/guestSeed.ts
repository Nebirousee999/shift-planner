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

export type GuestTemplate = { id: string; name: string; startTime: string; endTime: string; color: string };
export type GuestLocation = { id: string; name: string; orgId: string };
export type GuestShift = { id: string; weekId: string; templateId: string; userId: string; shiftDate: string; startTime: string; endTime: string; status: string };

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

const WEEK_START = getMonday();
const WEEK_ID = "guest-week-1";

const EMPLOYEES: GuestEmployee[] = [
  { id: "gu1", name: "Анна Смирнова", email: "anna@guest.ru", phone: null, role: "OWNER", position: "Повар", hourlyRate: "450", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#F59E0B", tempPassword: null, isTempPasswordSent: false },
  { id: "gu2", name: "Дмитрий Козлов", email: "dmitry@guest.ru", phone: null, role: "EMPLOYEE", position: "Кассир", hourlyRate: "400", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#F59E0B", tempPassword: null, isTempPasswordSent: false },
  { id: "gu3", name: "Елена Волкова", email: "elena@guest.ru", phone: null, role: "EMPLOYEE", position: "Официант", hourlyRate: "350", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#8B5CF6", tempPassword: null, isTempPasswordSent: false },
];

const LOCATIONS: GuestLocation[] = [
  { id: "gloc1", name: "Основная точка", orgId: "gorg" },
  { id: "gloc2", name: "Вторая точка", orgId: "gorg" },
];

const TEMPLATES: GuestTemplate[] = [
  { id: "gt1", name: "Дневная", startTime: "08:00", endTime: "16:00", color: "#F59E0B" },
  { id: "gt2", name: "Вечерняя", startTime: "16:00", endTime: "22:00", color: "#8B5CF6" },
];

const SHIFTS: GuestShift[] = [];
function pushShift(dayOffset: number, userId: string, templateId: string) {
  const tpl = TEMPLATES.find((t) => t.id === templateId)!;
  SHIFTS.push({
    id: `gshift-${SHIFTS.length + 1}`,
    weekId: WEEK_ID,
    templateId,
    userId,
    shiftDate: addDays(WEEK_START, dayOffset),
    startTime: tpl.startTime,
    endTime: tpl.endTime,
    status: "SCHEDULED",
  });
}
// Пн (16)
pushShift(0, "gu1", "gt1"); // Анна 08-16
pushShift(0, "gu3", "gt2"); // Елена 16-22
// Вт (17)
pushShift(1, "gu1", "gt1"); // Анна 08-16
pushShift(1, "gu2", "gt2"); // Дмитрий 16-22
// Ср (18)
pushShift(2, "gu2", "gt1"); // Дмитрий 08-16
pushShift(2, "gu3", "gt1"); // Елена 08-16
pushShift(2, "gu1", "gt2"); // Анна 16-22
// Чт (19)
pushShift(3, "gu3", "gt1"); // Елена 08-16
// Пт (20)
pushShift(4, "gu1", "gt1"); // Анна 08-16
pushShift(4, "gu2", "gt1"); // Дмитрий 08-16
pushShift(4, "gu3", "gt2"); // Елена 16-22
// Сб (21)
pushShift(5, "gu2", "gt1"); // Дмитрий 08-16
pushShift(5, "gu3", "gt2"); // Елена 16-22
// Вс (22)
pushShift(6, "gu1", "gt1"); // Анна 08-16
pushShift(6, "gu2", "gt1"); // Дмитрий 08-16
pushShift(6, "gu3", "gt2"); // Елена 16-22

export const GUEST_SEED = {
  weekId: WEEK_ID,
  weekStart: WEEK_START,
  employees: EMPLOYEES,
  locations: LOCATIONS,
  templates: TEMPLATES,
  shifts: SHIFTS,
  organization: {
    id: "gorg", name: "Моя компания", city: null, directorName: null, inn: null, legalAddress: null,
    timeTrackingEnabled: false, createdAt: new Date().toISOString(), maxLocations: 5,
    positionHeaderOpacity: 70, positionRowOpacity: 20, taxRate: "13", tariffId: "pro",
    trialEndsAt: null, tariffExpiresAt: null, requireShiftApproval: true, disciplineEditWindowDays: 3,
  },
  me: {
    id: "gu1", name: "Анна Смирнова", role: "OWNER", email: "anna@guest.ru", orgId: "gorg",
    position: "Повар", hourlyRate: "450", phone: null, createdAt: new Date().toISOString(),
  },
};
