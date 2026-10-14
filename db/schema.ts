import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    date,
    decimal,
    integer,
    boolean,
    pgEnum,
    jsonb,
    text,
} from "drizzle-orm/pg-core";

// ─── ENUM ──────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["OWNER", "MANAGER", "EMPLOYEE"]);
export const scheduleStatusEnum = pgEnum("schedule_status", ["DRAFT", "PUBLISHED", "LOCKED"]);
export const shiftStatusEnum = pgEnum("shift_status", [
    "SCHEDULED",
    "CONFIRMED",
    "SWAP_REQUESTED",
    "SWAPPED",
    "CALLED_OUT",
    "NO_SHOW",
]);
export const swapStatusEnum = pgEnum("swap_status", ["PENDING", "APPROVED", "DENIED"]);
export const vacationStatusEnum = pgEnum("vacation_status", ["PENDING", "APPROVED", "REJECTED"]);

// ─── ORGANIZATIONS ─────────────────────────────────────
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  city: varchar("city", { length: 100 }),
  directorName: varchar("director_name", { length: 255 }),
  inn: varchar("inn", { length: 20 }),
  legalAddress: varchar("legal_address", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  position: varchar("position", { length: 255 }),     // ← НОВОЕ ПОЛЕ
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
    templateId: uuid("template_id").references(() => shiftTemplates.id, {onDelete: "set null",}),
    userId: uuid("user_id").references(() => users.id),
    shiftDate: date("shift_date").notNull(),
    startTime: varchar("start_time", { length: 5 }).notNull(),
    endTime: varchar("end_time", { length: 5 }).notNull(),
    status: shiftStatusEnum("status").default("SCHEDULED").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── AVAILABILITY ──────────────────────────────────────
export const availability = pgTable("availability", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
    dayOfWeek: integer("day_of_week").notNull(),
    isAvailable: boolean("is_available").default(true).notNull(),
    note: varchar("note", { length: 255 }),
});

// ─── SHIFT SWAP REQUESTS ───────────────────────────────
export const shiftSwapRequests = pgTable("shift_swap_requests", {
    id: uuid("id").primaryKey().defaultRandom(),
    shiftId: uuid("shift_id")
        .references(() => scheduledShifts.id, { onDelete: "cascade" })
        .notNull(),
    requestedBy: uuid("requested_by")
        .references(() => users.id)
        .notNull(),
    swapWithUserId: uuid("swap_with_user_id").references(() => users.id),
    status: swapStatusEnum("status").default("PENDING").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── TIME ENTRIES ──────────────────────────────────────
export const timeEntries = pgTable("time_entries", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
    shiftId: uuid("shift_id").references(() => scheduledShifts.id),
    clockIn: timestamp("clock_in"),
    clockOut: timestamp("clock_out"),
    source: varchar("source", { length: 20 }).default("web").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── GENERATED DOCUMENTS ──────────────────────────────
export const generatedDocuments = pgTable("generated_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  type: varchar("type", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  params: jsonb("params").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── VACATIONS ─────────────────────────────────────────
export const vacations = pgTable("vacations", {
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
  status: vacationStatusEnum("status").default("APPROVED").notNull(),
  // Предыдущие значения (для preview изменений)
  previousStartDate: date("previous_start_date"),
  previousEndDate: date("previous_end_date"),
  previousComment: varchar("previous_comment", { length: 255 }),
  reviewedBy: uuid("reviewed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── CUSTOM DOCUMENT TEMPLATES ─────────────────────────
export const documentCustomTemplates = pgTable("document_custom_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  content: text("content").notNull(),
  fileName: varchar("file_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});