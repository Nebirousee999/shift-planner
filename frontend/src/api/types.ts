export type User = {
  id: string;
  email: string;
  name?: string;
  orgId: string;
  role: "OWNER" | "MANAGER" | "EMPLOYEE";
};

export type AuthResponse = {
  user: User;
  token: string;
};

export type ShiftTemplate = {
  id: string;
  orgId: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
};

export type ScheduleWeek = {
  id: string;
  orgId: string;
  weekStartDate: string;
  status: "DRAFT" | "PUBLISHED" | "LOCKED";
  publishedAt: string | null;
  createdAt: string;
};

export type ScheduledShift = {
  id: string;
  weekId: string;
  templateId: string | null;
  userId: string | null;
  shiftDate: string;
  startTime: string;
  endTime: string;
  status: string;
};