import { router } from "./index";
import { careEventsRouter } from "../routers/careEvents";
import { organizationsRouter } from "../routers/organizations";
import { membershipsRouter } from "../routers/memberships";
import { shiftsRouter } from "../routers/shifts";
import { coverageWindowsRouter } from "../routers/coverageWindows";
import { medicationsRouter } from "../routers/medications";
import { outerCircleRouter } from "../routers/outerCircle";
import { symptomsRouter } from "../routers/symptoms";
import { burnoutRouter } from "../routers/burnout";
import { benefitsRouter } from "../routers/benefits";

export const appRouter = router({
  careEvents: careEventsRouter,
  organizations: organizationsRouter,
  memberships: membershipsRouter,
  shifts: shiftsRouter,
  coverageWindows: coverageWindowsRouter,
  medications: medicationsRouter,
  outerCircle: outerCircleRouter,
  symptoms: symptomsRouter,
  burnout: burnoutRouter,
  benefits: benefitsRouter,
});

export type AppRouter = typeof appRouter;
