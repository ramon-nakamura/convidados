import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";

export const guestsTable = pgTable("guests", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => eventsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  group: text("group"),
  vocativo: text("vocativo"),
  gender: text("gender"),
  ageRange: text("age_range"),
  notes: text("notes"),
  status: text("status").notNull().default("nao_respondeu"),
  checkedIn: boolean("checked_in").notNull().default(false),
  checkedInAt: timestamp("checked_in_at"),
  floorItemId: integer("floor_item_id"),
  seatNumber: integer("seat_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGuestSchema = createInsertSchema(guestsTable).omit({ id: true, createdAt: true, checkedIn: true, checkedInAt: true });
export type InsertGuest = z.infer<typeof insertGuestSchema>;
export type Guest = typeof guestsTable.$inferSelect;
