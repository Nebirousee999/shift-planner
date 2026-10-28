import { db } from "./db/client.js";
import {
  organizations,
  locations,
  areas,
  users,
  userLocations,
  userAreas,
  positionTemplates,
  shiftTemplates,
  scheduleWeeks,
  scheduledShifts,
} from "./db/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import fs from "node:fs";

// ─── Настройки ─────────────────────────────────────
const ORG_NAME = "Тестовая компания";
const PASSWORD_LENGTH = 8;

const POSITION_PALETTE = [
  "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B",
  "#EF4444", "#06B6D4", "#6366F1", "#EC4899",
  "#14B8A6", "#84CC16",
];

const FIRST_NAMES_M = ["Иван", "Пётр", "Сергей", "Алексей", "Дмитрий", "Андрей", "Михаил", "Николай"];
const FIRST_NAMES_F = ["Мария", "Анна", "Елена", "Ольга", "Татьяна", "Наталья", "Ирина", "Светлана"];
const LAST_NAMES_M = ["Иванов", "Петров", "Смирнов", "Кузнецов", "Попов", "Васильев", "Соколов", "Михайлов"];
const LAST_NAMES_F = ["Иванова", "Петрова", "Смирнова", "Кузнецова", "Попова", "Васильева", "Соколова", "Михайлова"];

