// superpatch.mjs
// Правка: исправление 5 TypeScript-ошибок, из-за которых падает `npm run build`.
//  1. client.ts — request-интерсептор должен возвращать config, а не Promise<{data}>.
//  2. useGuestMode.ts — параметр prev у сеттеров должен быть типизирован.
//  3. dashboard.ts — в DashboardUser должно быть поле color.
//  4. WeekDetailPage.tsx — getEntriesByType("navigation") приводим к PerformanceNavigationTiming[].
//  5. auth.ts — объект guestUser приводим к типу User (добавляем email).

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

  // Работаем в LF-представлении, чтобы паттерны совпадали независимо от ОС
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
      // Диагностика: показываем, есть ли хотя бы начало паттерна в файле
      const probe = fromN.split("\n")[0].trim();
      const found = content.split("\n").findIndex((l) => l.includes(probe));
      if (found >= 0) {
        console.error(`Найдена похожая строка #${found + 1}:`);
        console.error("  " + content.split("\n")[found]);
      } else {
        console.error(`Строка-маркер не найдена: "${probe}"`);
      }
      process.exit(1);
    }
    content = content.replace(fromN, toN);
    applied++;
  }

  // Возвращаем исходный тип переводов строк
  const finalContent = hadCRLF ? content.replace(/\n/g, "\r\n") : content;
  writeFileSync(filePath, finalContent, "utf8");
  console.log(`✓ ${relPath} — применено замен: ${applied}`);
}

// ─── 1. frontend/src/api/client.ts ──────────────────────────────
patchFile("frontend/src/api/client.ts", [
  [
    `        return Promise.resolve({
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
        });`,
    `        mockData = {
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
        };`
  ],
  [
    `    } else if (url.includes("/organization")) {
        return Promise.resolve({ data: GUEST_SEED.organization });
      }`,
    `    } else if (url.includes("/organization")) {
        mockData = GUEST_SEED.organization;
      }`
  ]
]);

// ─── 2. frontend/src/hooks/useGuestMode.ts ──────────────────────
patchFile("frontend/src/hooks/useGuestMode.ts", [
  [
    `    setGuestData((prev) => ({ ...prev, employees: [...prev.employees, emp] }));`,
    `    setGuestData((prev: any) => ({ ...prev, employees: [...prev.employees, emp] }));`
  ],
  [
    `    setGuestData((prev) => ({ ...prev, shifts: [...prev.shifts, shift] }));`,
    `    setGuestData((prev: any) => ({ ...prev, shifts: [...prev.shifts, shift] }));`
  ],
  [
    `    setGuestData((prev) => ({ ...prev, shifts: prev.shifts.filter((s: any) => s.id !== id) }));`,
    `    setGuestData((prev: any) => ({ ...prev, shifts: prev.shifts.filter((s: any) => s.id !== id) }));`
  ]
]);

// ─── 3. frontend/src/api/dashboard.ts ───────────────────────────
patchFile("frontend/src/api/dashboard.ts", [
  [
    `export type DashboardUser = {
  id: string;
  name: string;
  hourlyRate: string | null;
  position: string | null;
};`,
    `export type DashboardUser = {
  id: string;
  name: string;
  hourlyRate: string | null;
  position: string | null;
  color?: string | null;
};`
  ]
]);

// ─── 4. frontend/src/pages/WeekDetailPage.tsx ───────────────────
patchFile("frontend/src/pages/WeekDetailPage.tsx", [
  [
    `  const navEntries = performance.getEntriesByType("navigation");`,
    `  const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];`
  ]
]);

// ─── 5. frontend/src/store/auth.ts ──────────────────────────────
patchFile("frontend/src/store/auth.ts", [
  [
    `    const guestUser = { id: "guest", name: "Гость", role: "OWNER", orgId: "guest-org" };`,
    `    const guestUser: User = { id: "guest", name: "Гость", email: "guest@local", role: "OWNER", orgId: "guest-org" };`
  ]
]);

console.log("\nВсе правки применены успешно.");