import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  date,
  numeric,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------- Enums ----------
export const roleEnum = pgEnum("role", [
  "admin",
  "teacher",
  "dean",
  "deputy_principal",
  "parent",
  "student",
]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "late",
  "excused",
]);
export const feeStatusEnum = pgEnum("fee_status", ["pending", "partial", "paid", "overdue"]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "mpesa",
  "cash",
  "bank",
  "card",
  "cheque",
]);
export const leaveTypeEnum = pgEnum("leave_type", [
  "annual",
  "sick",
  "study",
  "compassionate",
  "other",
]);
export const leaveStatusEnum = pgEnum("leave_status", ["pending", "approved", "rejected"]);
export const emailStatusEnum = pgEnum("email_status", ["sent", "failed"]);
export const smsStatusEnum = pgEnum("sms_status", ["sent", "failed"]);
export const disciplineStatusEnum = pgEnum("discipline_status", ["open", "closed"]);

// ---------- Schools (tenants) ----------
export const planEnum = pgEnum("plan", ["starter", "growth", "district"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "past_due", "none"]);

export const schools = pgTable(
  "schools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    // "primary" or "high" — affects which curriculum grade levels and
    // features are offered. High schools get the full feature set; primary
    // schools are a simpler flow for now.
    schoolType: varchar("school_type", { length: 20 }).notNull().default("high"),
    // Used to build parent/staff login emails, e.g. "1834@dawamu.ac.ke".
    // Nullable — admin sets this once from the dashboard.
    domain: varchar("domain", { length: 255 }),
    // Every school starts on Starter (free, capped, no parent portal/M-Pesa/
    // analytics — see lib/plans.ts). subscriptionStatus/currentPeriodEnd only
    // matter once a school is on Growth/District; access is always computed
    // live from these rather than trusted blindly (see hasGrowthAccess()).
    plan: planEnum("plan").notNull().default("starter"),
    subscriptionStatus: subscriptionStatusEnum("subscription_status").notNull().default("none"),
    currentPeriodEnd: timestamp("current_period_end"),
    // Shown under the school name on outgoing email templates, e.g.
    // "Transforming Boys Into Leaders". Optional — schools without one just
    // won't show a tagline line.
    tagline: varchar("tagline", { length: 255 }),
    // Each school brings its own Safaricom Paybill/Till + Daraja app so
    // parent M-Pesa payments land directly in that school's own account.
    // consumerSecret/passkey are stored encrypted (see lib/crypto.ts) —
    // shortcode and consumerKey aren't secret enough to bother.
    mpesaEnv: varchar("mpesa_env", { length: 20 }).default("sandbox"),
    mpesaShortcode: varchar("mpesa_shortcode", { length: 20 }),
    mpesaConsumerKey: text("mpesa_consumer_key"),
    mpesaConsumerSecret: text("mpesa_consumer_secret"),
    mpesaPasskey: text("mpesa_passkey"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("schools_slug_idx").on(table.slug),
  })
);

// ---------- Users (admins, teachers, parents, students-as-login) ----------
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("student"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    emailPerSchoolIdx: uniqueIndex("users_school_email_idx").on(table.schoolId, table.email),
  })
);

// ---------- Classes ----------
export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  gradeLevel: varchar("grade_level", { length: 50 }),
  teacherId: uuid("teacher_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Students ----------
export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
    admissionNumber: varchar("admission_number", { length: 50 }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dateOfBirth: date("date_of_birth"),
    guardianName: text("guardian_name"),
    guardianContact: varchar("guardian_contact", { length: 50 }),
    guardianEmail: varchar("guardian_email", { length: 255 }),
    enrollmentDate: date("enrollment_date").defaultNow(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    admissionPerSchoolIdx: uniqueIndex("students_school_admission_idx").on(
      table.schoolId,
      table.admissionNumber
    ),
  })
);

