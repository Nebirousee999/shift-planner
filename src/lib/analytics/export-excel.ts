import ExcelJS from "exceljs";
import type { AnalyticsSummary } from "../../modules/analytics/analytics.service.js";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Владелец",
  MANAGER: "Менеджер",
  EMPLOYEE: "Сотрудник",
};

const MONEY_FMT = '#,##0 "₽"';
const HOURS_FMT = '#,##0.0 "ч"';

function setHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  };
  row.alignment = { vertical: "middle", horizontal: "left" };
  row.height = 26;
}

function applyBordersAndZebra(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row, idx) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      cell.alignment = { vertical: "middle" };
    });
    if (idx > 1 && idx % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      });
    }
  });
}

export async function buildAnalyticsExcel(
  data: AnalyticsSummary
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Планировщик смен";
  wb.created = new Date();

  // ═══ Лист 1: Сводка ═══
  const s = wb.addWorksheet("Сводка");
  s.columns = [{ width: 36 }, { width: 24 }, { width: 16 }];

  s.mergeCells("A1:C1");
  s.getCell("A1").value = "Аналитика";
  s.getCell("A1").font = { bold: true, size: 18, color: { argb: "FF0F172A" } };
  s.getRow(1).height = 32;

  s.mergeCells("A2:C2");
  s.getCell("A2").value = `Период: ${data.period.from} — ${data.period.to}`;
  s.getCell("A2").font = { size: 11, color: { argb: "FF475569" } };

  s.mergeCells("A3:C3");
  s.getCell("A3").value = `Сравнение с: ${data.prevPeriod.from} — ${data.prevPeriod.to}`;
  s.getCell("A3").font = { size: 10, color: { argb: "FF94A3B8" }, italic: true };

  const headRow = s.getRow(5);
  headRow.values = ["Показатель", "Значение", "MoM"];
  setHeader(headRow);

  type Metric = [string, string | number, number | undefined, "money" | "number" | "pct"];
  const metrics: Metric[] = [
    ["План часов", data.totals.hours, data.totals.mom.hours, "number"],
    ["Смен", data.totals.shifts, data.totals.mom.shifts, "number"],
    ["План ФОТ", data.totals.payroll, data.totals.mom.payroll, "money"],
    ["Факт ФОТ", data.totals.actualPayroll, data.totals.mom.actualPayroll, "money"],
    ["Средняя цена смены", data.totals.avgCost, data.totals.mom.avgCost, "money"],
    ["Стоимость переработок", data.totals.overtimeCost, undefined, "money"],
    ["Фактические часы", data.planVsFact.actualHours, undefined, "number"],
    ["План vs Факт", data.planVsFact.diffPercent, undefined, "pct"],
  ];

  let r = 6;
  for (const [label, value, mom, kind] of metrics) {
    const row = s.getRow(r);
    row.values = [label, value, mom !== undefined ? mom : null];

    row.getCell(2).numFmt = kind === "money" ? MONEY_FMT : kind === "pct" ? "+0.0;-0.0;0.0" : "#,##0.0";
    row.getCell(2).alignment = { horizontal: "right" };

    if (mom !== undefined) {
      const cell = row.getCell(3);
      cell.numFmt = '+0.0"%";-0.0"%";0"%"';
      cell.alignment = { horizontal: "right" };
      cell.font = {
        bold: true,
        color: { argb: mom > 0 ? "FF16A34A" : mom < 0 ? "FFDC2626" : "FF94A3B8" },
      };
    } else {
      row.getCell(3).value = "—";
      row.getCell(3).alignment = { horizontal: "right" };
      row.getCell(3).font = { color: { argb: "FFCBD5E1" } };
    }
    r++;
  }

  applyBordersAndZebra(s);

  // ═══ Лист 2: Сотрудники ═══
  const u = wb.addWorksheet("Сотрудники");
  u.columns = [
    { header: "Сотрудник", key: "name", width: 28 },
    { header: "Роль", key: "role", width: 14 },
    { header: "Ставка, ₽/ч", key: "rate", width: 14, style: { numFmt: "#,##0" } },
    { header: "Смен", key: "shifts", width: 10, style: { numFmt: "#,##0" } },
    { header: "План ч", key: "planH", width: 12, style: { numFmt: HOURS_FMT } },
    { header: "Факт ч", key: "factH", width: 12, style: { numFmt: HOURS_FMT } },
    { header: "План ФОТ", key: "planPay", width: 16, style: { numFmt: MONEY_FMT } },
    { header: "Факт ФОТ", key: "factPay", width: 16, style: { numFmt: MONEY_FMT } },
    { header: "Переработка", key: "ot", width: 16, style: { numFmt: MONEY_FMT } },
  ];
  setHeader(u.getRow(1));

  for (const usr of data.users) {
    u.addRow({
      name: usr.name,
      role: ROLE_LABELS[usr.role] ?? usr.role,
      rate: usr.hourlyRate ?? null,
      shifts: usr.shiftsCount,
      planH: usr.plannedHours,
      factH: usr.actualHours,
      planPay: usr.plannedPayroll,
      factPay: usr.actualPayroll,
      ot: usr.overtimeCost || null,
    });
  }

  const totalRow = u.addRow({
    name: "ИТОГО",
    role: "",
    rate: null,
    shifts: data.totals.shifts,
    planH: data.totals.hours,
    factH: data.planVsFact.actualHours,
    planPay: data.totals.payroll,
    factPay: data.totals.actualPayroll,
    ot: data.totals.overtimeCost || null,
  });
  totalRow.font = { bold: true, color: { argb: "FF0F172A" } };
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };

  applyBordersAndZebra(u);

  // ═══ Лист 3: По дням недели ═══
  const w = wb.addWorksheet("По дням недели");
  w.columns = [
    { header: "День", key: "label", width: 12 },
    { header: "Смен", key: "shifts", width: 10, style: { numFmt: "#,##0" } },
    { header: "Часы", key: "hours", width: 12, style: { numFmt: HOURS_FMT } },
    { header: "ФОТ", key: "payroll", width: 18, style: { numFmt: MONEY_FMT } },
  ];
  setHeader(w.getRow(1));
  for (const d of data.byWeekday) {
    w.addRow({ label: d.label, shifts: d.shifts, hours: d.plannedHours, payroll: d.payroll });
  }
  applyBordersAndZebra(w);

  // ═══ Лист 4: По должностям ═══
  const p = wb.addWorksheet("По должностям");
  p.columns = [
    { header: "Должность", key: "position", width: 28 },
    { header: "Смен", key: "shifts", width: 10, style: { numFmt: "#,##0" } },
    { header: "Часы", key: "hours", width: 12, style: { numFmt: HOURS_FMT } },
    { header: "ФОТ", key: "payroll", width: 18, style: { numFmt: MONEY_FMT } },
    { header: "% от ФОТ", key: "percent", width: 12, style: { numFmt: '0.0"%"' } },
  ];
  setHeader(p.getRow(1));
  for (const pos of data.byPosition) {
    p.addRow({
      position: pos.position,
      shifts: pos.shifts,
      hours: pos.plannedHours,
      payroll: pos.payroll,
      percent: pos.percent,
    });
  }
  applyBordersAndZebra(p);

  return (await wb.xlsx.writeBuffer()) as Buffer;
}