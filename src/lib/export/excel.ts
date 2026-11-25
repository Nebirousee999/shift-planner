import ExcelJS from "exceljs";

// ─── Утилиты ─────────────────────────────────────────
function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let m = eh * 60 + em - (sh * 60 + sm);
  if (m <= 0) m += 24 * 60;
  return m / 60;
}

function nightHoursBetween(start: string, end: string): number {
  const toM = (t: string): number => {
    const [h, mm] = t.split(":").map(Number);
    return h * 60 + mm;
  };
  let s = toM(start);
  let e = toM(end);
  if (e <= s) e += 24 * 60;
  let n = 0;
  for (let t = s; t < e; t++) {
    const hour = Math.floor((t % 1440) / 60);
    if (hour >= 22 || hour < 6) n++;
  }
  return n / 60;
}

function isNightShift(start: string, end: string): boolean {
  return nightHoursBetween(start, end) > 0;
}



function addBranding(ws: ExcelJS.Worksheet) {
  const lastCol = ws.columnCount || 8;
  const footerRow = ws.rowCount + 2;
  ws.mergeCells(footerRow, 1, footerRow, lastCol);
  const cell = ws.getCell(footerRow, 1);
  cell.value = { text: "Сделано в Shift Planner → shift-planner.ru", hyperlink: "https://shift-planner.ru" };
  cell.font = { size: 11, bold: true, color: { argb: "FF2563EB" }, underline: true };
  cell.alignment = { horizontal: "center", vertical: "middle" };
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

  addBranding(ws);
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

  addBranding(ws);
  return (await wb.xlsx.writeBuffer()) as Buffer;
}

