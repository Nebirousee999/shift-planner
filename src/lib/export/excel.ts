import ExcelJS from "exceljs";

// ─── Утилиты ─────────────────────────────────────────
function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let m = eh * 60 + em - (sh * 60 + sm);
  if (m <= 0) m += 24 * 60;
  return m / 60;
}

function formatDateRU(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const months = [
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function dayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();
  return dow === 0 ? 6 : dow - 1;
}

function getWeekDates(weekStart: string): string[] {
  const out: string[] = [];
  const start = new Date(weekStart + "T00:00:00Z");
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ─── Экспорт графика недели ──────────────────────────

type WeekExportInput = {
  weekStartDate: string;
  orgName: string;
  shifts: {
    id: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    userName: string | null;
    templateName: string | null;
    templateColor: string | null;
  }[];
};

export async function exportWeekToExcel(
  input: WeekExportInput
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Планировщик смен";
  wb.created = new Date();

  const ws = wb.addWorksheet("График", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  // ─── Заголовок ───────────────────────────────────
  const dates = getWeekDates(input.weekStartDate);
  const firstDate = dates[0];
  const lastDate = dates[6];

  ws.mergeCells("A1:H1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `${input.orgName} — график смен`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;

  ws.mergeCells("A2:H2");
  const subtitleCell = ws.getCell("A2");
  subtitleCell.value = `${formatDateRU(firstDate)} — ${formatDateRU(
    lastDate
  )} ${new Date(firstDate + "T00:00:00Z").getUTCFullYear()}`;
  subtitleCell.font = { size: 11, color: { argb: "FF6B7280" } };
  subtitleCell.alignment = { horizontal: "center" };
  ws.getRow(2).height = 20;

  // ─── Шапка таблицы ───────────────────────────────
  const headerRow = ws.getRow(4);
  const headers = ["Сотрудник", ...dates.map((d, i) => `${WEEKDAYS[dayOfWeek(d)]} ${formatDateRU(d)}`)];
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF9CA3AF" } },
      bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
      left: { style: "thin", color: { argb: "FF9CA3AF" } },
      right: { style: "thin", color: { argb: "FF9CA3AF" } },
    };
  });
  headerRow.height = 36;

  // ─── Группируем смены по сотрудникам ─────────────
  const byUser = new Map<string, typeof input.shifts>();
  for (const s of input.shifts) {
    const key = s.userName ?? "Не назначен";
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key)!.push(s);
  }

  // ─── Строки сотрудников ──────────────────────────
  let rowIdx = 5;
  for (const [userName, shifts] of byUser) {
    const row = ws.getRow(rowIdx);
    const nameCell = row.getCell(1);
    nameCell.value = userName;
    nameCell.font = { bold: true, size: 10 };
    nameCell.alignment = { vertical: "middle" };
    nameCell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };

    dates.forEach((date, i) => {
      const cell = row.getCell(i + 2);
      const dayShifts = shifts.filter(
        (s) => String(s.shiftDate).slice(0, 10) === date
      );

      if (dayShifts.length === 0) {
        cell.value = "";
      } else {
        cell.value = dayShifts
          .map((s) => `${s.startTime}–${s.endTime}`)
          .join("\n");
      }

      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.font = { size: 10 };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };

      // Выходные — серый фон
      const dow = dayOfWeek(date);
      if (dow >= 5) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      }

      // Первая смена — подсветить цветом шаблона
      const first = dayShifts[0];
      if (first?.templateColor) {
        // Преобразуем #RRGGBB в ARGB
        const hex = first.templateColor.replace("#", "").toUpperCase();
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF" + hex },
        };
        cell.font = { size: 10, color: { argb: "FFFFFFFF" }, bold: true };
      }
    });

    row.height = 40;
    rowIdx++;
  }

  // ─── Итоговая строка «Часов» ─────────────────────
  const totalRow = ws.getRow(rowIdx);
  const totalCell = totalRow.getCell(1);
  totalCell.value = "Часов за неделю";
  totalCell.font = { bold: true, size: 10 };
  totalCell.alignment = { vertical: "middle" };
  totalCell.border = {
    top: { style: "medium", color: { argb: "FF374151" } },
    bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
    left: { style: "thin", color: { argb: "FFE5E7EB" } },
    right: { style: "thin", color: { argb: "FFE5E7EB" } },
  };

  dates.forEach((date, i) => {
    const cell = totalRow.getCell(i + 2);
    let total = 0;
    for (const s of input.shifts) {
      if (String(s.shiftDate).slice(0, 10) !== date) continue;
      total += hoursBetween(s.startTime, s.endTime);
    }
    cell.value = total > 0 ? Math.round(total * 10) / 10 : "";
    cell.alignment = { horizontal: "center" };
    cell.font = { bold: true, size: 10 };
    cell.border = {
      top: { style: "medium", color: { argb: "FF374151" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
  });

  // ─── Ширина колонок ──────────────────────────────
  ws.getColumn(1).width = 22;
  for (let i = 2; i <= 8; i++) {
    ws.getColumn(i).width = 14;
  }

  // ─── Возвращаем буфер ────────────────────────────
  return (await wb.xlsx.writeBuffer()) as Buffer;
}

// ─── Экспорт табеля за месяц ─────────────────────────

type TimesheetExportInput = {
  year: number;
  month: number;
  orgName: string;
  users: { id: string; name: string; hourlyRate: string | null }[];
  shifts: {
    userId: string | null;
    shiftDate: string;
    startTime: string;
    endTime: string;
  }[];
};

export async function exportTimesheetToExcel(
  input: TimesheetExportInput
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Планировщик смен";

  const ws = wb.addWorksheet("Табель", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  const monthName = new Date(input.year, input.month, 1).toLocaleString(
    "ru-RU",
    { month: "long" }
  );
  const daysInMonth = new Date(input.year, input.month + 1, 0).getDate();

  // ─── Заголовок ───────────────────────────────────
  ws.mergeCells(1, 1, 1, daysInMonth + 4);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${input.orgName} — табель за ${monthName} ${input.year}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center" };
  ws.getRow(1).height = 24;

  // ─── Шапка ───────────────────────────────────────
  const headerRow = ws.getRow(3);
  headerRow.getCell(1).value = "Сотрудник";
  headerRow.getCell(2).value = "Ставка";
  headerRow.getCell(3).value = "Часов";
  headerRow.getCell(4).value = "Сумма";
  for (let d = 1; d <= daysInMonth; d++) {
    headerRow.getCell(4 + d).value = d;
  }

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 28;

  // ─── Строки по сотрудникам ───────────────────────
  let rowIdx = 4;
  let grandTotalHours = 0;
  let grandTotalSum = 0;

  for (const u of input.users) {
    const row = ws.getRow(rowIdx);
    row.getCell(1).value = u.name;
    row.getCell(2).value = u.hourlyRate ? Number(u.hourlyRate) : "";
    row.getCell(2).numFmt = "#,##0 ₽";

    let userHours = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${input.year}-${String(input.month + 1).padStart(
        2,
        "0"
      )}-${String(d).padStart(2, "0")}`;
      const dayShifts = input.shifts.filter(
        (s) =>
          s.userId === u.id &&
          String(s.shiftDate).slice(0, 10) === dateStr
      );

      let dayHours = 0;
      for (const s of dayShifts) {
        dayHours += hoursBetween(s.startTime, s.endTime);
      }
      userHours += dayHours;

      const cell = row.getCell(4 + d);
      cell.value = dayHours > 0 ? Math.round(dayHours * 10) / 10 : "";
      cell.alignment = { horizontal: "center" };
      cell.font = { size: 9 };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    }

    row.getCell(3).value = Math.round(userHours * 10) / 10;
    row.getCell(3).font = { bold: true };
    row.getCell(3).alignment = { horizontal: "center" };

    const sum = u.hourlyRate ? Number(u.hourlyRate) * userHours : 0;
    row.getCell(4).value = sum > 0 ? sum : "";
    row.getCell(4).numFmt = "#,##0 ₽";
    row.getCell(4).font = { bold: true };
    row.getCell(4).alignment = { horizontal: "center" };

    // Рамки
    for (let c = 1; c <= 4 + daysInMonth; c++) {
      row.getCell(c).border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    }

    grandTotalHours += userHours;
    grandTotalSum += sum;
    rowIdx++;
  }

  // ─── Итог ────────────────────────────────────────
  const totalRow = ws.getRow(rowIdx);
  totalRow.getCell(1).value = "ИТОГО";
  totalRow.getCell(1).font = { bold: true, size: 11 };
  totalRow.getCell(3).value = Math.round(grandTotalHours * 10) / 10;
  totalRow.getCell(3).font = { bold: true, size: 11 };
  totalRow.getCell(3).alignment = { horizontal: "center" };
  totalRow.getCell(4).value = grandTotalSum;
  totalRow.getCell(4).numFmt = "#,##0 ₽";
  totalRow.getCell(4).font = { bold: true, size: 11 };
  totalRow.getCell(4).alignment = { horizontal: "center" };

  // ─── Ширина колонок ──────────────────────────────
  ws.getColumn(1).width = 24;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 10;
  ws.getColumn(4).width = 14;
  for (let d = 1; d <= daysInMonth; d++) {
    ws.getColumn(4 + d).width = 4;
  }

  return (await wb.xlsx.writeBuffer()) as Buffer;
}

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
    let sheetName = emp.name.replace(/[\\\/?*\[\]:]/g, "").slice(0, 31) || "Сотрудник";
    
    const ws = wb.addWorksheet(sheetName);
    ws.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1 };

    // Заголовок
    ws.mergeCells("A1:D1");
    ws.getCell("A1").value = `${input.orgName} — ${emp.name}`;
    ws.getCell("A1").font = { bold: true, size: 14 };
    ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 30;

    ws.mergeCells("A2:D2");
    ws.getCell("A2").value = `График смен на месяц (с ${new Date(input.monthStartDate + "T00:00:00Z").toLocaleDateString("ru-RU", { timeZone: "UTC" })})`;
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
      row.values = [dateStr, dowStr, `${s.startTime}–${s.endTime}`, s.templateName || "—"];
      
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
