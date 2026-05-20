import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { weeklyDigest } from "../../../inngest/functions/weeklyDigest";
import { gapDetector } from "../../../inngest/functions/gapDetector";
import { refillAlert } from "../../../inngest/functions/refillAlert";
import { ocrPrescription } from "../../../inngest/functions/ocrPrescription";
import { ocrDocument } from "../../../inngest/functions/ocrDocument";
import { burnoutAlert } from "../../../inngest/functions/burnoutAlert";
import { journalFlagAlert } from "../../../inngest/functions/journalFlagAlert";
import { documentsExtractText } from "../../../inngest/functions/documentsExtractText";
import { messagingPushFn } from "../../../inngest/functions/messagingPush";
import { careEventCommentFanoutFn } from "../../../inngest/functions/careEventCommentFanout";
import { taskNotificationFanoutFn } from "../../../inngest/functions/taskNotificationFanout";
import { shiftTradeExpiry } from "../../../inngest/functions/shiftTradeExpiry";
import { educationTipRefresh } from "../../../inngest/functions/educationTipRefresh";
import { rateLimit429Monitor } from "../../../inngest/functions/rateLimit429Monitor";
import { digestDeliveryMonitor } from "../../../inngest/functions/digestDeliveryMonitor";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    weeklyDigest,
    gapDetector,
    refillAlert,
    ocrPrescription,
    ocrDocument,
    burnoutAlert,
    journalFlagAlert,
    documentsExtractText,
    messagingPushFn,
    careEventCommentFanoutFn,
    taskNotificationFanoutFn,
    shiftTradeExpiry,
    educationTipRefresh,
    rateLimit429Monitor,
    digestDeliveryMonitor,
  ],
});
