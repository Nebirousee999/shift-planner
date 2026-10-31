import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  date,
  decimal,
  integer,
  numeric,
  boolean,
  pgEnum,
  jsonb,
  text,
  primaryKey,
} from "drizzle-orm/pg-core";

// ─── ENUM ──────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["OWNER", "MANAGER", "EMPLOYEE"]);
export const scheduleStatusEnum = pgEnum("schedule_status", ["DRAFT", "PUBLISHED", "LOCKED"]);
export const shiftStatusEnum = pgEnum("shift_status", [
  "SCHEDULED", "CONFIRMED", "SWAP_REQUESTED", "SWAPPED", "CALLED_OUT", "NO_SHOW",
]);
export const swapStatusEnum = pgEnum("swap_status", ["PENDING", "APPROVED", "DENIED"]);
export const vacationStatusEnum = pgEnum("vacation_status", ["PENDING", "APPROVED", "REJECTED"]);
export const shiftChangeStatusEnum = pgEnum("shift_change_status", ["PENDING", "APPROVED", "REJECTED"]);
export const shiftChangeKindEnum = pgEnum("shift_change_kind", ["UPDATE", "CREATE"]);

// ─── ORGANIZATIONS ─────────────────────────────────────
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  city: varchar("city", { length: 100 }),
  directorName: varchar("director_name", { length: 255 }),
  inn: varchar("inn", { length: 20 }),
  legalAddress: varchar("legal_address", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  timeTrackingEnabled: boolean("time_tracking_enabled").default(true).notNull(),
  overtimeMultiplier1: numeric("overtime_multiplier_1").default("1.5").notNull(),
  overtimeMultiplier2: numeric("overtime_multiplier_2").default("2.0").notNull(),
  maxLocations: integer("max_locations").default(1).notNull(),
  taxRate: numeric("tax_rate").default("13").notNull(),
  positionHeaderOpacity: integer("position_header_opacity").default(70).notNull(),
  positionRowOpacity: integer("position_row_opacity").default(20).notNull(),
  requireShiftApproval: boolean("require_shift_approval").default(true).notNull(),
  disciplineEditWindowDays: integer("discipline_edit_window_days").default(3).notNull(),
});

// ─── LOCATIONS ─────────────────────────────────────────
export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


export const paymentTypeEnum = pgEnum("payment_type", ["HOURLY", "MONTHLY"]);
export const employmentTypeEnum = pgEnum("employment_type", ["GPH", "SHTAT"]);


// ─── USERS ─────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: roleEnum("role").default("EMPLOYEE").notNull(),
  position: varchar("position", { length: 255 }),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  paymentType: paymentTypeEnum("payment_type").default("HOURLY").notNull(),
  employmentType: employmentTypeEnum("employment_type").default("SHTAT").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── USER LOCATIONS ────────────────────────────────────
export const userLocations = pgTable(
  "user_locations",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    locationId: uuid("location_id")
      .references(() => locations.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.locationId] }),
  })
);

// ─── SHIFT TEMPLATES ───────────────────────────────────
export const shiftTemplates = pgTable("shift_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  startTime: varchar("start_time", { length: 5 }).notNull(),
  endTime: varchar("end_time", { length: 5 }).notNull(),
  color: varchar("color", { length: 7 }).default("#3B82F6").notNull(),
});

// ─── SCHEDULE WEEKS ────────────────────────────────────
export const scheduleWeeks = pgTable("schedule_weeks", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  locationId: uuid("location_id")
    .references(() => locations.id, { onDelete: "cascade" })
    .notNull(),
  weekStartDate: date("week_start_date").notNull(),
  status: scheduleStatusEnum("status").default("DRAFT").notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── SCHEDULED SHIFTS ──────────────────────────────────
export const scheduledShifts = pgTable("scheduled_shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekId: uuid("week_id")
    .references(() => scheduleWeeks.id, { onDelete: "cascade" })
    .notNull(),
  templateId: uuid("template_id").references(() => shiftTemplates.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id),
  shiftDate: date("shift_date").notNull(),
  startTime: varchar("start_time", { length: 5 }).notNull(),
  endTime: varchar("end_time", { length: 5 }).notNull(),
  status: shiftStatusEnum("status").default("SCHEDULED").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  latenessMinutes: integer("lateness_minutes").default(0).notNull(),
  earlyLeaveMinutes: integer("early_leave_minutes").default(0).notNull(),
  overtimeMinutes: integer("overtime_minutes").default(0).notNull(),
  isUnknownAbsence: boolean("is_unknown_absence").default(false).notNull(),
  isNoShow: boolean("is_no_show").default(false).notNull(),
});

// ─── AVAILABILITY ──────────────────────────────────────
export const availability = pgTable("availability", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
  note: varchar("note", { length: 255 }),
});

