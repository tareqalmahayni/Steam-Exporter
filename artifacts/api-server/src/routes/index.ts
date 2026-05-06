import { Router, type IRouter } from "express";
import healthRouter from "./health";
import connectionRouter from "./connection";
import gamesRouter from "./games";
import pullRouter from "./pull";
import browserPullRouter from "./browser-pull";

const router: IRouter = Router();

router.use(healthRouter);
router.use(connectionRouter);
router.use(gamesRouter);
router.use(pullRouter);
router.use(browserPullRouter);

export default router;
