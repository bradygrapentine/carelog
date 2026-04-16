"use client";

import { createContext, useContext, useState } from "react";
import { AIFab } from "./AIFab";
import { AIPanel } from "./AIPanel";
import { AIConsentModal } from "./AIConsentModal";
import { useAIConsent } from "@/hooks/useAIConsent";

type AIContext = { open: boolean; setOpen: (v: boolean) => void };
const AICtx = createContext<AIContext>({ open: false, setOpen: () => {} });
export const useAI = () => useContext(AICtx);

type Props = {
  children: React.ReactNode;
  orgId: string;
  recipientId?: string;
};

export function AIAssistantProvider({ children, orgId, recipientId }: Props) {
  const [open, setOpen] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const { enabled, enable } = useAIConsent();

  function handleFabClick() {
    if (!enabled) {
      setShowConsent(true);
    } else {
      setOpen((v) => !v);
    }
  }

  function handleEnable() {
    enable();
    setShowConsent(false);
    setOpen(true);
  }

  return (
    <AICtx.Provider value={{ open, setOpen }}>
      {children}
      {showConsent && (
        <AIConsentModal
          onEnable={handleEnable}
          onDismiss={() => setShowConsent(false)}
        />
      )}
      {open && (
        <AIPanel
          orgId={orgId}
          recipientId={recipientId}
          onClose={() => setOpen(false)}
        />
      )}
      <AIFab onClick={handleFabClick} isOpen={open} />
    </AICtx.Provider>
  );
}
