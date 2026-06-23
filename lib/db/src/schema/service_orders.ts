import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serviceOrderStatusEnum = pgEnum("service_order_status", [
  "pending", "assigned", "in_progress", "completed", "cancelled"
]);

export const serviceOrderPriorityEnum = pgEnum("service_order_priority", [
  "low", "medium", "high", "urgent"
]);

export const serviceOrdersTable = pgTable("service_orders", {
  id: serial("id").primaryKey(),
  demandId: integer("demand_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: serviceOrderStatusEnum("status").notNull().default("pending"),
  priority: serviceOrderPriorityEnum("priority").notNull().default("medium"),
  teamId: integer("team_id"),
  estimatedCompletion: timestamp("estimated_completion"),
  completedAt: timestamp("completed_at"),
  slaHours: integer("sla_hours"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertServiceOrderSchema = createInsertSchema(serviceOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServiceOrder = z.infer<typeof insertServiceOrderSchema>;
export type ServiceOrder = typeof serviceOrdersTable.$inferSelect;
