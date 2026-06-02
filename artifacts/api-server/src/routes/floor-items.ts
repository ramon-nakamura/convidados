import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, floorItemsTable } from "@workspace/db";
import {
  ListFloorItemsParams,
  CreateFloorItemParams,
  CreateFloorItemBody,
  UpdateFloorItemParams,
  UpdateFloorItemBody,
  DeleteFloorItemParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get(
  "/events/:eventId/floor-items",
  async (req, res): Promise<void> => {
    const params = ListFloorItemsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const items = await db
      .select()
      .from(floorItemsTable)
      .where(eq(floorItemsTable.eventId, params.data.eventId))
      .orderBy(floorItemsTable.createdAt);
    res.json(items);
  }
);

router.post(
  "/events/:eventId/floor-items",
  async (req, res): Promise<void> => {
    const params = CreateFloorItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = CreateFloorItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [item] = await db
      .insert(floorItemsTable)
      .values({ ...parsed.data, eventId: params.data.eventId })
      .returning();
    res.status(201).json(item);
  }
);

router.patch(
  "/events/:eventId/floor-items/:floorItemId",
  async (req, res): Promise<void> => {
    const params = UpdateFloorItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateFloorItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [item] = await db
      .update(floorItemsTable)
      .set(parsed.data)
      .where(
        and(
          eq(floorItemsTable.id, params.data.floorItemId),
          eq(floorItemsTable.eventId, params.data.eventId)
        )
      )
      .returning();
    if (!item) {
      res.status(404).json({ error: "Floor item not found" });
      return;
    }
    res.json(item);
  }
);

router.delete(
  "/events/:eventId/floor-items/:floorItemId",
  async (req, res): Promise<void> => {
    const params = DeleteFloorItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [item] = await db
      .delete(floorItemsTable)
      .where(
        and(
          eq(floorItemsTable.id, params.data.floorItemId),
          eq(floorItemsTable.eventId, params.data.eventId)
        )
      )
      .returning();
    if (!item) {
      res.status(404).json({ error: "Floor item not found" });
      return;
    }
    res.sendStatus(204);
  }
);

export default router;
