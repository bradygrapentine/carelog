import { router } from "./index";
import { careEventsRouter } from "../routers/careEvents";
import { organizationsRouter } from "../routers/organizations";
import { membershipsRouter } from "../routers/memberships";
import { shiftsRouter } from "../routers/shifts";
import { coverageWindowsRouter } from "../routers/coverageWindows";
import { medicationsRouter } from "../routers/medications";

export const appRouter = router({
  careEvents: careEventsRouter,
  organizations: organizationsRouter,
  memberships: membershipsRouter,
  shifts: shiftsRouter,
  coverageWindows: coverageWindowsRouter,
  medications: medicationsRouter,
});

export type AppRouter = typeof appRouter;
