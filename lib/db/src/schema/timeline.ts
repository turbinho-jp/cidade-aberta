import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const timelineTable = pgTable("timeline_events", {
  id: serial("id").primaryKey(),
  demandId: integer("demand_id").notNull(),
  event: text("event").notNull(),
  description: text("description"),
  actorName: text("actor_name"),
  actorRole: text("actor_role"),
  statusFrom: text("status_from"),
  statusTo: text("status_to"),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTimelineEventSchema = createInsertSchema(timelineTable).omit({ id: true, createdAt: true });
export type InsertTimelineEvent = z.infer<typeof insertTimelineEventSchema>;
export type TimelineEvent = typeof timelineTable.$inferSelect;
