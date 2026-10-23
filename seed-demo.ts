import { db } from "./db/client.js";
import {
  organizations,
  locations,
  users,
  userLocations,
  shiftTemplates,
  scheduleWeeks,
  scheduledShifts,
} from "./db/schema.js";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import fs from "node:fs";

// ─── Настройки ─────────────────────────────────────
const ORG_NAME = "Кафе Демо";
const PASSWORD_LENGTH = 8;

const FIRST_NAMES_M = ["Иван", "Пётр", "Сергей", "Алексей", "Дмитрий", "Андрей", "Михаил", "Николай", "Владимир", "Егор"];
const FIRST_NAMES_F = ["Мария", "Анна", "Елена", "Ольга", "Татьяна", "Наталья", "Ирина", "Светлана", "Юлия", "Екатерина"];
const LAST_NAMES_M = ["Иванов", "Петров", "Смирнов", "Кузнецов", "Попов", "Васильев", "Соколов", "Михайлов", "Новиков", "Фёдоров"];
const LAST_NAMES_F = ["Иванова", "Петрова", "Смирнова", "Кузнецова", "Попова", "Васильева", "Соколова", "Михайлова", "Новикова", "Фёдорова"];

const POSITIONS = ["повар", "официант", "бариста", "администратор", "уборщик", "менеджер зала"];
const RATES = [350, 400, 450, 500, 300, 600];

// ─── Утилиты ───────────────────────────────────────
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePassword(length: number): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
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
  return `${clean}${index}@demo.ru`;
}