// ─── SHIFT SWAP REQUESTS ───────────────────────────────
export const shiftSwapRequests = pgTable("shift_swap_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  shiftId: uuid("shift_id").references(() => scheduledShifts.id, { onDelete: "cascade" }).notNull(),
  requestedBy: uuid("requested_by").references(() => users.id).notNull(),
  swapWithUserId: uuid("swap_with_user_id").references(() => users.id),
  status: swapStatusEnum("status").default("PENDING").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── TIME ENTRIES ──────────────────────────────────────
export const timeEntries = pgTable("time_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  shiftId: uuid("shift_id").references(() => scheduledShifts.id),
  clockIn: timestamp("clock_in"),
  clockOut: timestamp("clock_out"),
  source: varchar("source", { length: 20 }).default("web").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── GENERATED DOCUMENTS ──────────────────────────────
export const generatedDocuments = pgTable("generated_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  type: varchar("type", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  params: jsonb("params").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── VACATIONS ─────────────────────────────────────────
export const vacations = pgTable("vacations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  comment: varchar("comment", { length: 255 }),
  status: vacationStatusEnum("status").default("APPROVED").notNull(),
  previousStartDate: date("previous_start_date"),
  previousEndDate: date("previous_end_date"),
  previousComment: varchar("previous_comment", { length: 255 }),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── CUSTOM DOCUMENT TEMPLATES ─────────────────────────
export const documentCustomTemplates = pgTable("document_custom_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  content: text("content").notNull(),
  fileName: varchar("file_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── SHIFT CHANGE REQUESTS ─────────────────────────────
export const shiftChangeRequests = pgTable("shift_change_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  shiftId: uuid("shift_id").references(() => scheduledShifts.id, { onDelete: "cascade" }),
  kind: shiftChangeKindEnum("kind").default("UPDATE").notNull(),
  weekId: uuid("week_id").references(() => scheduleWeeks.id, { onDelete: "cascade" }),
  templateId: uuid("template_id").references(() => shiftTemplates.id, { onDelete: "set null" }),
  requestedBy: uuid("requested_by").references(() => users.id).notNull(),
  targetUserId: uuid("target_user_id").references(() => users.id).notNull(),
  oldShiftDate: date("old_shift_date").notNull(),
  oldStartTime: varchar("old_start_time", { length: 5 }).notNull(),
  oldEndTime: varchar("old_end_time", { length: 5 }).notNull(),
  oldUserId: uuid("old_user_id").references(() => users.id),
  newShiftDate: date("new_shift_date").notNull(),
  newStartTime: varchar("new_start_time", { length: 5 }).notNull(),
  newEndTime: varchar("new_end_time", { length: 5 }).notNull(),
  newUserId: uuid("new_user_id").references(() => users.id),
  comment: varchar("comment", { length: 500 }),
  status: shiftChangeStatusEnum("status").default("PENDING").notNull(),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── SICK LEAVES ───────────────────────────────────────
export const sickLeaves = pgTable("sick_leaves", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  comment: varchar("comment", { length: 255 }),
  status: varchar("status", { length: 20 }).default("APPROVED").notNull(),

  // ── Timestamps (with timezone!) ───────────────────────
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),   // null = ещё не редактировали

  // ── Кто создал / редактировал ────────────────────────
  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
});

// ─── PAYMENTS (платежи ЮKassa) ─────────────────────────
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  yookassaId: varchar("yookassa_id", { length: 255 }).notNull().unique(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("RUB").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  description: varchar("description", { length: 255 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── USER MESSENGERS (привязка Telegram / MAX) ────────
export const userMessengers = pgTable("user_messengers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  provider: varchar("provider", { length: 20 }).notNull(), // 'telegram' или 'max'
  externalId: varchar("external_id", { length: 255 }).notNull(), // chat_id в TG или user_id в MAX
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── POSITION TEMPLATES ────────────────────────────────
export const positionTemplates = pgTable("position_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 7 }).default("#3B82F6").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── AREAS (локации = помещения внутри точки) ──────────
export const areas = pgTable("areas", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  locationId: uuid("location_id")
    .references(() => locations.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userAreas = pgTable(
  "user_areas",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    areaId: uuid("area_id")
      .references(() => areas.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.areaId] }),
  })
);

// ─── ОТГУЛЫ ──────────────────────────────────────────
export const timeOffRequests = pgTable("time_off_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  shiftId: uuid("shift_id").references(() => scheduledShifts.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),
  comment: varchar("comment", { length: 255 }),
  status: varchar("status", { length: 20 }).default("PENDING").notNull(), // PENDING | APPROVED | REJECTED
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
});

// ─── ИСТОРИЯ ДЕЙСТВИЙ ────────────────────────────────
export const actionLogs = pgTable("action_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  actionType: varchar("action_type", { length: 50 }).notNull(), // PUBLISH, DISCIPLINE, VACATION, SICK_LEAVE, TIME_OFF, SWAP, SHIFT_CHANGE
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── IN-APP УВЕДОМЛЕНИЯ ────────────────────────────────
export const userNotifications = pgTable("user_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  kind: varchar("kind", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  relatedId: uuid("related_id"),
  relatedType: varchar("related_type", { length: 50 }),
  requiresAction: boolean("requires_action").default(false).notNull(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  payload: jsonb("payload"),
});
