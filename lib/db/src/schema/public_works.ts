import { pgTable, serial, text, integer, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const publicWorkStatusEnum = pgEnum("public_work_status", [
  "planned", "approved", "in_progress", "completed", "suspended"
]);

export const publicWorksTable = pgTable("public_works", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: publicWorkStatusEnum("status").notNull().default("planned"),
  neighborhoodId: integer("neighborhood_id").notNull(),
  departmentId: integer("department_id"),
  investment: real("investment"),
  startDate: timestamp("start_date"),
  estimatedEnd: timestamp("estimated_end"),
  completedAt: timestamp("completed_at"),
  lat: real("lat"),
  lng: real("lng"),
  photoUrl: text("photo_url"),
  progressPercent: integer("progress_percent").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPublicWorkSchema = createInsertSchema(publicWorksTable).omit({ id: true, createdAt: true });
export type InsertPublicWork = z.infer<typeof insertPublicWorkSchema>;
export type PublicWork = typeof publicWorksTable.$inferSelect;
