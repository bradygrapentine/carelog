import { router } from "./index";
import { careEventsRouter } from "../routers/careEvents";
import { organizationsRouter } from "../routers/organizations";
import { membershipsRouter } from "../routers/memberships";
import { shiftsRouter } from "../routers/shifts";

export const appRouter = router({
  careEvents: careEventsRouter,
  organizations: organizationsRouter,
  memberships: membershipsRouter,
  shifts: shiftsRouter,
});

export type AppRouter = typeof appRouter;
