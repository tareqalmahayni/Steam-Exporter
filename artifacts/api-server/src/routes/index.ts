import { Router, type IRouter } from "express";
import healthRouter from "./health";
import connectionRouter from "./connection";
import gamesRouter from "./games";
import pullRouter from "./pull";
import combinedRouter from "./combined";

const router: IRouter = Router();

router.use(healthRouter);
router.use(connectionRouter);
router.use(gamesRouter);
router.use(pullRouter);
router.use(combinedRouter);

export default router;
