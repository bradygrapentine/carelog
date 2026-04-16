"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

export function useAIConsent() {
  const utils = trpc.useUtils();
  const enableMutation = trpc.ai.enableConsent.useMutation({
    onSuccess: () => utils.invalidate(),
  });
  const revokeMutation = trpc.ai.revokeConsent.useMutation({
    onSuccess: () => utils.invalidate(),
  });

  // Store consent locally so UI updates immediately without a round-trip
  const [enabled, setEnabled] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("ai_consent") === "true"
      : false,
  );

  return {
    enabled,
    enable: () => {
      localStorage.setItem("ai_consent", "true");
      setEnabled(true);
      enableMutation.mutate();
    },
    revoke: () => {
      localStorage.removeItem("ai_consent");
      setEnabled(false);
      revokeMutation.mutate();
    },
  };
}
