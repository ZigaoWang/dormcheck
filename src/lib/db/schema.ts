import {
  pgTable,
  text,
  boolean,
  real,
  timestamp,
  time,
  integer,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

export const checkTypeEnum = pgEnum("check_type", [
  "morning",
  "evening",
  "studyhall",
  "tech_handin",
]);

export const students = pgTable("students", {
  studentId: text("student_id").primaryKey(),
  uid: text("uid").unique(),
  name: text("name").notNull(),
  grade: integer("grade").notNull(),
  house: text("house"),
  expectedMorningTime: time("expected_morning_time").notNull().default("07:30"),
  isActive: boolean("is_active").notNull().default(true),
});

export const checkins = pgTable(
  "checkins",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.studentId),
    uid: text("uid"),
    name: text("name").notNull(),
    grade: integer("grade").notNull(),
    temperature: real("temperature"),
    checkType: checkTypeEnum("check_type").notNull(),
    isLate: boolean("is_late").notNull().default(false),
    isFever: boolean("is_fever").notNull().default(false),
    deviceId: text("device_id"),
    photoUrl: text("photo_url"),
    phoneHandedIn: boolean("phone_handed_in"),
    laptopHandedIn: boolean("laptop_handed_in"),
    ipadHandedIn: boolean("ipad_handed_in"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("checkins_created_at_idx").on(table.createdAt),
    index("checkins_student_id_idx").on(table.studentId),
  ]
);

export const devices = pgTable("devices", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  house: text("house"),
  apiKey: text("api_key").notNull().unique(),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
});

export const config = pgTable("config", {
  house: text("house").primaryKey(),
  feverThreshold: real("fever_threshold").notNull().default(37.3),
  lateGraceMinutes: integer("late_grace_minutes").notNull().default(5),
  morningStart: time("morning_start").notNull().default("06:30"),
  morningEnd: time("morning_end").notNull().default("08:00"),
  morningDeadlineJunior: time("morning_deadline_junior").notNull().default("07:15"),
  morningDeadlineSenior: time("morning_deadline_senior").notNull().default("07:30"),
  studyhallEnd: time("studyhall_end").notNull().default("19:15"),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  house: text("house"),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export const lockers = pgTable("lockers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  studentId: text("student_id")
    .notNull()
    .unique()
    .references(() => students.studentId),
  hasPhone: boolean("has_phone").notNull().default(true),
  hasLaptop: boolean("has_laptop").notNull().default(true),
  hasIpad: boolean("has_ipad").notNull().default(false),
  house: text("house"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const deviceExemptionTypeEnum = pgEnum("device_exemption_type", [
  "phone",
  "laptop",
  "ipad",
]);

export const deviceExemptions = pgTable("device_exemptions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  studentId: text("student_id")
    .notNull()
    .references(() => students.studentId),
  deviceType: deviceExemptionTypeEnum("device_type").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  note: text("note"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
