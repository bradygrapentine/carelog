import { router } from "./index";
import { aiRouter } from "../routers/ai";
import { careEventsRouter } from "../routers/careEvents";
import { organizationsRouter } from "../routers/organizations";
import { membershipsRouter } from "../routers/memberships";
import { shiftsRouter } from "../routers/shifts";
import { coverageWindowsRouter } from "../routers/coverageWindows";
import { medicationsRouter } from "../routers/medications";
import { outerCircleRouter } from "../routers/outerCircle";
import { symptomsRouter } from "../routers/symptoms";
import { burnoutRouter } from "../routers/burnout";
import { expensesRouter } from "../routers/expenses";
import { benefitsRouter } from "../routers/benefits";
import { documentsRouter } from "../routers/documents";
import { eolPlanRouter } from "../routers/eolPlan";
import { userRouter } from "../routers/user";
import { messagesRouter } from "../routers/messages";
import { shiftTradeRequestsRouter } from "../routers/shiftTradeRequests";
import { notificationsRouter } from "../routers/notifications";
import { billingRouter } from "../routers/billing";
import { historyExportRouter } from "../routers/historyExport";
import { moodEntriesRouter } from "../routers/moodEntries";
import { briefsRouter } from "../routers/briefs";

export const appRouter = router({
  ai: aiRouter,
  user: userRouter,
  careEvents: careEventsRouter,
  organizations: organizationsRouter,
  memberships: membershipsRouter,
  shifts: shiftsRouter,
  coverageWindows: coverageWindowsRouter,
  medications: medicationsRouter,
  outerCircle: outerCircleRouter,
  symptoms: symptomsRouter,
  burnout: burnoutRouter,
  expenses: expensesRouter,
  benefits: benefitsRouter,
  documents: documentsRouter,
  eolPlan: eolPlanRouter,
  messages: messagesRouter,
  shiftTradeRequests: shiftTradeRequestsRouter,
  notifications: notificationsRouter,
  billing: billingRouter,
  historyExport: historyExportRouter,
  moodEntries: moodEntriesRouter,
  briefs: briefsRouter,
});

export type AppRouter = typeof appRouter;