// ---------- Subjects ----------
export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: varchar("code", { length: 20 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    codePerSchoolIdx: uniqueIndex("subjects_school_code_idx").on(table.schoolId, table.code),
  })
);

// ---------- Student subject enrollment ----------
// Which subjects a given student is actually taking (a student typically
// does 7-8 out of the school's full subject list) — used to scope the
// grade-entry grid to just their subjects instead of every subject offered.
export const studentSubjects = pgTable(
  "student_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    studentSubjectIdx: uniqueIndex("student_subjects_student_subject_idx").on(
      table.studentId,
      table.subjectId
    ),
  })
);

// ---------- Attendance ----------
export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: attendanceStatusEnum("status").notNull().default("present"),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // One record per student per day — re-marking updates the existing row.
    studentDateIdx: uniqueIndex("attendance_student_date_idx").on(table.studentId, table.date),
  })
);

// ---------- Grades ----------
export const grades = pgTable(
  "grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    term: varchar("term", { length: 50 }).notNull(),
    score: numeric("score", { precision: 6, scale: 2 }).notNull(),
    maxScore: numeric("max_score", { precision: 6, scale: 2 }).notNull().default("100"),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // One score per student per subject per term — re-entering updates it.
    studentSubjectTermIdx: uniqueIndex("grades_student_subject_term_idx").on(
      table.studentId,
      table.subject,
      table.term
    ),
  })
);

