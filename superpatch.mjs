// superpatch.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let touchedFiles = 0;

function patchFile(filePath, patches) {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ Файл не найден: ${filePath}`);
    return;
  }

  const raw = fs.readFileSync(fullPath, "utf-8");
  const hadCRLF = raw.includes("\r\n");
  let normalized = hadCRLF ? raw.replace(/\r\n/g, "\n") : raw;
  let fileChanged = false;

  for (const p of patches) {
    if (p.marker && normalized.includes(p.marker)) {
      console.log(`⏭  [${filePath}] Уже пропатчено: ${p.label}`);
      continue;
    }

    if (normalized.includes(p.search)) {
      normalized = normalized.replace(p.search, p.replace);
      fileChanged = true;
      console.log(`✅ [${filePath}] Изменено: ${p.label}`);
    } else {
      console.log(`⚠️  [${filePath}] Не найдено место для: ${p.label}`);
    }
  }

  if (fileChanged) {
    fs.writeFileSync(fullPath, hadCRLF ? normalized.replace(/\n/g, "\r\n") : normalized, "utf-8");
    touchedFiles++;
  }
}

// ═══════════════════════════════════════════════════════
// 1. БЭКЕНД: Передаем hourlyRate в Excel (auth.service.ts)
// ═══════════════════════════════════════════════════════
patchFile("src/modules/auth/auth.service.ts", [
  {
    label: "Передача ставки в excelDataForExport",
    search: `          employees: createdEmployees.map(e => ({ id: e.id, name: e.name })),`,
    replace: `          employees: createdEmployees.map(e => ({ id: e.id, name: e.name, hourlyRate: Number(e.hourlyRate || 0) })),`
  }
]);

// ═══════════════════════════════════════════════════════
// 2. БЭКЕНД: Полная перезапись генератора Excel (excel.ts)
// ═══════════════════════════════════════════════════════
const excelPath = path.join(ROOT, "src/lib/export/excel.ts");
if (fs.existsSync(excelPath)) {
  let excelContent = fs.readFileSync(excelPath, "utf-8");
  
  // Удаляем старую функцию exportMonthToExcel, если она есть
  const startIdx = excelContent.indexOf("export async function exportMonthToExcel");
  if (startIdx !== -1) {
    excelContent = excelContent.substring(0, startIdx);
  }

  // Добавляем новую функцию с календарной сеткой
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

  // Группируем смены по сотрудникам
  const shiftsByUser = new Map<string, typeof input.shifts>();
  for (const s of input.shifts) {
    if (!shiftsByUser.has(s.userId)) shiftsByUser.set(s.userId, []);
    shiftsByUser.get(s.userId)!.push(s);
  }

  const monthStart = new Date(input.monthStartDate + "T00:00:00Z");
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth();
  const monthName = monthStart.toLocaleString("ru-RU", { month: "long", timeZone: "UTC" });

  // Вычисляем границы для сетки (с понедельника первой недели по воскресенье последней)
  const firstDay = new Date(Date.UTC(year, month, 1));
  const dow = firstDay.getUTCDay() === 0 ? 7 : firstDay.getUTCDay(); // 1=Пн, 7=Вс
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
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 18 },
    ];

    // --- Шапка ---
    ws.mergeCells("A1:F1");
    ws.getCell("A1").value = \`\${input.orgName} — \${emp.name}\`;
    ws.getCell("A1").font = { bold: true, size: 14 };
    ws.getCell("A1").alignment = { vertical: "middle" };
    ws.getRow(1).height = 30;

    // --- Сводка (Часы, Смены, Затраты) ---
    let totalHours = 0;
    for (const s of userShifts) {
      totalHours += hoursBetween(s.startTime, s.endTime);
    }
    const totalCost = Math.round(totalHours * (emp.hourlyRate || 0));

    ws.mergeCells("A2:C2");
    ws.getCell("A2").value = \`\${monthName} \${year}\`;
    ws.getCell("A2").font = { bold: true, size: 12, color: { argb: "FF6B7280" } };

    ws.getCell("D2").value = "СМЕН ЗА МЕСЯЦ:";
    ws.getCell("D2").font = { size: 9, color: { argb: "FF6B7280" }, bold: true };
    ws.getCell("D2").alignment = { horizontal: "right" };
    ws.getCell("E2").value = userShifts.length;
    ws.getCell("E2").font = { bold: true, size: 12 };

    ws.getCell("F2").value = "ЧАСОВ ЗА МЕСЯЦ:";
    ws.getCell("F2").font = { size: 9, color: { argb: "FF6B7280" }, bold: true };
    ws.getCell("F2").alignment = { horizontal: "right" };
    ws.getCell("G2").value = Math.round(totalHours * 10) / 10;
    ws.getCell("G2").font = { bold: true, size: 12 };

    ws.getCell("H2").value = "ЗАТРАТЫ:";
    ws.getCell("H2").font = { size: 9, color: { argb: "FF6B7280" }, bold: true };
    ws.getCell("H2").alignment = { horizontal: "right" };
    ws.getCell("I2").value = \`\${new Intl.NumberFormat("ru-RU").format(totalCost)} ₽\`;
    ws.getCell("I2").font = { bold: true, size: 12, color: { argb: "FF10B981" } };
    ws.getRow(2).height = 24;

    ws.mergeCells("A1:I1"); // Расширяем шапку до 9 колонок
    ws.mergeCells("A2:C2");

    // --- Шапка календаря ---
    const headerRow = ws.getRow(4);
    headerRow.values = [...WEEKDAYS, "ИТОГО ЗА НЕДЕЛЮ"];
    headerRow.font = { bold: true, size: 10, color: { argb: "FF64748B" } };
    headerRow.eachCell((c, col) => {
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      c.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
      if (col === 8) { // Итого
        c.font = { bold: true, size: 9, color: { argb: "FF475569" } };
        ws.getCell(\`H\${headerRow.number}\`).value = "ИТОГО ЗА\\nНЕДЕЛЮ";
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      }
    });
    headerRow.height = 36;
    // Заполняем 8-ю колонку (H) для всей сетки
    ws.getColumn(8).width = 18;

    // --- Отрисовка сетки ---
    let rowIdx = 5;
    let currentDay = new Date(gridStart);

    while (currentDay <= gridEnd) {
      let weekShifts = 0;
      let weekHours = 0;
      
      // Начинаем новую строку для недели
      const weekRow = ws.getRow(rowIdx);

      for (let i = 0; i < 7; i++) {
        const dateStr = currentDay.toISOString().slice(0, 10);
        const cell = weekRow.getCell(i + 1);
        
        const isOtherMonth = currentDay.getUTCMonth() !== month;
        const dayNum = currentDay.getUTCDate();
        
        // Ищем смену на этот день
        const dayShift = userShifts.find(s => s.shiftDate === dateStr);

        if (dayShift) {
          cell.value = \`\${dayShift.startTime}-\\n\${dayShift.endTime}\`;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } }; // Синий
          cell.font = { color: { argb: "FFFFFFFF" }, size: 9, bold: true };
          weekShifts++;
          weekHours += hoursBetween(dayShift.startTime, dayShift.endTime);
        } else if (isOtherMonth) {
          cell.value = dayNum;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } }; // Светло-серый для чужих месяцев
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

      // Итоговая колонка за неделю
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

      weekRow.height = 45; // Высота строки смены
      rowIdx++;
    }
  }

  return (await wb.xlsx.writeBuffer()) as Buffer;
}
`;

  fs.writeFileSync(excelPath, excelContent, "utf-8");
  console.log(`✅ [${excelPath}] Полностью перезаписан генератор Excel (сетка календаря).`);
  touchedFiles++;
}

if (touchedFiles > 0) {
  console.log(`\n🎉 Успешно! Изменено файлов: ${touchedFiles}`);
  console.log(`⚠️  ОБЯЗАТЕЛЬНО перезапустите бэкенд (npm run dev в корне)!`);
} else {
  console.log(`\n✨ Всё уже на месте.`);
}