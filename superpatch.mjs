// superpatch.mjs — v1.0.0
// Guest seed: 3 сотрудника, 2 шаблона смен, 2 локации, расписание на текущую неделю (DRAFT)
// Запуск: node superpatch.mjs
//         node superpatch.mjs --dry-run
//
// Что делает:
//   1. Создаёт frontend/src/lib/guestSeed.ts — единый источник данных для гостя
//   2. App.tsx                — init сторов для !token из seed + синхронизация guest_shifts
//   3. useGuestMode.ts        — default-данные из seed + авто-синхронизация guest_shifts
//   4. GuestApp.tsx           — шаблоны/локации из seed
//   5. guestAdapter.ts        — initDb из seed
//   6. api/client.ts          — мок-адаптер отдаёт данные из seed (/dashboard, /users и т.д.)
//   7. patch-history.txt      — дописывает запись об изменениях

import fs from "node:fs";
import path from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");
const ROOT = process.cwd();

let applied = 0, skipped = 0, failed = 0;
const changes = [];
const failures = [];

const norm = (s) => (s.includes("\r\n") ? s.replace(/\r\n/g, "\n") : s);

function reindent(origLine, tplLine, firstIndentLen) {
  const c = tplLine.trimStart();
  if (c === "") return "";
  const base = origLine.match(/^\s*/)[0];
  const rel = tplLine.length - c.length - firstIndentLen;
  return base + " ".repeat(Math.max(0, rel)) + c;
}

function diagnostics(lines, findLines) {
  const longest = findLines.reduce((a, b) => (a.length > b.length ? a : b), "");
  const near = lines.findIndex((l) => l.includes(longest.slice(0, 40)));
  if (near === -1) return `\n   "${longest.slice(0, 60)}" не найдена.`;
  let out = `\n   Похожее (строка ${near + 1}):\n`;
  for (let k = Math.max(0, near - 1); k <= Math.min(lines.length - 1, near + 5); k++)
    out += `   ${k === near ? "→" : " "} ${k + 1}: ${lines[k]}\n`;
  return out;
}