export async function exportYearToExcel(input: {
  orgName: string;
  year: number;
  employee: { id: string; name: string; hourlyRate?: number };
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
  
  const userShifts = input.shifts;
  const emp = input.employee;
  const year = input.year;
  const WEEKDAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

  let totalYearShifts = 0;
  let totalYearHours = 0;
  let totalYearNightShifts = 0;
  let totalYearCost = 0;
  const monthSummaries = [];

  // Генерируем 12 листов
  for (let m = 0; m < 12; m++) {
    const monthName = new Date(Date.UTC(year, m, 1)).toLocaleString("ru-RU", { month: "long", timeZone: "UTC" });
    const ws = wb.addWorksheet(monthName, {
      pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1 },
    });

    ws.columns = [
      { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 },
      { width: 13 }, { width: 13 }, { width: 13 }, { width: 18 },
    ];

    const monthStart = new Date(Date.UTC(year, m, 1));
    const dowStart = monthStart.getUTCDay() === 0 ? 7 : monthStart.getUTCDay();
    const gridStart = new Date(monthStart);
    gridStart.setUTCDate(gridStart.getUTCDate() - dowStart + 1);

    const lastDay = new Date(Date.UTC(year, m + 1, 0));
    const dowEnd = lastDay.getUTCDay() === 0 ? 7 : lastDay.getUTCDay();
    const gridEnd = new Date(lastDay);
    gridEnd.setUTCDate(gridEnd.getUTCDate() + (7 - dowEnd));

    const monthShifts = userShifts.filter(s => {
      const d = new Date(s.shiftDate + "T00:00:00Z");
      return d.getUTCFullYear() === year && d.getUTCMonth() === m;
    });

    let mShifts = 0, mHours = 0, mNightHours = 0, mNightShifts = 0;
    for (const s of monthShifts) {
      mShifts++;
      const h = hoursBetween(s.startTime, s.endTime);
      mHours += h;
      const nh = nightHoursBetween(s.startTime, s.endTime);
      if (nh > 0) { mNightShifts++; mNightHours += nh; }
    }
    const mCost = Math.round(mHours * (emp.hourlyRate || 0));

    totalYearShifts += mShifts;
    totalYearHours += mHours;
    totalYearNightShifts += mNightShifts;
    totalYearCost += mCost;
    monthSummaries.push({ month: monthName, shifts: mShifts, hours: Math.round(mHours * 10) / 10, nightShifts: mNightShifts, cost: mCost });

    // --- Шапка листа ---
    ws.mergeCells("A1:H1");
    const titleCell = ws.getCell("A1");
    titleCell.value = `${input.orgName} — ${emp.name}`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(1).height = 30;

    ws.mergeCells("A2:C2");
    ws.getCell("A2").value = `${monthName} ${year}`;
    ws.getCell("A2").font = { bold: true, size: 11, color: { argb: "FF64748B" } };
    ws.getCell("A2").alignment = { vertical: "middle" };

    ws.getCell("D2").value = "СМЕН ЗА МЕСЯЦ:";
    ws.getCell("D2").font = { size: 9, bold: true, color: { argb: "FF64748B" } };
    ws.getCell("D2").alignment = { horizontal: "right", vertical: "middle" };
    ws.getCell("E2").value = mShifts;
    ws.getCell("E2").font = { bold: true, size: 12 };
    ws.getCell("E2").alignment = { horizontal: "center", vertical: "middle" };

    ws.getCell("F2").value = "ЧАСОВ ЗА МЕСЯЦ:";
    ws.getCell("F2").font = { size: 9, bold: true, color: { argb: "FF64748B" } };
    ws.getCell("F2").alignment = { horizontal: "right", vertical: "middle" };
    ws.getCell("G2").value = Math.round(mHours * 10) / 10;
    ws.getCell("G2").font = { bold: true, size: 12 };
    ws.getCell("G2").alignment = { horizontal: "center", vertical: "middle" };

    ws.getCell("H2").value = `ЗАТРАТЫ: ${new Intl.NumberFormat("ru-RU").format(mCost)} ₽`;
    ws.getCell("H2").font = { bold: true, size: 10, color: { argb: "FF10B981" } };
    ws.getCell("H2").alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 24;

    if (mNightShifts > 0) {
      ws.mergeCells("A3:H3");
      const nightCell = ws.getCell("A3");
      nightCell.value = `Ночных смен: ${mNightShifts} · ночных часов: ${Math.round(mNightHours * 10) / 10} (с 22:00 до 06:00)`;
      nightCell.font = { size: 10, bold: true, color: { argb: "FF4338CA" } };
      nightCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(3).height = 20;
    }

    // --- Сетка ---
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

    let rowIdx = 5;
    let currentDay = new Date(gridStart);

    while (currentDay <= gridEnd) {
      let weekShifts = 0;
      let weekHours = 0;
      let weekNightHours = 0;
      const weekRow = ws.getRow(rowIdx);

      for (let i = 0; i < 7; i++) {
        const dateStr = currentDay.toISOString().slice(0, 10);
        const cell = weekRow.getCell(i + 1);

        const isOtherMonth = currentDay.getUTCMonth() !== m;
        const dayNum = currentDay.getUTCDate();
        const dayShift = userShifts.find(s => s.shiftDate === dateStr);

        if (dayShift) {
          const isNight = nightHoursBetween(dayShift.startTime, dayShift.endTime) > 0;
          cell.value = (isNight ? "🌙 " : "") + `${dayShift.startTime}-\n${dayShift.endTime}`;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isNight ? "FF312E81" : "FF3B82F6" } };
          cell.font = { color: { argb: "FFFFFFFF" }, size: 9, bold: true };
          weekShifts++;
          weekHours += hoursBetween(dayShift.startTime, dayShift.endTime);
          if (isNight) weekNightHours += nightHoursBetween(dayShift.startTime, dayShift.endTime);
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
      totalCell.value = `${weekShifts} см.\n${Math.round(weekHours * 10) / 10} ч.` + (weekNightHours > 0 ? `\n🌙 ${Math.round(weekNightHours * 10) / 10} н.ч.` : "");
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
    addBranding(ws);
  }

  // ─── Лист "Итоги года" ───
  const summaryWs = wb.addWorksheet("Итоги года", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  summaryWs.columns = [{ width: 20 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 20 }];
  
  summaryWs.mergeCells("A1:E1");
  const sumTitle = summaryWs.getCell("A1");
  sumTitle.value = `${input.orgName} — Итоги за ${year} год (${emp.name})`;
  sumTitle.font = { bold: true, size: 14 };
  sumTitle.alignment = { horizontal: "center", vertical: "middle" };
  summaryWs.getRow(1).height = 30;

  const sumHeader = summaryWs.getRow(3);
  sumHeader.values = ["Месяц", "Смены", "Часы", "Ночные смены", "Затраты"];
  sumHeader.font = { bold: true, size: 10 };
  sumHeader.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    c.alignment = { horizontal: "center" };
  });

  let sRow = 4;
  for (const m of monthSummaries) {
    const row = summaryWs.getRow(sRow);
    row.values = [m.month, m.shifts, m.hours, m.nightShifts, m.cost];
    row.getCell(1).alignment = { horizontal: "left" };
    row.getCell(5).numFmt = "#,##0 ₽";
    row.eachCell((c) => {
      c.border = { top: { style: "thin", color: { argb: "FFE5E7EB" } }, bottom: { style: "thin", color: { argb: "FFE5E7EB" } }, left: { style: "thin", color: { argb: "FFE5E7EB" } }, right: { style: "thin", color: { argb: "FFE5E7EB" } } };
    });
    sRow++;
  }

  const totalRow = summaryWs.getRow(sRow);
  totalRow.values = ["ИТОГО ЗА ГОД", totalYearShifts, Math.round(totalYearHours * 10) / 10, totalYearNightShifts, totalYearCost];
  totalRow.font = { bold: true, size: 11 };
  totalRow.getCell(5).numFmt = "#,##0 ₽";
  totalRow.eachCell((c) => {
    c.border = { top: { style: "medium", color: { argb: "FF374151" } }, bottom: { style: "thin", color: { argb: "FFE5E7EB" } }, left: { style: "thin", color: { argb: "FFE5E7EB" } }, right: { style: "thin", color: { argb: "FFE5E7EB" } } };
  });
  addBranding(summaryWs);

  return (await wb.xlsx.writeBuffer()) as Buffer;
}

