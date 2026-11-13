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
// 1. Добавляем новую функцию в excel.ts
// ═══════════════════════════════════════════════════════
const excelPath = path.join(ROOT, "src/lib/export/excel.ts");
if (fs.existsSync(excelPath)) {
  let excelContent = fs.readFileSync(excelPath, "utf-8");
  if (!excelContent.includes("exportMonthToExcel")) {
    excelContent += `

// ─── Экспорт графика на месяц (по вкладкам для каждого сотрудника) ─────────────────────────
export async function exportMonthToExcel(input: {
  orgName: string;
  monthStartDate: string;
  employees: { id: string; name: string }[];
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

  // Сортируем смены внутри каждого сотрудника
  for (const userShifts of shiftsByUser.values()) {
    userShifts.sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));
  }

  // Создаем вкладку для каждого сотрудника
  for (const emp of input.employees) {
    const userShifts = shiftsByUser.get(emp.id) || [];
    let sheetName = emp.name.replace(/[\\\\\\/?*\\[\\]:]/g, "").slice(0, 31) || "Сотрудник";
    
    const ws = wb.addWorksheet(sheetName);
    ws.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1 };

    // Заголовок
    ws.mergeCells("A1:D1");
    ws.getCell("A1").value = \`\${input.orgName} — \${emp.name}\`;
    ws.getCell("A1").font = { bold: true, size: 14 };
    ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 30;

    ws.mergeCells("A2:D2");
    ws.getCell("A2").value = \`График смен на месяц (с \${new Date(input.monthStartDate + "T00:00:00Z").toLocaleDateString("ru-RU", { timeZone: "UTC" })})\`;
    ws.getCell("A2").font = { size: 11, color: { argb: "FF6B7280" } };
    ws.getCell("A2").alignment = { horizontal: "center" };

    // Шапка таблицы
    const headerRow = ws.getRow(4);
    headerRow.values = ["Дата", "День недели", "Время смены", "Шаблон"];
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = { bottom: { style: "thin" } };
    });
    headerRow.height = 24;

    // Данные
    let rowIdx = 5;
    for (const s of userShifts) {
      const d = new Date(s.shiftDate + "T00:00:00Z");
      const dateStr = d.toLocaleDateString("ru-RU", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
      const dow = d.getUTCDay();
      const dowStr = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][dow];

      const row = ws.getRow(rowIdx);
      row.values = [dateStr, dowStr, \`\${s.startTime}–\${s.endTime}\`, s.templateName || "—"];
      
      if (s.templateColor) {
        const hex = s.templateColor.replace("#", "").toUpperCase();
        const colorCell = row.getCell(3);
        colorCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + hex } };
        colorCell.font = { color: { argb: "FFFFFFFF" }, bold: true };
      }

      row.eachCell((c) => {
        c.alignment = { vertical: "middle", horizontal: "center" };
        c.border = {
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
      row.height = 22;
      rowIdx++;
    }

    ws.columns = [
      { width: 14 },
      { width: 14 },
      { width: 20 },
      { width: 25 },
    ];
  }

  return (await wb.xlsx.writeBuffer()) as Buffer;
}
`;
    fs.writeFileSync(excelPath, excelContent, "utf-8");
    console.log(`✅ [${excelPath}] Добавлена новая функция exportMonthToExcel.`);
    touchedFiles++;
  } else {
    console.log(`⏭  [${excelPath}] Функция exportMonthToExcel уже существует.`);
  }
}

// ═══════════════════════════════════════════════════════
// 2. Обновляем auth.service.ts (собираем данные за месяц)
// ═══════════════════════════════════════════════════════
patchFile("src/modules/auth/auth.service.ts", [
  {
    label: "Импорт exportMonthToExcel",
    search: `import { exportWeekToExcel } from "../../lib/export/excel.js";`,
    replace: `import { exportMonthToExcel } from "../../lib/export/excel.js";`
  },
  {
    label: "Изменение переменной weekDataForExport на excelDataForExport",
    search: `let weekDataForExport = null;`,
    replace: `let excelDataForExport = null;`
  },
  {
    label: "Сбор данных за все 4 недели",
    search: `        const firstWeekShifts = shiftsToInsert.filter(s => s.weekId === weeksMap[0].id);
        weekDataForExport = {
          weekStartDate: monday,
          orgName: org.name,
          shifts: firstWeekShifts.map(s => ({
            id: Math.random().toString(),
            shiftDate: s.shiftDate,
            startTime: s.startTime,
            endTime: s.endTime,
            userName: createdEmployees.find(e => e.id === s.userId)?.name || "—",
            templateName: "Смена",
            templateColor: "#3B82F6"
          }))
        };`,
    replace: `        const allShiftsForExport = shiftsToInsert.map(s => ({
          userId: s.userId,
          userName: createdEmployees.find(e => e.id === s.userId)?.name || "—",
          shiftDate: s.shiftDate,
          startTime: s.startTime,
          endTime: s.endTime,
          templateName: "Смена",
          templateColor: "#3B82F6"
        }));

        excelDataForExport = {
          orgName: org.name,
          monthStartDate: monday,
          employees: createdEmployees.map(e => ({ id: e.id, name: e.name })),
          shifts: allShiftsForExport
        };`
  },
  {
    label: "Изменение возвращаемого объекта из транзакции",
    search: `return { org, user, weekDataForExport, firstWeekId };`,
    replace: `return { org, user, excelDataForExport, firstWeekId };`
  },
  {
    label: "Обновление вызова генератора Excel",
    search: `    let excelBuffer = null;
    if (result.weekDataForExport && result.weekDataForExport.shifts.length > 0) {
      try {
        excelBuffer = await exportWeekToExcel(result.weekDataForExport);
      } catch (e) {
        console.error("Ошибка генерации Excel:", e);
      }
    }`,
    replace: `    let excelBuffer = null;
    if (result.excelDataForExport && result.excelDataForExport.shifts.length > 0) {
      try {
        excelBuffer = await exportMonthToExcel(result.excelDataForExport);
      } catch (e) {
        console.error("Ошибка генерации Excel:", e);
      }
    }`
  }
]);

// ═══════════════════════════════════════════════════════
// 3. Обновляем имя файла в письме
// ═══════════════════════════════════════════════════════
patchFile("src/lib/mailer.service.ts", [
  {
    label: "Изменение названия файла в письме",
    search: `filename: "График_смен.xlsx",`,
    replace: `filename: "График_на_месяц.xlsx",`
  }
]);

if (touchedFiles > 0) {
  console.log(`\n🎉 Успешно! Изменено файлов: ${touchedFiles}`);
  console.log(`⚠️  ОБЯЗАТЕЛЬНО перезапустите бэкенд (npm run dev в корне)!`);
} else {
  console.log(`\n✨ Всё уже на месте.`);
}