function patchFile(relPath, patches) {
  const filePath = path.resolve(ROOT, relPath);
  console.log(`\n══════ ${relPath} ══════`);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Не найден`);
    failed += patches.length;
    failures.push(relPath + " (файл не найден)");
    return;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const isCRLF = raw.includes("\r\n");
  let src = norm(raw);
  const orig = src;

  for (const p of patches) {
    if (p.marker && src.includes(p.marker)) {
      console.log(`⏭  [${p.label}] уже пропатчено`);
      skipped++;
      continue;
    }
    const lines = src.split("\n");
    const findLines = p.find.split("\n").filter(l => l.trim().length > 0);
    const matches = [];
    for (let i = 0; i <= lines.length - findLines.length; i++) {
      let ok = true;
      for (let j = 0; j < findLines.length; j++) {
        if (lines[i + j].trim() !== findLines[j].trim()) { ok = false; break; }
      }
      if (ok) matches.push(i);
    }
    if (matches.length === 0) {
      console.error(`❌ [${p.label}]${diagnostics(lines, findLines)}`);
      failed++;
      failures.push(p.label);
      continue;
    }
    if (matches.length > 1) console.warn(`   ⚠️  [${p.label}] ${matches.length} совпадений, беру первое`);

    const start = matches[0];
    const replLines = p.repl.split("\n");
    const firstIndentLen = replLines[0].match(/^\s*/)[0].length;
    const prepared = replLines.map(l => reindent(lines[start], l, firstIndentLen));

    src = [
      ...lines.slice(0, start),
      ...prepared,
      ...lines.slice(start + findLines.length),
    ].join("\n");

    console.log(`✅ [${p.label}]`);
    applied++;
    changes.push(`${relPath} — ${p.label}`);
  }

  if (src !== orig) {
    if (DRY_RUN) { console.log("🔍 dry-run — не сохраняю"); return; }
    fs.writeFileSync(`${filePath}.bak.${Date.now()}`, raw);
    fs.writeFileSync(filePath, isCRLF ? src.replace(/\n/g, "\r\n") : src);
    console.log(`💾 Сохранено`);
  }
}

function createFile(relPath, content, label) {
  const filePath = path.resolve(ROOT, relPath);
  console.log(`\n══════ ${relPath} (${label}) ══════`);
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf-8");
    if (existing === content) { console.log(`⏭  идентичен`); skipped++; return; }
    console.log(`⚠️  существует, но отличается — перезапишу (с бэкапом)`);
    if (!DRY_RUN) fs.writeFileSync(`${filePath}.bak.${Date.now()}`, existing);
  }
  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  console.log(`✅ создан`);
  applied++;
  changes.push(`${relPath} — ${label}`);
}

// ═══════════════════════════════════════════════════════════
// 1. guestSeed.ts
// ═══════════════════════════════════════════════════════════
const SEED = `// frontend/src/lib/guestSeed.ts
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
  { id: "gu1", name: "Алексей Смирнов", email: "alexey@guest.ru", phone: "+7 999 100-00-01", role: "OWNER", position: "Бариста", hourlyRate: "400", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#3B82F6", tempPassword: null, isTempPasswordSent: false },
  { id: "gu2", name: "Мария Петрова", email: "maria@guest.ru", phone: "+7 999 100-00-02", role: "EMPLOYEE", position: "Повар", hourlyRate: "450", createdAt: new Date().toISOString(), locationIds: ["gloc1"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#10B981", tempPassword: null, isTempPasswordSent: false },
  { id: "gu3", name: "Иван Кузнецов", email: "ivan@guest.ru", phone: "+7 999 100-00-03", role: "EMPLOYEE", position: "Официант", hourlyRate: "350", createdAt: new Date().toISOString(), locationIds: ["gloc2"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", color: "#F59E0B", tempPassword: null, isTempPasswordSent: false },
];

const LOCATIONS: GuestLocation[] = [
  { id: "gloc1", name: "Основная точка", orgId: "gorg" },
  { id: "gloc2", name: "Вторая точка", orgId: "gorg" },
];

const TEMPLATES: GuestTemplate[] = [
  { id: "gt1", name: "Утренняя", startTime: "08:00", endTime: "16:00", color: "#F59E0B" },
  { id: "gt2", name: "Вечерняя", startTime: "16:00", endTime: "23:00", color: "#8B5CF6" },
];

const SHIFTS: GuestShift[] = [];
function pushShift(dayOffset: number, userId: string, templateId: string) {
  const tpl = TEMPLATES.find((t) => t.id === templateId)!;
  SHIFTS.push({
    id: \`gshift-\${SHIFTS.length + 1}\`,
    weekId: WEEK_ID,
    templateId,
    userId,
    shiftDate: addDays(WEEK_START, dayOffset),
    startTime: tpl.startTime,
    endTime: tpl.endTime,
    status: "SCHEDULED",
  });
}
// Пн
pushShift(0, "gu1", "gt1");
pushShift(0, "gu2", "gt2");
// Вт
pushShift(1, "gu2", "gt1");
pushShift(1, "gu3", "gt2");
// Ср
pushShift(2, "gu1", "gt1");
pushShift(2, "gu3", "gt2");
// Чт
pushShift(3, "gu1", "gt1");
pushShift(3, "gu2", "gt2");
// Пт
pushShift(4, "gu2", "gt1");
pushShift(4, "gu3", "gt2");
// Сб
pushShift(5, "gu1", "gt2");
pushShift(5, "gu3", "gt1");

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
    id: "gu1", name: "Алексей Смирнов", role: "OWNER", email: "alexey@guest.ru", orgId: "gorg",
    position: "Бариста", hourlyRate: "400", phone: "+7 999 100-00-01", createdAt: new Date().toISOString(),
  },
};
`;
createFile("frontend/src/lib/guestSeed.ts", SEED, "единый источник данных для гостя");

// ═══════════════════════════════════════════════════════════
// 2. App.tsx — инициализация сторов для !token
// ═══════════════════════════════════════════════════════════
patchFile("frontend/src/App.tsx", [
  {
    label: "импорт GUEST_SEED",
    marker: `from "./lib/guestSeed"`,
    find: `import GuestApp from "./pages/GuestApp";`,
    repl: `import GuestApp from "./pages/GuestApp";
import { GUEST_SEED } from "./lib/guestSeed";`,
  },
  {
    label: "init !token через seed",
    marker: `useAuth.setState({ user: seed.me as any })`,
    find: `useEffect(() => {
    if (!token) {
      useAuth.setState({ user: { id: "guest", name: "Владелец", role: "OWNER", email: "guest@test.ru" } });
      useUsers.setState({ items: [
        { 
          id: "u1", name: "Алексей", email: "alex@test.ru", phone: "+79990000001", role: "OWNER", 
          position: "Бариста", hourlyRate: "300", createdAt: new Date().toISOString(), 
          locationIds: ["loc1"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", 
          color: "#3B82F6", tempPassword: null, isTempPasswordSent: false 
        },
        { 
          id: "u2", name: "Мария", email: "maria@test.ru", phone: "+79990000002", role: "EMPLOYEE", 
          position: "Кассир", hourlyRate: "250", createdAt: new Date().toISOString(), 
          locationIds: ["loc1"], areaIds: [], paymentType: "HOURLY", employmentType: "SHTAT", 
          color: "#10B981", tempPassword: null, isTempPasswordSent: false 
        }
      ] });
      useShiftTemplates.setState({ items: [{ id: "t1", name: "Дневная", startTime: "09:00", endTime: "18:00", color: "#3B82F6" }] });
      useOrganization.setState({ org: { id: "org1", name: "Моя компания", tariffId: "pro", positionHeaderOpacity: 70, positionRowOpacity: 20 } });
      useLocations.setState({ items: [{ id: "loc1", name: "Основная", orgId: "org1" }], activeLocationId: "loc1" });
      
      // ВАЖНО: Создаем фейковую неделю, чтобы можно было в нее зайти
      useWeeks.setState({ 
        weeks: [{ id: "week1", weekStartDate: new Date().toISOString().slice(0, 10), status: "DRAFT", shifts: [] }], 
        loading: false 
      });
    }
  }, [token]);`,
    repl: `useEffect(() => {
    if (!token) {
      const seed = GUEST_SEED;
      useAuth.setState({ user: seed.me as any });
      useUsers.setState({ items: seed.employees as any });
      useShiftTemplates.setState({ items: seed.templates as any });
      useOrganization.setState({ org: seed.organization as any });
      useLocations.setState({ items: seed.locations as any, activeLocationId: seed.locations[0].id });
      useWeeks.setState({
        weeks: [{ id: seed.weekId, weekStartDate: seed.weekStart, status: "DRAFT", shifts: seed.shifts as any }],
        loading: false,
      });
      try {
        const existing = localStorage.getItem("guest_shifts");
        if (!existing || existing === "[]") {
          localStorage.setItem("guest_shifts", JSON.stringify(seed.shifts));
        }
      } catch {}
    }
  }, [token]);`,
  },
]);

// ═══════════════════════════════════════════════════════════
// 3. useGuestMode.ts
// ═══════════════════════════════════════════════════════════
patchFile("frontend/src/hooks/useGuestMode.ts", [
  {
    label: "импорт GUEST_SEED",
    marker: `from "../lib/guestSeed"`,
    find: `import { useState, useEffect } from "react";`,
    repl: `import { useState, useEffect } from "react";
import { GUEST_SEED } from "../lib/guestSeed";`,
  },
  {
    label: "default через seed",
    marker: `const seed = GUEST_SEED;`,
    find: `return {
      employees: [
        { id: "g1", name: "Алексей", position: "Бариста", hourlyRate: "300" },
        { id: "g2", name: "Мария", position: "Кассир", hourlyRate: "250" }
      ],
      shifts: [],
      startDate: new Date().toISOString().slice(0, 10),
    };`,
    repl: `const seed = GUEST_SEED;
    return {
      employees: seed.employees,
      shifts: seed.shifts,
      startDate: seed.weekStart,
    };`,
  },
  {
    label: "синхронизация guest_shifts",
    marker: `localStorage.setItem("guest_shifts", JSON.stringify(guestData.shifts))`,
    find: `useEffect(() => {
    localStorage.setItem("guest_workspace", JSON.stringify(guestData));
  }, [guestData]);`,
    repl: `useEffect(() => {
    localStorage.setItem("guest_workspace", JSON.stringify(guestData));
    if (guestData.shifts && guestData.shifts.length > 0) {
      const existing = localStorage.getItem("guest_shifts");
      if (!existing || existing === "[]") {
        localStorage.setItem("guest_shifts", JSON.stringify(guestData.shifts));
      }
    }
  }, [guestData]);`,
  },
]);

// ═══════════════════════════════════════════════════════════
// 4. GuestApp.tsx
// ═══════════════════════════════════════════════════════════
patchFile("frontend/src/pages/GuestApp.tsx", [
  {
    label: "импорт GUEST_SEED",
    marker: `from "../lib/guestSeed"`,
    find: `import { useGuestMode } from "../hooks/useGuestMode";`,
    repl: `import { useGuestMode } from "../hooks/useGuestMode";
import { GUEST_SEED } from "../lib/guestSeed";`,
  },
  {
    label: "templates/locations из seed",
    marker: `useShiftTemplates.setState({ items: seed.templates })`,
    find: `useUsers.setState({ items: guestData.employees });
    useShiftTemplates.setState({
      items: [
        { id: "t1", name: "Дневная", startTime: "09:00", endTime: "18:00", color: "#3B82F6" },
        { id: "t2", name: "Вечерняя", startTime: "14:00", endTime: "22:00", color: "#F59E0B" }
      ]
    });
    useOrganization.setState({ org: { positionHeaderOpacity: 70, positionRowOpacity: 20 } });`,
    repl: `const seed = GUEST_SEED;
    useUsers.setState({ items: seed.employees });
    useShiftTemplates.setState({ items: seed.templates });
    useOrganization.setState({ org: seed.organization as any });`,
  },
]);

// ═══════════════════════════════════════════════════════════
// 5. guestAdapter.ts
// ═══════════════════════════════════════════════════════════
patchFile("frontend/src/api/guestAdapter.ts", [
  {
    label: "импорт GUEST_SEED",
    marker: `from "../lib/guestSeed"`,
    find: `import type { AxiosAdapter, InternalAxiosRequestConfig, AxiosResponse } from 'axios';`,
    repl: `import type { AxiosAdapter, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { GUEST_SEED } from "../lib/guestSeed";`,
  },
  {
    label: "initDb через seed",
    marker: `id: GUEST_SEED.weekId`,
    find: `const initDb = () => {
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
};`,
    repl: `const initDb = () => {
  if (!localStorage.getItem("guest_db")) {
    localStorage.setItem("guest_db", JSON.stringify({
      weeks: [{
        id: GUEST_SEED.weekId,
        weekStartDate: GUEST_SEED.weekStart,
        status: "DRAFT",
        shifts: GUEST_SEED.shifts,
      }],
      users: GUEST_SEED.employees,
      templates: GUEST_SEED.templates,
      locations: GUEST_SEED.locations,
    }));
  }
};`,
  },
]);

// ═══════════════════════════════════════════════════════════
// 6. client.ts — моки из seed
// ═══════════════════════════════════════════════════════════
patchFile("frontend/src/api/client.ts", [
  {
    label: "импорт GUEST_SEED",
    marker: `from "../lib/guestSeed"`,
    find: `import { guestAdapter } from "./guestAdapter";`,
    repl: `import { guestAdapter } from "./guestAdapter";
import { GUEST_SEED } from "../lib/guestSeed";`,
  },
  {
    label: "моки из seed",
    marker: `const seed = GUEST_SEED;` + "\n    if (url.includes(\"/dashboard\"))",
    find: `    let mockData = {};

    if (url.includes("/dashboard")) {
      mockData = { todayShifts: [], weekShifts: [], weekHours: 0, weekCost: 0, monthShifts: 0, monthCost: 0, employeesWorking: 0, swaps: 0, requests: 0 };
    } else if (url.includes("/schedule-weeks")) {
      mockData = [{ id: "week1", weekStartDate: new Date().toISOString().slice(0,10), status: "DRAFT", shifts: [] }];
    } else if (url.includes("/shift-templates")) {
      mockData = [{ id: "t1", name: "Дневная", startTime: "09:00", endTime: "18:00", color: "#3B82F6" }];
    } else if (url.includes("/locations")) {
      mockData = [{ id: "loc1", name: "Основная", orgId: "org1" }];
    } else // Если это POST (создание сотрудника)
      if (url.includes("/users") && method === "POST") {
        const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data || {});
        return Promise.resolve({
          data: {
            user: {
              id: Math.random().toString(),
              name: body.name || "Новый сотрудник",
              email: body.email || "new@test.ru",
              phone: body.phone || null,
              role: body.role || "EMPLOYEE",
              position: body.position || null,
              hourlyRate: body.hourlyRate || null,
              createdAt: new Date().toISOString(),
              locationIds: body.locationIds || [],
              areaIds: body.areaIds || [],
              paymentType: body.paymentType || "HOURLY",
              employmentType: body.employmentType || "SHTAT",
              color: body.color || "#3B82F6",
              tempPassword: "temp123",
              isTempPasswordSent: false
            },
            tempPassword: "temp123"
          }
        });
      }

      // Если это GET (список сотрудников)
      if (url.includes("/users") && method === "GET") {
      mockData = [{ id: "u1", name: "Алексей", position: "Бариста", hourlyRate: "300", color: "#3B82F6", locationIds: ["loc1"], areaIds: [] }];
    } else if (url.includes("/organization")) {
        return Promise.resolve({ data: { id: "org1", name: "Моя компания", tariffId: "pro", positionHeaderOpacity: 70, positionRowOpacity: 20 } });
      }
      if (url.includes("/me")) {
      mockData = { id: "guest", name: "Владелец", role: "OWNER", email: "guest@test.ru", orgId: "org1" };
    } else if (url.includes("/count")) {
      mockData = { count: 0 };
    } else if (method === "GET") {
      mockData = []; // Для всех списков
    }`,
    repl: `    let mockData: any = {};
    const seed = GUEST_SEED;

    if (url.includes("/dashboard")) {
      mockData = {
        currentWeek: {
          id: seed.weekId,
          weekStartDate: seed.weekStart,
          locationId: seed.locations[0].id,
          status: "DRAFT",
          shifts: seed.shifts,
        },
        todayShifts: [],
        weekTimeEntries: [],
        userCount: seed.employees.length,
        users: seed.employees.map((e) => ({
          id: e.id,
          name: e.name,
          hourlyRate: e.hourlyRate,
          position: e.position,
        })),
        monthlyHours: 0,
      };
    } else if (url.includes("/schedule-weeks")) {
      mockData = [{
        id: seed.weekId,
        weekStartDate: seed.weekStart,
        status: "DRAFT",
        shifts: seed.shifts,
      }];
    } else if (url.includes("/shift-templates")) {
      mockData = seed.templates;
    } else if (url.includes("/locations")) {
      mockData = seed.locations;
    } else if (url.includes("/users") && method === "POST") {
      const body = typeof config.data === "string" ? JSON.parse(config.data) : (config.data || {});
      return Promise.resolve({
        data: {
          user: {
            id: Math.random().toString(),
            name: body.name || "Новый сотрудник",
            email: body.email || "new@test.ru",
            phone: body.phone || null,
            role: body.role || "EMPLOYEE",
            position: body.position || null,
            hourlyRate: body.hourlyRate || null,
            createdAt: new Date().toISOString(),
            locationIds: body.locationIds || [],
            areaIds: body.areaIds || [],
            paymentType: body.paymentType || "HOURLY",
            employmentType: body.employmentType || "SHTAT",
            color: body.color || "#3B82F6",
            tempPassword: "temp123",
            isTempPasswordSent: false,
          },
          tempPassword: "temp123",
        },
        status: 200, statusText: "OK", headers: {}, config,
      });
    } else if (url.includes("/users") && method === "GET") {
      mockData = seed.employees;
    } else if (url.includes("/organization")) {
      return Promise.resolve({ data: seed.organization, status: 200, statusText: "OK", headers: {}, config });
    } else if (url.includes("/me")) {
      mockData = seed.me;
    } else if (url.includes("/count")) {
      mockData = { count: 0 };
    } else if (method === "GET") {
      mockData = [];
    }`,
  },
]);

// ═══════════════════════════════════════════════════════════
// 7. patch-history.txt
// ═══════════════════════════════════════════════════════════
const HISTORY = path.resolve(ROOT, "patch-history.txt");
function appendHistory(text) {
  let cur = fs.existsSync(HISTORY) ? fs.readFileSync(HISTORY, "utf-8") : "";
  if (!cur.trim()) cur = "# ════════════════════════════════════════════\n# ИСТОРИЯ ПРАВОК (patch-history.txt)\n# ════════════════════════════════════════════\n\n";
  const next = cur.endsWith("\n") ? cur + text : cur + "\n" + text;
  fs.writeFileSync(HISTORY, next);
}

if (changes.length > 0 && !DRY_RUN) {
  const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
  let entry = `[${ts}] v1.0.0 — Guest seed: 3 сотрудника, 2 шаблона смен, 2 локации, расписание на текущую неделю (DRAFT)\n`;
  for (const c of changes) entry += `  • ${c}\n`;
  entry += "\n";
  appendHistory(entry);
  console.log(`\n📝 Записано в patch-history.txt`);
}

console.log("\n══════════════════════════════════════");
console.log(`✅ применено:   ${applied}`);
console.log(`⏭  уже было:    ${skipped}`);
console.log(`❌ не найдено:  ${failed}`);
if (failures.length) console.log("   Не найдено:", failures.join(", "));
console.log("══════════════════════════════════════");

if (failed > 0) process.exit(2);