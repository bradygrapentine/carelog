import { router } from "./index";
import { careEventsRouter } from "../routers/careEvents";
import { organizationsRouter } from "../routers/organizations";
import { membershipsRouter } from "../routers/memberships";
import { coverageWindowsRouter } from "../routers/coverageWindows";

export const appRouter = router({
  careEvents: careEventsRouter,
  organizations: organizationsRouter,
  memberships: membershipsRouter,
  coverageWindows: coverageWindowsRouter,
});

export type AppRouter = typeof appRouter;
