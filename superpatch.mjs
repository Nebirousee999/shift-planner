// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touchedFiles = 0;

// 1. Бэкенд: Передаем ставку (на случай если не передалась)
const authPath = path.join(ROOT, "src/modules/auth/auth.service.ts");
if (fs.existsSync(authPath)) {
  let authContent = fs.readFileSync(authPath, "utf-8");
  if (authContent.includes("employees: createdEmployees.map(e => ({ id: e.id, name: e.name })),")) {
    authContent = authContent.replace(
      "employees: createdEmployees.map(e => ({ id: e.id, name: e.name })),",
      "employees: createdEmployees.map(e => ({ id: e.id, name: e.name, hourlyRate: Number(e.hourlyRate || 0) })),"
    );
    fs.writeFileSync(authPath, authContent, "utf-8");
    console.log(`✅ [auth.service.ts] Добавлена передача hourlyRate.`);
    touchedFiles++;
  }
}

// 2. Генератор Excel: Полностью заменяем функцию exportMonthToExcel
const excelPath = path.join(ROOT, "src/lib/export/excel.ts");
if (fs.existsSync(excelPath)) {
  let excelContent = fs.readFileSync(excelPath, "utf-8");
  
  // Отрезаем все, начиная с нашей функции, чтобы переписать её заново
  const startIdx = excelContent.indexOf("export async function exportMonthToExcel");
  if (startIdx !== -1) {
    excelContent = excelContent.substring(0, startIdx);
  }

  // Добавляем новую, исправленную функцию (без ошибок с mergeCells)
  excelContent += `
// ─── Экспорт графика на месяц в виде календарной сетки ───
export async function exportMonthToExcel(input: {
  orgName: string;
  monthStartDate: string;
  employees: { id: string; name: string; hourlyRate?: number }[];
  shifts: {
    userId: string;
    userName: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    templateName: string | null;
    templateColor: string | null;
  }[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Планировщик смен";

  const shiftsByUser = new Map<string, typeof input.shifts>();
  for (const s of input.shifts) {
    if (!shiftsByUser.has(s.userId)) shiftsByUser.set(s.userId, []);
    shiftsByUser.get(s.userId)!.push(s);
  }

  const monthStart = new Date(input.monthStartDate + "T00:00:00Z");
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth();
  const monthName = monthStart.toLocaleString("ru-RU", { month: "long", timeZone: "UTC" });

  const firstDay = new Date(Date.UTC(year, month, 1));
  const dow = firstDay.getUTCDay() === 0 ? 7 : firstDay.getUTCDay();
  const gridStart = new Date(firstDay);
  gridStart.setUTCDate(gridStart.getUTCDate() - dow + 1);

  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const dowEnd = lastDay.getUTCDay() === 0 ? 7 : lastDay.getUTCDay();
  const gridEnd = new Date(lastDay);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (7 - dowEnd));

  const WEEKDAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

  for (const emp of input.employees) {
    const userShifts = shiftsByUser.get(emp.id) || [];
    let sheetName = emp.name.replace(/[\\\\\\/?*\\[\\]:]/g, "").slice(0, 31) || "Сотрудник";
    const ws = wb.addWorksheet(sheetName);

    ws.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1 };
    ws.columns = [
      { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 },
      { width: 13 }, { width: 13 }, { width: 13 }, { width: 18 },
    ];

    let totalHours = 0;
    for (const s of userShifts) {
      totalHours += hoursBetween(s.startTime, s.endTime);
    }
    const totalCost = Math.round(totalHours * (emp.hourlyRate || 0));

    // --- Шапка ---
    ws.mergeCells("A1:H1");
    const titleCell = ws.getCell("A1");
    titleCell.value = \`\${input.orgName} — \${emp.name}\`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(1).height = 30;

    // --- Сводка ---
    ws.mergeCells("A2:C2");
    ws.getCell("A2").value = \`\${monthName} \${year}\`;
    ws.getCell("A2").font = { bold: true, size: 11, color: { argb: "FF64748B" } };
    ws.getCell("A2").alignment = { vertical: "middle" };

    ws.getCell("D2").value = "СМЕН ЗА МЕСЯЦ:";
    ws.getCell("D2").font = { size: 9, bold: true, color: { argb: "FF64748B" } };
    ws.getCell("D2").alignment = { horizontal: "right", vertical: "middle" };
    ws.getCell("E2").value = userShifts.length;
    ws.getCell("E2").font = { bold: true, size: 12 };
    ws.getCell("E2").alignment = { horizontal: "center", vertical: "middle" };

    ws.getCell("F2").value = "ЧАСОВ ЗА МЕСЯЦ:";
    ws.getCell("F2").font = { size: 9, bold: true, color: { argb: "FF64748B" } };
    ws.getCell("F2").alignment = { horizontal: "right", vertical: "middle" };
    ws.getCell("G2").value = Math.round(totalHours * 10) / 10;
    ws.getCell("G2").font = { bold: true, size: 12 };
    ws.getCell("G2").alignment = { horizontal: "center", vertical: "middle" };

    ws.getCell("H2").value = \`ЗАТРАТЫ: \${new Intl.NumberFormat("ru-RU").format(totalCost)} ₽\`;
    ws.getCell("H2").font = { bold: true, size: 10, color: { argb: "FF10B981" } };
    ws.getCell("H2").alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 24;

    // --- Шапка календаря ---
    const headerRow = ws.getRow(4);
    headerRow.values = [...WEEKDAYS, "ИТОГО ЗА НЕДЕЛЮ"];
    headerRow.font = { bold: true, size: 9, color: { argb: "FF64748B" } };
    headerRow.eachCell((c) => {
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      c.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
    headerRow.height = 36;

    // --- Сетка ---
    let rowIdx = 5;
    let currentDay = new Date(gridStart);

    while (currentDay <= gridEnd) {
      let weekShifts = 0;
      let weekHours = 0;
      const weekRow = ws.getRow(rowIdx);

      for (let i = 0; i < 7; i++) {
        const dateStr = currentDay.toISOString().slice(0, 10);
        const cell = weekRow.getCell(i + 1);

        const isOtherMonth = currentDay.getUTCMonth() !== month;
        const dayNum = currentDay.getUTCDate();
        const dayShift = userShifts.find(s => s.shiftDate === dateStr);

        if (dayShift) {
          cell.value = \`\${dayShift.startTime}-\\n\${dayShift.endTime}\`;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };
          cell.font = { color: { argb: "FFFFFFFF" }, size: 9, bold: true };
          weekShifts++;
          weekHours += hoursBetween(dayShift.startTime, dayShift.endTime);
        } else if (isOtherMonth) {
          cell.value = dayNum;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
          cell.font = { color: { argb: "FFCBD5E1" }, size: 9 };
        } else {
          cell.value = dayNum;
          cell.font = { color: { argb: "FF94A3B8" }, size: 9 };
        }

        cell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };

        currentDay.setUTCDate(currentDay.getUTCDate() + 1);
      }

      const totalCell = weekRow.getCell(8);
      totalCell.value = \`\${weekShifts} см.\\n\${Math.round(weekHours * 10) / 10} ч.\`;
      totalCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      totalCell.font = { size: 9, bold: true, color: { argb: "FF334155" } };
      totalCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      totalCell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      weekRow.height = 45;
      rowIdx++;
    }
  }

  return (await wb.xlsx.writeBuffer()) as Buffer;
}
`;

  fs.writeFileSync(excelPath, excelContent, "utf-8");
  console.log(`✅ [excel.ts] Генератор Excel успешно перезаписан (исправлен баг).`);
  touchedFiles++;
}

if (touchedFiles > 0) {
  console.log(`\n🎉 Успешно! Изменено файлов: ${touchedFiles}`);
  console.log(`⚠️  ОБЯЗАТЕЛЬНО перезапустите бэкенд (npm run dev в корне)!`);
  console.log(`    После перезапуска попробуйте зарегистрироваться заново, чтобы проверить почту.`);
} else {
  console.log(`\n✨ Всё уже на месте.`);
}