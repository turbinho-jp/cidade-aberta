import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const confirmationsTable = pgTable("confirmations", {
  id: serial("id").primaryKey(),
  demandId: integer("demand_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertConfirmationSchema = createInsertSchema(confirmationsTable).omit({ id: true, createdAt: true });
export type InsertConfirmation = z.infer<typeof insertConfirmationSchema>;
export type Confirmation = typeof confirmationsTable.$inferSelect;