// ─── Утилиты ───────────────────────────────────────
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function generatePassword(length: number): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}
function generateName(gender: "M" | "F"): string {
  const first = gender === "M" ? randomItem(FIRST_NAMES_M) : randomItem(FIRST_NAMES_F);
  const last = gender === "M" ? randomItem(LAST_NAMES_M) : randomItem(LAST_NAMES_F);
  return `${first} ${last}`;
}
function generateEmail(name: string, index: number): string {
  const translit: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
    э: "e", ю: "yu", я: "ya",
  };
  const clean = name
    .toLowerCase()
    .split(" ")
    .map((part) => part.split("").map((ch) => translit[ch] ?? ch).join(""))
    .join(".");
  return `${clean}${index}@test.ru`;
}
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Все понедельники, которые пересекаются с текущим месяцем */
function getMondaysOfMonth(year: number, month: number): string[] {
  const first = new Date(Date.UTC(year, month, 1));
  const dow = first.getUTCDay(); // 0=Sun, 1=Mon
  const diff = dow === 1 ? 0 : dow === 0 ? -6 : 1 - dow;
  const firstMonday = new Date(first);
  firstMonday.setUTCDate(first.getUTCDate() + diff);

  const last = new Date(Date.UTC(year, month + 1, 0));
  const mondays: string[] = [];
  const cursor = new Date(firstMonday);
  while (cursor <= last) {
    mondays.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return mondays;
}

const MONTHS_RU = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

// ─── Спецификация сотрудников ──────────────────────
type Spec = {
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
  position: string;
  locationIdx: number[];
  areaNames: string[];
  rate: number;
};

const EMPLOYEE_SPECS: Spec[] = [
  // Руководство
  { role: "OWNER",   position: "Директор",  locationIdx: [0, 1, 2], areaNames: ["Администрация"], rate: 2000 },
  { role: "MANAGER", position: "Менеджер",  locationIdx: [0, 1],    areaNames: ["Администрация"], rate: 800 },

  // Точка 1 (Ленина)
  { role: "EMPLOYEE", position: "Повар",     locationIdx: [0], areaNames: ["Кухня"], rate: 600 },
  { role: "EMPLOYEE", position: "Повар",     locationIdx: [0], areaNames: ["Кухня"], rate: 550 },
  { role: "EMPLOYEE", position: "Кондитер",  locationIdx: [0], areaNames: ["Кухня"], rate: 500 },
  { role: "EMPLOYEE", position: "Продавец",  locationIdx: [0], areaNames: ["Торговый зал"], rate: 400 },
  { role: "EMPLOYEE", position: "Продавец",  locationIdx: [0], areaNames: ["Торговый зал"], rate: 400 },
  { role: "EMPLOYEE", position: "Кассир",    locationIdx: [0], areaNames: ["Торговый зал"], rate: 380 },
  { role: "EMPLOYEE", position: "Официант",  locationIdx: [0], areaNames: ["Торговый зал"], rate: 350 },

  // Точка 2 (ТЦ)
  { role: "EMPLOYEE", position: "Администратор", locationIdx: [1], areaNames: ["Администрация"], rate: 500 },
  { role: "EMPLOYEE", position: "Бариста",       locationIdx: [1], areaNames: ["Администрация"], rate: 450 },
  { role: "EMPLOYEE", position: "Продавец",      locationIdx: [1], areaNames: ["Администрация"], rate: 420 },

  // Точка 3 (Пушкина)
  { role: "EMPLOYEE", position: "Кладовщик", locationIdx: [2], areaNames: ["Склад"], rate: 400 },
  { role: "EMPLOYEE", position: "Курьер",    locationIdx: [2], areaNames: ["Склад"], rate: 380 },
  { role: "EMPLOYEE", position: "Уборщик",   locationIdx: [2], areaNames: ["Склад"], rate: 300 },
];

// ─── Основной скрипт ───────────────────────────────
async function main() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const monthLabel = `${MONTHS_RU[month]} ${year}`;

  console.log(`🚀 Заполнение БД «${ORG_NAME}» + расписание на ${monthLabel}\n`);

  // 1. Удаляем старую организацию
  const existing = await db
    .select()
    .from(organizations)
    .where(eq(organizations.name, ORG_NAME));
  if (existing.length > 0) {
    console.log(`🧹 Удаляем старую "${ORG_NAME}"...`);
    await db.delete(organizations).where(eq(organizations.id, existing[0].id));
  }

  // 2. Организация
  const [org] = await db
    .insert(organizations)
    .values({ name: ORG_NAME, city: "Москва", maxLocations: 5 })
    .returning();
  console.log(`✅ Организация: ${org.name}`);

  // 3. Точки
  const locationsData = [
    { name: "Точка на Ленина",    address: "ул. Ленина, 10",        city: "Москва", phone: "+7 999 111-11-11" },
    { name: "Точка в ТЦ Галерея", address: "ТЦ «Галерея», 3 этаж", city: "Москва", phone: "+7 999 222-22-22" },
    { name: "Точка на Пушкина",   address: "ул. Пушкина, 5",        city: "Москва", phone: "+7 999 333-33-33" },
  ];
  const locationsList: Array<{ id: string; name: string }> = [];
  for (const loc of locationsData) {
    const [inserted] = await db
      .insert(locations)
      .values({ orgId: org.id, ...loc })
      .returning();
    locationsList.push({ id: inserted.id, name: inserted.name });
  }
  console.log(`✅ Точек: ${locationsList.length}`);

  // 4. Локации (помещения)
  const areasData = [
    { locationIndex: 0, name: "Кухня" },
    { locationIndex: 0, name: "Торговый зал" },
    { locationIndex: 1, name: "Администрация" },
    { locationIndex: 2, name: "Склад" },
  ];
  const areasList: Array<{ id: string; name: string; locationId: string }> = [];
  for (const a of areasData) {
    const [inserted] = await db
      .insert(areas)
      .values({
        orgId: org.id,
        locationId: locationsList[a.locationIndex].id,
        name: a.name,
      })
      .returning();
    areasList.push({
      id: inserted.id,
      name: inserted.name,
      locationId: inserted.locationId,
    });
  }
  console.log(`✅ Локаций: ${areasList.length}`);

  // 5. Должности в шаблонах
  const positionsData = [
    "Директор", "Менеджер", "Продавец", "Кассир",
    "Повар", "Официант", "Бариста", "Администратор",
    "Кладовщик", "Курьер", "Уборщик", "Кондитер",
  ];
  for (let i = 0; i < positionsData.length; i++) {
    await db.insert(positionTemplates).values({
      orgId: org.id,
      name: positionsData[i],
      color: POSITION_PALETTE[i % POSITION_PALETTE.length],
    });
  }
  console.log(`✅ Должностей: ${positionsData.length}`);

  // 6. Сотрудники
  type Credential = {
    role: string; name: string; email: string; password: string;
    position: string; locations: string[]; areas: string[];
  };
  const credentials: Credential[] = [];
  const employeesByLocation = new Map<string, string[]>(); // locationId → employee IDs

  for (let i = 0; i < EMPLOYEE_SPECS.length; i++) {
    const spec = EMPLOYEE_SPECS[i];
    const gender = Math.random() > 0.5 ? "M" : "F";
    const name = generateName(gender);
    const email = generateEmail(name, i + 1);
    const plainPassword = generatePassword(PASSWORD_LENGTH);
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const [user] = await db
      .insert(users)
      .values({
        orgId: org.id,
        name,
        email,
        passwordHash,
        role: spec.role,
        position: spec.position,
        hourlyRate: spec.rate.toString(),
        phone: `+7 999 ${String(i + 1).padStart(3, "0")}-${String(i + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
      })
      .returning();

    const userLocNames: string[] = [];
    for (const idx of spec.locationIdx) {
      const locId = locationsList[idx].id;
      await db.insert(userLocations).values({ userId: user.id, locationId: locId });
      userLocNames.push(locationsList[idx].name);
      if (spec.role === "EMPLOYEE") {
        if (!employeesByLocation.has(locId)) employeesByLocation.set(locId, []);
        employeesByLocation.get(locId)!.push(user.id);
      }
    }

    const selectedLocationIds = new Set(spec.locationIdx.map((idx) => locationsList[idx].id));
    const userAreaNames: string[] = [];
    for (const areaName of spec.areaNames) {
      const area = areasList.find(
        (a) => a.name === areaName && selectedLocationIds.has(a.locationId)
      );
      if (area) {
        await db.insert(userAreas).values({ userId: user.id, areaId: area.id });
        userAreaNames.push(area.name);
      }
    }

    credentials.push({
      role: spec.role, name, email, password: plainPassword,
      position: spec.position,
      locations: userLocNames,
      areas: userAreaNames,
    });
  }
  console.log(`✅ Сотрудников: ${credentials.length}`);

  // 7. Шаблоны смен
  const morningTemplate = (
    await db
      .insert(shiftTemplates)
      .values({
        orgId: org.id,
        name: "Утренняя",
        startTime: "08:00",
        endTime: "16:00",
        color: "#3B82F6",
      })
      .returning()
  )[0];

  const eveningTemplate = (
    await db
      .insert(shiftTemplates)
      .values({
        orgId: org.id,
        name: "Вечерняя",
        startTime: "16:00",
        endTime: "23:00",
        color: "#8B5CF6",
      })
      .returning()
  )[0];

  console.log(`✅ Шаблонов смен: 2 (Утренняя 08–16, Вечерняя 16–23)`);

  // 8. Расписание на текущий месяц
  const mondays = getMondaysOfMonth(year, month);
  const monthPrefix = `${year}-${pad2(month + 1)}`;
  const hourCost = (start: string, end: string): number => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let m = eh * 60 + em - (sh * 60 + sm);
    if (m <= 0) m += 24 * 60;
    return m / 60;
  };
  const morningHours = hourCost(morningTemplate.startTime, morningTemplate.endTime);
  const eveningHours = hourCost(eveningTemplate.startTime, eveningTemplate.endTime);
  const WEEKLY_LIMIT = 40;

  let shiftsCreated = 0;
  let weeksCreated = 0;

  for (const weekStart of mondays) {
    for (const loc of locationsList) {
      const locEmployees = employeesByLocation.get(loc.id) ?? [];
      if (locEmployees.length === 0) continue;

      // неделя (PUBLISHED — чтобы сразу видны в UI)
      const [week] = await db
        .insert(scheduleWeeks)
        .values({
          orgId: org.id,
          locationId: loc.id,
          weekStartDate: weekStart,
          status: "PUBLISHED",
          publishedAt: new Date(),
        })
        .returning();
      weeksCreated++;

      // Часы по сотрудникам на эту неделю
      const hoursByUser = new Map<string, number>();
      for (const uid of locEmployees) hoursByUser.set(uid, 0);

      // Смены по дням
      for (let d = 0; d < 7; d++) {
        const dayDate = new Date(weekStart + "T00:00:00Z");
        dayDate.setUTCDate(dayDate.getUTCDate() + d);
        const dayStr = dayDate.toISOString().slice(0, 10);

        // Только дни текущего месяца
        if (!dayStr.startsWith(monthPrefix)) continue;

        const dow = dayDate.getUTCDay();
        const isWeekend = dow === 0 || dow === 6;

        // Список доступных для утра (не переваливших лимит)
        const pickFor = (shiftHours: number): string | null => {
          const candidates = locEmployees.filter(
            (uid) => (hoursByUser.get(uid) ?? 0) + shiftHours <= WEEKEND_OK(uid, isWeekend)
          );
          if (candidates.length === 0) return null;
          return candidates[Math.floor(Math.random() * candidates.length)];
        };
        // Проверка не по WEEKLY_LIMIT, а по фактическим часам + смене
        const WEEKEND_OK = (uid: string, _w: boolean) => {
          const used = hoursByUser.get(uid) ?? 0;
          // если смена утренняя/вечерняя — не более 40 ч/нед
          return WEEKLY_LIMIT;
        };

        // Утро
        const morningUserId = pickFor(morningHours);
        if (morningUserId) {
          await db.insert(scheduledShifts).values({
            weekId: week.id,
            templateId: morningTemplate.id,
            userId: morningUserId,
            shiftDate: dayStr,
            startTime: morningTemplate.startTime,
            endTime: morningTemplate.endTime,
          });
          hoursByUser.set(morningUserId, (hoursByUser.get(morningUserId) ?? 0) + morningHours);
          shiftsCreated++;
        }

        // Вечер — другой сотрудник (не тот же, что утром)
        const eveningCandidates = locEmployees.filter(
          (uid) =>
            uid !== morningUserId &&
            (hoursByUser.get(uid) ?? 0) + eveningHours <= WEEKLY_LIMIT
        );
        const eveningUserId =
          eveningCandidates.length > 0
            ? eveningCandidates[Math.floor(Math.random() * eveningCandidates.length)]
            : null;
        if (eveningUserId) {
          await db.insert(scheduledShifts).values({
            weekId: week.id,
            templateId: eveningTemplate.id,
            userId: eveningUserId,
            shiftDate: dayStr,
            startTime: eveningTemplate.startTime,
            endTime: eveningTemplate.endTime,
          });
          hoursByUser.set(eveningUserId, (hoursByUser.get(eveningUserId) ?? 0) + eveningHours);
          shiftsCreated++;
        }

        // В пятницу/субботу иногда добавляем ещё одну вечернюю
        if ((dow === 5 || dow === 6) && Math.random() < 0.5) {
          const extraCandidates = locEmployees.filter(
            (uid) =>
              uid !== morningUserId &&
              uid !== eveningUserId &&
              (hoursByUser.get(uid) ?? 0) + eveningHours <= WEEKLY_LIMIT
          );
          if (extraCandidates.length > 0) {
            const extraUserId = extraCandidates[Math.floor(Math.random() * extraCandidates.length)];
            await db.insert(scheduledShifts).values({
              weekId: week.id,
              templateId: eveningTemplate.id,
              userId: extraUserId,
              shiftDate: dayStr,
              startTime: eveningTemplate.startTime,
              endTime: eveningTemplate.endTime,
            });
            hoursByUser.set(extraUserId, (hoursByUser.get(extraUserId) ?? 0) + eveningHours);
            shiftsCreated++;
          }
        }
      }
    }
  }

  console.log(`✅ Недель: ${weeksCreated}`);
  console.log(`✅ Смен: ${shiftsCreated}`);

  // 9. Файл паролей
  const lines: string[] = [
    `=== УЧЁТНЫЕ ДАННЫЕ ===`,
    `Организация: ${ORG_NAME}`,
    `Расписание на: ${monthLabel}`,
    `Дата генерации: ${new Date().toLocaleString("ru-RU")}`,
    ``,
    `Всего сотрудников: ${credentials.length}`,
    `Точек: ${locationsList.length}`,
    `Локаций: ${areasList.length}`,
    `Должностей в шаблонах: ${positionsData.length}`,
    `Шаблонов смен: 2 (Утренняя 08:00–16:00, Вечерняя 16:00–23:00)`,
    `Недель: ${weeksCreated}`,
    `Смен: ${shiftsCreated}`,
    ``,
    `Вход: http://localhost:5173/login`,
    ``,
    `─────────────────────────────────────────────`,
    ``,
  ];

  for (const c of credentials) {
    lines.push(`[${c.role}] ${c.name}`);
    lines.push(`  Email:      ${c.email}`);
    lines.push(`  Пароль:     ${c.password}`);
    lines.push(`  Должность:  ${c.position}`);
    lines.push(`  Точки:      ${c.locations.join(", ")}`);
    lines.push(`  Локации:    ${c.areas.length > 0 ? c.areas.join(", ") : "—"}`);
    lines.push(``);
  }

  const text = lines.join("\n");
  fs.writeFileSync("passwords.txt", text, "utf-8");

  console.log(`\n📄 Пароли сохранены в passwords.txt`);
  console.log(`\n${text}`);
  console.log(`\n🎉 Готово! Войдите под любым аккаунтом.`);
  console.log(`   Владелец — полный доступ (начните с него).\n`);

  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Ошибка:", e);
  process.exit(1);
});