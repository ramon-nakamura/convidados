import { pgTable, serial, text, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";

export const floorItemsTable = pgTable("floor_items", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => eventsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  label: text("label"),
  x: real("x").notNull().default(0),
  y: real("y").notNull().default(0),
  width: real("width").notNull().default(100),
  height: real("height").notNull().default(100),
  rotation: real("rotation").notNull().default(0),
  capacity: integer("capacity").notNull().default(8),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFloorItemSchema = createInsertSchema(floorItemsTable).omit({ id: true, createdAt: true });
export type InsertFloorItem = z.infer<typeof insertFloorItemSchema>;
export type FloorItem = typeof floorItemsTable.$inferSelect;
