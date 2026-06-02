import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, guestsTable } from "@workspace/db";
import {
  ListGuestsParams,
  CreateGuestParams,
  CreateGuestBody,
  UpdateGuestParams,
  UpdateGuestBody,
  DeleteGuestParams,
  ToggleGuestCheckinParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/events/:eventId/guests", async (req, res): Promise<void> => {
  const params = ListGuestsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const guests = await db
    .select()
    .from(guestsTable)
    .where(eq(guestsTable.eventId, params.data.eventId))
    .orderBy(guestsTable.name);
  res.json(guests);
});

router.post("/events/:eventId/guests", async (req, res): Promise<void> => {
  const params = CreateGuestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateGuestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [guest] = await db
    .insert(guestsTable)
    .values({ ...parsed.data, eventId: params.data.eventId })
    .returning();
  res.status(201).json(guest);
});

router.patch(
  "/events/:eventId/guests/:guestId",
  async (req, res): Promise<void> => {
    const params = UpdateGuestParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateGuestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [guest] = await db
      .update(guestsTable)
      .set(parsed.data)
      .where(
        and(
          eq(guestsTable.id, params.data.guestId),
          eq(guestsTable.eventId, params.data.eventId)
        )
      )
      .returning();
    if (!guest) {
      res.status(404).json({ error: "Guest not found" });
      return;
    }
    res.json(guest);
  }
);

router.delete(
  "/events/:eventId/guests/:guestId",
  async (req, res): Promise<void> => {
    const params = DeleteGuestParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [guest] = await db
      .delete(guestsTable)
      .where(
        and(
          eq(guestsTable.id, params.data.guestId),
          eq(guestsTable.eventId, params.data.eventId)
        )
      )
      .returning();
    if (!guest) {
      res.status(404).json({ error: "Guest not found" });
      return;
    }
    res.sendStatus(204);
  }
);

router.patch(
  "/events/:eventId/guests/:guestId/checkin",
  async (req, res): Promise<void> => {
    const params = ToggleGuestCheckinParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [existing] = await db
      .select()
      .from(guestsTable)
      .where(
        and(
          eq(guestsTable.id, params.data.guestId),
          eq(guestsTable.eventId, params.data.eventId)
        )
      );
    if (!existing) {
      res.status(404).json({ error: "Guest not found" });
      return;
    }
    const newCheckedIn = !existing.checkedIn;
    const [guest] = await db
      .update(guestsTable)
      .set({
        checkedIn: newCheckedIn,
        checkedInAt: newCheckedIn ? new Date() : null,
      })
      .where(
        and(
          eq(guestsTable.id, params.data.guestId),
          eq(guestsTable.eventId, params.data.eventId)
        )
      )
      .returning();
    res.json(guest);
  }
);

export default router;
