import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../../../db/client.js";
import {
  users, locations, areas, userLocations, userAreas,
  positionTemplates, organizations,
} from "../../../db/schema.js";

function generateTempPassword(length = 8): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export async function buildUsersExcelTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Планировщик смен";

  const ws = wb.addWorksheet("Сотрудники", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = [
    { key: "name", header: "Имя", width: 28 },
    { key: "email", header: "Email", width: 28 },
    { key: "position", header: "Должность", width: 22 },
    { key: "location", header: "Точка", width: 22 },
    { key: "area", header: "Локация", width: 22 },
    { key: "hourlyRate", header: "Ставка (₽/час)", width: 16 },
    { key: "phone", header: "Телефон", width: 18 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 32;
  for (let i = 1; i <= 7; i++) {
    headerRow.getCell(i).border = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
  }

  const exampleRow = ws.addRow({
    name: "Иванов Иван Иванович",
    email: "ivanov@example.ru",
    position: "продавец",
    location: "Точка на Ленина",
    area: "Торговый зал",
    hourlyRate: "350",
    phone: "+7 999 123-45-67",
  });
  exampleRow.font = { italic: true, color: { argb: "FF9CA3AF" } };

  const hintRow = ws.addRow([]);
  const hintCell = ws.getRow(hintRow.number + 1).getCell(1);
  hintCell.value =
    "Заполните по одной строке на сотрудника. " +
    "«Точка» — филиал, «Локация» — помещение внутри точки (кухня, зал, администрация). " +
    "Должности, точки и локации из файла автоматически добавятся в шаблоны. " +
    "Первая строка — пример, удалите её.";
  hintCell.font = { italic: true, color: { argb: "FF6B7280" }, size: 9 };

  return (await wb.xlsx.writeBuffer()) as Buffer;
}

export type ParsedUser = {
  name: string;
  email: string;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
  position: string | null;
  locationName: string | null;
  areaName: string | null;
  hourlyRate: string | null;
  phone: string | null;
};

export async function parseUsersExcel(buffer: Buffer): Promise<ParsedUser[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("EMPTY_EXCEL");

  const headerRow = ws.getRow(1);
  const headers: Record<number, string> = {};
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const findCol = (label: string): number | undefined => {
    for (const [idx, name] of Object.entries(headers)) {
      if (name.toLowerCase() === label.toLowerCase()) return Number(idx);
    }
    return undefined;
  };

  const colName = findCol("Имя");
  const colEmail = findCol("Email");
  const colPosition = findCol("Должность");
  const colLocation = findCol("Точка");
  const colArea = findCol("Локация");
  const colRate = findCol("Ставка (₽/час)") ?? findCol("Ставка");
  const colPhone = findCol("Телефон");

  if (!colName || !colEmail) throw new Error("MISSING_COLUMNS");

  const rows: ParsedUser[] = [];
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const getVal = (col?: number): string => {
      if (!col) return "";
      const v = row.getCell(col).value as any;
      if (v && typeof v === "object") {
        if ("text" in v) return String(v.text).trim();
        if ("result" in v) return String(v.result).trim();
        return "";
      }
      return String(v ?? "").trim();
    };

    const name = getVal(colName);
    const email = getVal(colEmail);
    if (!name || !email) continue;

    const position = getVal(colPosition) || null;
    const locationName = getVal(colLocation) || null;
    const areaName = getVal(colArea) || null;
    const rateStr = getVal(colRate);
    const hourlyRate = rateStr && /^\d+(\.\d{1,2})?$/.test(rateStr) ? rateStr : null;
    const phone = getVal(colPhone) || null;

    rows.push({ name, email, role: "EMPLOYEE", position, locationName, areaName, hourlyRate, phone });
  }
  return rows;
}

export type ImportResult = {
  created: number;
  skipped: number;
  errors: string[];
  createdUsers: Array<{ name: string; email: string; tempPassword: string }>;
};

export async function importUsersFromExcel(orgId: string, rows: ParsedUser[]): Promise<ImportResult> {
  const result: ImportResult = { created: 0, skipped: 0, errors: [], createdUsers: [] };

  const existingLocations = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations).where(eq(locations.orgId, orgId));
  const locationMap = new Map(existingLocations.map((l) => [l.name.toLowerCase().trim(), l.id]));

  const existingAreas = await db
    .select({ id: areas.id, name: areas.name, locationId: areas.locationId })
    .from(areas).where(eq(areas.orgId, orgId));
  const areaKey = (locId: string, name: string) => `${locId}::${name.toLowerCase().trim()}`;
  const areaMap = new Map(existingAreas.map((a) => [areaKey(a.locationId, a.name), a.id]));

  const existingPositions = await db
    .select({ name: positionTemplates.name })
    .from(positionTemplates).where(eq(positionTemplates.orgId, orgId));
  const positionSet = new Set(existingPositions.map((p) => p.name.toLowerCase().trim()));

  const [org] = await db
    .select({ maxLocations: organizations.maxLocations })
    .from(organizations).where(eq(organizations.id, orgId));

  for (const row of rows) {
    try {
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, row.email));
      if (existing.length > 0) {
        result.skipped++;
        result.errors.push(`${row.email}: email уже занят`);
        continue;
      }

      // Должность
      if (row.position) {
        const key = row.position.trim().toLowerCase();
        if (!positionSet.has(key)) {
          await db.insert(positionTemplates).values({ orgId, name: row.position.trim() });
          positionSet.add(key);
        }
      }

      // Точка
      let locationId: string | null = null;
      if (row.locationName) {
        const key = row.locationName.trim().toLowerCase();
        if (locationMap.has(key)) {
          locationId = locationMap.get(key)!;
        } else {
          const [cnt] = await db.select({ count: sql<number>`count(*)::int` })
            .from(locations)
            .where(and(eq(locations.orgId, orgId), eq(locations.isArchived, false)));
          if (cnt.count < (org?.maxLocations ?? 1)) {
            const [created] = await db.insert(locations)
              .values({ orgId, name: row.locationName.trim() }).returning();
            locationId = created.id;
            locationMap.set(key, created.id);
          } else {
            result.errors.push(`${row.email}: точка «${row.locationName}» не создана (лимит)`);
          }
        }
      }

      // Локация (помещение)
      let areaId: string | null = null;
      if (row.areaName && locationId) {
        const key = areaKey(locationId, row.areaName);
        if (areaMap.has(key)) {
          areaId = areaMap.get(key)!;
        } else {
          const [created] = await db.insert(areas)
            .values({ orgId, locationId, name: row.areaName.trim() }).returning();
          areaId = created.id;
          areaMap.set(key, created.id);
        }
      } else if (row.areaName && !locationId) {
        result.errors.push(`${row.email}: локация «${row.areaName}» пропущена (не указана точка)`);
      }

      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      const [created] = await db.insert(users).values({
        orgId, name: row.name, email: row.email, passwordHash,
        role: "EMPLOYEE", position: row.position,
        hourlyRate: row.hourlyRate, phone: row.phone,
      }).returning({ id: users.id });

      if (locationId) {
        await db.insert(userLocations).values({ userId: created.id, locationId });
      }
      if (areaId) {
        await db.insert(userAreas).values({ userId: created.id, areaId });
      }

      result.created++;
      result.createdUsers.push({ name: row.name, email: row.email, tempPassword });
    } catch (e: any) {
      result.errors.push(`${row.email}: ${e.message ?? "ошибка"}`);
    }
  }
  return result;
}