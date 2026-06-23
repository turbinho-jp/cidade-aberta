import { pgTable, serial, text, integer, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const demandStatusEnum = pgEnum("demand_status", [
  "open", "under_review", "approved", "in_progress", "completed", "rejected", "closed"
]);

export const demandPriorityEnum = pgEnum("demand_priority", ["low", "medium", "high", "urgent"]);

export const demandsTable = pgTable("demands", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: demandStatusEnum("status").notNull().default("open"),
  priority: demandPriorityEnum("priority"),
  categoryId: integer("category_id").notNull(),
  neighborhoodId: integer("neighborhood_id").notNull(),
  departmentId: integer("department_id"),
  address: text("address").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  photoUrl: text("photo_url"),
  confirmationsCount: integer("confirmations_count").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
  authorId: integer("author_id").notNull(),
  authorName: text("author_name").notNull(),
  publicResponse: text("public_response"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDemandSchema = createInsertSchema(demandsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDemand = z.infer<typeof insertDemandSchema>;
export type Demand = typeof demandsTable.$inferSelect;