// Возвращает следующий понедельник строго в UTC, чтобы избежать сдвига часовых поясов
function getNextMondayUtc(): Date {
  const today = new Date();
  // Берем локальную дату (год, месяц, день) и создаем из нее UTC-дату
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const dayOfWeek = todayUtc.getUTCDay(); // 0=Sun, 1=Mon
  // Если сегодня понедельник, берем следующий (7 дней), иначе ищем ближайший
  const diff = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7; 
  const nextMonday = new Date(todayUtc);
  nextMonday.setUTCDate(todayUtc.getUTCDate() + diff);
  return nextMonday;
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ─── Основной скрипт ───────────────────────────────
async function main() {
  console.log("🚀 Начинаем заполнение базы демо-данными...");

  const existingOrg = await db.select().from(organizations).where(eq(organizations.name, ORG_NAME));
  if (existingOrg.length > 0) {
    console.log(`🧹 Удаляем старую организацию "${ORG_NAME}"...`);
    await db.delete(organizations).where(eq(organizations.id, existingOrg[0].id));
  }

  const [org] = await db.insert(organizations).values({
    name: ORG_NAME,
    city: "Москва",
    directorName: "Иванов Иван Иванович",
    inn: "7701234567",
    legalAddress: "г. Москва, ул. Ленина, д. 1",
    maxLocations: 5,
  }).returning();
  console.log(`✅ Организация создана: ${org.name}`);

  const locationsData = [
    { name: "Точка на Ленина", address: "ул. Ленина, 10", city: "Москва", phone: "+7 999 111-11-11" },
    { name: "Точка в ТЦ", address: "ТЦ «Галерея», 3 этаж", city: "Москва", phone: "+7 999 222-22-22" },
    { name: "Точка на Пушкина", address: "ул. Пушкина, 5", city: "Москва", phone: "+7 999 333-33-33" },
  ];

  const locationsList = [];
  for (const loc of locationsData) {
    const [inserted] = await db.insert(locations).values({
      orgId: org.id,
      name: loc.name,
      address: loc.address,
      city: loc.city,
      phone: loc.phone,
    }).returning();
    locationsList.push(inserted);
    console.log(`✅ Точка создана: ${inserted.name}`);
  }

  const templatesData = [
    { name: "Утренняя", startTime: "08:00", endTime: "16:00", color: "#3b82f6" },
    { name: "Дневная", startTime: "12:00", endTime: "20:00", color: "#10b981" },
    { name: "Вечерняя", startTime: "16:00", endTime: "00:00", color: "#f59e0b" },
  ];

  const templatesList = [];
  for (const tpl of templatesData) {
    const [inserted] = await db.insert(shiftTemplates).values({
      orgId: org.id,
      name: tpl.name,
      startTime: tpl.startTime,
      endTime: tpl.endTime,
      color: tpl.color,
    }).returning();
    templatesList.push(inserted);
  }
  console.log(`✅ Шаблоны смен созданы`);

  const allUsers = [];
  const credentials = [];

  const createUser = async (role: "OWNER" | "MANAGER" | "EMPLOYEE", index: number) => {
    const gender = Math.random() > 0.5 ? "M" : "F";
    const name = generateName(gender);
    const email = generateEmail(name, index);
    const plainPassword = generatePassword(PASSWORD_LENGTH);
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const position = role === "OWNER" ? "Директор" : role === "MANAGER" ? "Менеджер" : randomItem(POSITIONS);
    const hourlyRate = role === "OWNER" ? 1000 : role === "MANAGER" ? 700 : randomItem(RATES);

    const [user] = await db.insert(users).values({
      orgId: org.id,
      name,
      email,
      passwordHash,
      role,
      position,
      hourlyRate: hourlyRate.toString(),
      phone: `+7 999 ${String(index).padStart(3, "0")}-${String(index).padStart(2, "0")}-${String(index).padStart(2, "0")}`,
    }).returning();

    allUsers.push(user);
    credentials.push({ role, name, email, password: plainPassword });
    return user;
  };

  await createUser("OWNER", 0);
  for (let i = 1; i <= 2; i++) await createUser("MANAGER", i);
  for (let i = 3; i <= 24; i++) await createUser("EMPLOYEE", i);

  console.log(`✅ Создано пользователей: ${allUsers.length}`);

  const employees = allUsers.filter(u => u.role === "EMPLOYEE");
  for (const emp of employees) {
    const numLocations = Math.random() > 0.5 ? 1 : 2;
    const shuffled = [...locationsList].sort(() => 0.5 - Math.random());
    const selectedLocs = shuffled.slice(0, numLocations);
    for (const loc of selectedLocs) {
      await db.insert(userLocations).values({ userId: emp.id, locationId: loc.id });
    }
  }
  
  for (const u of allUsers.filter(u => u.role !== "EMPLOYEE")) {
    for (const loc of locationsList) {
      await db.insert(userLocations).values({ userId: u.id, locationId: loc.id });
    }
  }
  console.log(`✅ Сотрудники привязаны к точкам`);

  // Используем UTC-функцию
  const startMonday = getNextMondayUtc();
  console.log(`📅 Генерация начинается с понедельника: ${toDateStr(startMonday)}`);

  const weeksCount = 8; 
  let shiftsCreated = 0;

  for (let w = 0; w < weeksCount; w++) {
    const weekStart = new Date(startMonday);
    // Безопасно прибавляем недели в UTC
    weekStart.setUTCDate(startMonday.getUTCDate() + w * 7);
    const weekStartStr = toDateStr(weekStart);

    for (const loc of locationsList) {
      const [week] = await db.insert(scheduleWeeks).values({
        orgId: org.id,
        locationId: loc.id,
        weekStartDate: weekStartStr,
        status: "PUBLISHED",
        publishedAt: new Date(),
      }).returning();

      const locEmployees = await db
        .select({ userId: userLocations.userId })
        .from(userLocations)
        .where(eq(userLocations.locationId, loc.id));
      
      const employeeIds = locEmployees
        .map(e => e.userId)
        .filter(id => allUsers.find(u => u.id === id && u.role === "EMPLOYEE"));

      if (employeeIds.length === 0) continue;

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const shiftDate = new Date(weekStart);
        // Безопасно прибавляем дни в UTC
        shiftDate.setUTCDate(weekStart.getUTCDate() + dayOffset);
        const shiftDateStr = toDateStr(shiftDate);

        const shuffledEmployees = [...employeeIds].sort(() => 0.5 - Math.random());

        for (let s = 0; s < 3; s++) {
          if (s >= shuffledEmployees.length) break; 
          const empId = shuffledEmployees[s];
          const tpl = templatesList[s];

          const existingShift = await db.select().from(scheduledShifts).where(
            and(
              eq(scheduledShifts.userId, empId),
              eq(scheduledShifts.shiftDate, shiftDateStr)
            )
          );
          if (existingShift.length > 0) continue;

          await db.insert(scheduledShifts).values({
            weekId: week.id,
            templateId: tpl.id,
            userId: empId,
            shiftDate: shiftDateStr,
            startTime: tpl.startTime,
            endTime: tpl.endTime,
            status: "SCHEDULED",
          });
          shiftsCreated++;
        }
      }
    }
  }

  console.log(`✅ Создано смен: ${shiftsCreated}`);

  const credentialsText = credentials
    .map(c => `[${c.role}] ${c.name} | ${c.email} | ${c.password}`)
    .join("\n");

  fs.writeFileSync("demo-credentials.txt", credentialsText, "utf-8");
  console.log(`\n📄 Учётные данные сохранены в файл demo-credentials.txt`);
  
  console.log("\n=== УЧЁТНЫЕ ДАННЫЕ ===");
  console.log(credentialsText);

  console.log("\n🎉 Готово! Теперь вы можете зайти под любым пользователем.");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Ошибка:", e);
  process.exit(1);
});