// ─── Экспорт графика на месяц (по вкладкам для каждого сотрудника) ─────────────────────────

// ─── Экспорт графика на месяц в виде календарной сетки ───

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
    let sheetName = emp.name.replace(/[\\\/?*\[\]:]/g, "").slice(0, 31) || "Сотрудник";
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
    const totalNightHours = userShifts.reduce((acc, s) => acc + nightHoursBetween(s.startTime, s.endTime), 0);
    const totalNightShifts = userShifts.filter((s) => nightHoursBetween(s.startTime, s.endTime) > 0).length;

    // --- Шапка ---
    ws.mergeCells("A1:H1");
    const titleCell = ws.getCell("A1");
    titleCell.value = `${input.orgName} — ${emp.name}`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(1).height = 30;

    // --- Сводка ---
    ws.mergeCells("A2:C2");
    ws.getCell("A2").value = `${monthName} ${year}`;
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

    ws.getCell("H2").value = `ЗАТРАТЫ: ${new Intl.NumberFormat("ru-RU").format(totalCost)} ₽`;
    ws.getCell("H2").font = { bold: true, size: 10, color: { argb: "FF10B981" } };
    ws.getCell("H2").alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 24;

    if (totalNightShifts > 0) {
      ws.mergeCells("A3:H3");
      const nightCell = ws.getCell("A3");
      nightCell.value = `Ночных смен: ${totalNightShifts} · ночных часов: ${Math.round(totalNightHours * 10) / 10} (с 22:00 до 06:00)`;
      nightCell.font = { size: 10, bold: true, color: { argb: "FF4338CA" } };
      nightCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(3).height = 20;
    }

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
      let weekNightHours = 0;
      const weekRow = ws.getRow(rowIdx);

      for (let i = 0; i < 7; i++) {
        const dateStr = currentDay.toISOString().slice(0, 10);
        const cell = weekRow.getCell(i + 1);

        const isOtherMonth = currentDay.getUTCMonth() !== month;
        const dayNum = currentDay.getUTCDate();
        const dayShift = userShifts.find(s => s.shiftDate === dateStr);

        if (dayShift) {
          const isNight = nightHoursBetween(dayShift.startTime, dayShift.endTime) > 0;
          cell.value = (isNight ? "\u{1F319} " : "") + `${dayShift.startTime}-\n${dayShift.endTime}`;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isNight ? "FF312E81" : "FF3B82F6" } };
          cell.font = { color: { argb: "FFFFFFFF" }, size: 9, bold: true };
          weekShifts++;
          weekHours += hoursBetween(dayShift.startTime, dayShift.endTime);
          if (isNight) weekNightHours += nightHoursBetween(dayShift.startTime, dayShift.endTime);
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
      totalCell.value = `${weekShifts} см.\n${Math.round(weekHours * 10) / 10} ч.` + (weekNightHours > 0 ? `\n\u{1F319} ${Math.round(weekNightHours * 10) / 10} н.ч.` : "");
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

    addBranding(ws);
  }

  return (await wb.xlsx.writeBuffer()) as Buffer;
}
