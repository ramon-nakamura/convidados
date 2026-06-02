import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eventsRouter from "./events";
import guestsRouter from "./guests";
import floorItemsRouter from "./floor-items";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventsRouter);
router.use(guestsRouter);
router.use(floorItemsRouter);

export default router;
