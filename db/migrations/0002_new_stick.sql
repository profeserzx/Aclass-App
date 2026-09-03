ALTER TABLE "fees" ADD COLUMN "reminder_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "fees" ADD COLUMN "overdue_notified_at" timestamp;