// ---------- Fees ----------
export const fees = pgTable("fees", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  term: varchar("term", { length: 50 }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: date("due_date").notNull(),
  status: feeStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Payments ----------
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  feeId: uuid("fee_id")
    .notNull()
    .references(() => fees.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull().default("mpesa"),
  transactionRef: varchar("transaction_ref", { length: 100 }),
  paidAt: timestamp("paid_at").defaultNow().notNull(),
});

// ---------- Payment claims ----------
// A parent self-reports a payment they made outside the app (M-Pesa, bank,
// cheque) with a reference number; an admin verifies it before it becomes a
// real row in `payments` and affects the fee balance. This is the "manual
// verification" payment flow — not an automatic gateway integration.
export const paymentClaimStatusEnum = pgEnum("payment_claim_status", [
  "pending",
  "approved",
  "rejected",
]);

export const paymentClaims = pgTable("payment_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  feeId: uuid("fee_id")
    .notNull()
    .references(() => fees.id, { onDelete: "cascade" }),
  submittedBy: uuid("submitted_by").references(() => users.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull().default("mpesa"),
  transactionRef: varchar("transaction_ref", { length: 100 }).notNull(),
  status: paymentClaimStatusEnum("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- M-Pesa STK Push ----------
// A parent taps "Pay with M-Pesa"; we ask Safaricom to push a PIN prompt to
// their phone. Safaricom calls our webhook asynchronously with the result —
// unlike payment_claims (self-reported, needs admin review), a *verified*
// success here (ResultCode 0) is trusted directly and immediately produces a
// real `payments` row, since Safaricom itself is confirming the money moved.
export const stkPushStatusEnum = pgEnum("stk_push_status", [
  "pending",
  "success",
  "failed",
  "cancelled",
]);

export const stkPushRequests = pgTable("stk_push_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  feeId: uuid("fee_id")
    .notNull()
    .references(() => fees.id, { onDelete: "cascade" }),
  initiatedBy: uuid("initiated_by").references(() => users.id, { onDelete: "set null" }),
  phoneNumber: varchar("phone_number", { length: 15 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  merchantRequestId: varchar("merchant_request_id", { length: 100 }),
  checkoutRequestId: varchar("checkout_request_id", { length: 100 }),
  status: stkPushStatusEnum("status").notNull().default("pending"),
  resultCode: varchar("result_code", { length: 10 }),
  resultDesc: text("result_desc"),
  mpesaReceiptNumber: varchar("mpesa_receipt_number", { length: 50 }),
  paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// ---------- Platform subscription billing (Aclass's own revenue) ----------
// Deliberately a completely separate table/flow from stk_push_requests above
// — that one is a PARENT paying a SCHOOL's own fees; this one is a SCHOOL
// paying ACLASS for their subscription. Keeping the two money flows and
// webhooks fully isolated means a bug in one can never mark the other paid.
export const platformStkPushRequests = pgTable("platform_stk_push_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  plan: planEnum("plan").notNull(),
  initiatedBy: uuid("initiated_by").references(() => users.id, { onDelete: "set null" }),
  phoneNumber: varchar("phone_number", { length: 15 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  merchantRequestId: varchar("merchant_request_id", { length: 100 }),
  checkoutRequestId: varchar("checkout_request_id", { length: 100 }),
  status: stkPushStatusEnum("status").notNull().default("pending"),
  resultCode: varchar("result_code", { length: 10 }),
  resultDesc: text("result_desc"),
  mpesaReceiptNumber: varchar("mpesa_receipt_number", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// ---------- Password reset tokens ----------
// Only the sha256 hash of the token is stored — never the raw token itself
// (same principle as password hashing: even a DB leak shouldn't hand out
// usable reset links). The raw token only ever exists in the emailed link.
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("password_reset_tokens_hash_idx").on(table.tokenHash),
  })
);

// ---------- Rate limiting ----------
// One row per attempt (failed login, or a password-reset request), keyed by
// a string like "login:someone@example.com" or "reset-ip:41.90.x.x". See
// lib/rateLimit.ts — a rolling window is checked by counting rows for a key
// newer than N minutes ago, no separate cache/Redis needed. Rows are pruned
// opportunistically each time a new one is written for that key.
export const rateLimitAttempts = pgTable(
  "rate_limit_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: varchar("key", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    keyCreatedIdx: index("rate_limit_attempts_key_created_idx").on(table.key, table.createdAt),
  })
);

// ---------- Leave requests ----------
export const leaveRequests = pgTable("leave_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  leaveType: leaveTypeEnum("leave_type").notNull().default("annual"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: text("reason"),
  status: leaveStatusEnum("status").notNull().default("pending"),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Discipline cases ----------
export const disciplineCases = pgTable("discipline_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  reportedBy: uuid("reported_by").references(() => users.id, { onDelete: "set null" }),
  incidentDate: date("incident_date").notNull(),
  offense: text("offense").notNull(),
  description: text("description"),
  actionTaken: text("action_taken"),
  status: disciplineStatusEnum("status").notNull().default("open"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Email log ----------
export const emailLogs = pgTable("email_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  sentBy: uuid("sent_by").references(() => users.id, { onDelete: "set null" }),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  recipientName: text("recipient_name"),
  subject: text("subject").notNull(),
  body: text("body"),
  status: emailStatusEnum("status").notNull().default("sent"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- SMS log ----------
// SMS is one shared Aclass account (AT_USERNAME/AT_API_KEY env vars) used by
// every school — same reasoning as the shared Gmail account for email: no
// money changes hands here, so there's no need for each school to bring its
// own gateway credentials the way M-Pesa requires. Gated behind Growth (see
// hasGrowthAccess in lib/plans.ts), matching the pricing page.
export const smsLogs = pgTable("sms_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  sentBy: uuid("sent_by").references(() => users.id, { onDelete: "set null" }),
  recipientPhone: varchar("recipient_phone", { length: 15 }).notNull(),
  recipientName: text("recipient_name"),
  message: text("message").notNull(),
  status: smsStatusEnum("status").notNull().default("sent"),
  cost: varchar("cost", { length: 20 }),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Relations ----------
export const schoolsRelations = relations(schools, ({ many }) => ({
  users: many(users),
  classes: many(classes),
  students: many(students),
  fees: many(fees),
  subjects: many(subjects),
  leaveRequests: many(leaveRequests),
  disciplineCases: many(disciplineCases),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  school: one(schools, { fields: [subjects.schoolId], references: [schools.id] }),
  studentSubjects: many(studentSubjects),
}));

export const studentSubjectsRelations = relations(studentSubjects, ({ one }) => ({
  student: one(students, { fields: [studentSubjects.studentId], references: [students.id] }),
  subject: one(subjects, { fields: [studentSubjects.subjectId], references: [subjects.id] }),
}));

export const disciplineCasesRelations = relations(disciplineCases, ({ one }) => ({
  school: one(schools, { fields: [disciplineCases.schoolId], references: [schools.id] }),
  student: one(students, { fields: [disciplineCases.studentId], references: [students.id] }),
  reporter: one(users, { fields: [disciplineCases.reportedBy], references: [users.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  school: one(schools, { fields: [leaveRequests.schoolId], references: [schools.id] }),
  requester: one(users, { fields: [leaveRequests.userId], references: [users.id] }),
  reviewer: one(users, { fields: [leaveRequests.reviewedBy], references: [users.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  school: one(schools, { fields: [users.schoolId], references: [schools.id] }),
  taughtClasses: many(classes),
  studentProfile: many(students),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  school: one(schools, { fields: [classes.schoolId], references: [schools.id] }),
  teacher: one(users, { fields: [classes.teacherId], references: [users.id] }),
  students: many(students),
  attendance: many(attendance),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  school: one(schools, { fields: [students.schoolId], references: [schools.id] }),
  class: one(classes, { fields: [students.classId], references: [classes.id] }),
  user: one(users, { fields: [students.userId], references: [users.id] }),
  attendance: many(attendance),
  grades: many(grades),
  fees: many(fees),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  student: one(students, { fields: [attendance.studentId], references: [students.id] }),
  class: one(classes, { fields: [attendance.classId], references: [classes.id] }),
  recordedByUser: one(users, { fields: [attendance.recordedBy], references: [users.id] }),
}));

export const gradesRelations = relations(grades, ({ one }) => ({
  student: one(students, { fields: [grades.studentId], references: [students.id] }),
  recordedByUser: one(users, { fields: [grades.recordedBy], references: [users.id] }),
}));

export const feesRelations = relations(fees, ({ one, many }) => ({
  school: one(schools, { fields: [fees.schoolId], references: [schools.id] }),
  student: one(students, { fields: [fees.studentId], references: [students.id] }),
  payments: many(payments),
  paymentClaims: many(paymentClaims),
  stkPushRequests: many(stkPushRequests),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  fee: one(fees, { fields: [payments.feeId], references: [fees.id] }),
}));

export const paymentClaimsRelations = relations(paymentClaims, ({ one }) => ({
  school: one(schools, { fields: [paymentClaims.schoolId], references: [schools.id] }),
  fee: one(fees, { fields: [paymentClaims.feeId], references: [fees.id] }),
  submitter: one(users, { fields: [paymentClaims.submittedBy], references: [users.id] }),
  reviewer: one(users, { fields: [paymentClaims.reviewedBy], references: [users.id] }),
}));

export const stkPushRequestsRelations = relations(stkPushRequests, ({ one }) => ({
  school: one(schools, { fields: [stkPushRequests.schoolId], references: [schools.id] }),
  fee: one(fees, { fields: [stkPushRequests.feeId], references: [fees.id] }),
  initiator: one(users, { fields: [stkPushRequests.initiatedBy], references: [users.id] }),
  payment: one(payments, { fields: [stkPushRequests.paymentId], references: [payments.id] }),
}));

export const platformStkPushRequestsRelations = relations(platformStkPushRequests, ({ one }) => ({
  school: one(schools, { fields: [platformStkPushRequests.schoolId], references: [schools.id] }),
  initiator: one(users, { fields: [platformStkPushRequests.initiatedBy], references: [users.id] }),
}));
