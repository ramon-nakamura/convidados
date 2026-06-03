import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, eventsTable, guestsTable, floorItemsTable } from "@workspace/db";
import {
  CreateEventBody,
  UpdateEventBody,
  UpdateEventParams,
  GetEventParams,
  DeleteEventParams,
  GetEventStatsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/events", async (_req, res): Promise<void> => {
  const events = await db
    .select()
    .from(eventsTable)
    .orderBy(eventsTable.createdAt);
  res.json(events);
});

router.post("/events", async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [event] = await db.insert(eventsTable).values(parsed.data).returning();
  res.status(201).json(event);
});

router.get("/events/:eventId", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, params.data.eventId));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(event);
});

router.patch("/events/:eventId", async (req, res): Promise<void> => {
  const params = UpdateEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [event] = await db
    .update(eventsTable)
    .set(parsed.data)
    .where(eq(eventsTable.id, params.data.eventId))
    .returning();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(event);
});

router.delete("/events/:eventId", async (req, res): Promise<void> => {
  const params = DeleteEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [event] = await db
    .delete(eventsTable)
    .where(eq(eventsTable.id, params.data.eventId))
    .returning();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/events/:eventId/stats", async (req, res): Promise<void> => {
  const params = GetEventStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { eventId } = params.data;

  const [event] = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.id, eventId));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const guests = await db
    .select()
    .from(guestsTable)
    .where(eq(guestsTable.eventId, eventId));

  const floorItems = await db
    .select()
    .from(floorItemsTable)
    .where(eq(floorItemsTable.eventId, eventId));

  const totalGuests = guests.length;
  const assignedGuests = guests.filter((g) => g.floorItemId != null).length;
  const unassignedGuests = totalGuests - assignedGuests;
  const checkedInGuests = guests.filter((g) => g.checkedIn).length;

  const tableTypes = ["round-table", "rectangle-table", "square-table", "couple-table"];
  const tables = floorItems.filter((fi) => tableTypes.includes(fi.type));
  const totalSeats = tables.reduce((sum, t) => sum + t.capacity, 0);
  const occupiedSeats = assignedGuests;
  const availableSeats = Math.max(0, totalSeats - occupiedSeats);

  res.json({
    totalGuests,
    assignedGuests,
    unassignedGuests,
    checkedInGuests,
    totalSeats,
    occupiedSeats,
    availableSeats,
  });
});

export default router;
