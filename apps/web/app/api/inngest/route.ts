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
  ],
});
