import { router } from "./index";
import { careEventsRouter } from "../routers/careEvents";
import { organizationsRouter } from "../routers/organizations";
import { membershipsRouter } from "../routers/memberships";

export const appRouter = router({
  careEvents: careEventsRouter,
  organizations: organizationsRouter,
  memberships: membershipsRouter,
});

export type AppRouter = typeof appRouter;
