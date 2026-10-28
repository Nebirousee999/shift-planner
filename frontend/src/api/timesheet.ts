import { api } from "./client";

export type TimesheetCellStatus = "YA" | "V" | "VV" | "B" | "OT" | "NN" | "PR" | null;

export type TimesheetCell = {
  status: TimesheetCellStatus;
  hours?: number;
  shiftId?: string;
  templateName?: string | null;
};

export type TimesheetDay = {
  date: string;
  dayNumber: number;
  isWeekend: boolean;
  cell: TimesheetCell;
};

export type TimesheetUser = {
  id: string;
  name: string;
  position: string | null;
  hourlyRate: string | null;
  paymentType: "HOURLY" | "MONTHLY";
  employmentType: "GPH" | "SHTAT";
  days: TimesheetDay[];
  totalHours: number;
  totalPayGross: number;
  totalPayNet: number;
  attendanceDays: number;
};

export type TimesheetResponse = {
  year: number;
  month: number;
  daysInMonth: number;
  timeTrackingOn: boolean;
  taxRate: number;
  users: TimesheetUser[];
  totals: { hours: number; gross: number; net: number; tax: number; attendance: number };
};

export const timesheetApi = {
  get: async (year: number, month: number): Promise<TimesheetResponse> => {
    const { data } = await api.get<TimesheetResponse>("/timesheet", { params: { year, month } });
    return data;
  },
};