import { createContext, useContext, useState } from "react";

type AppContextValue = {
  orgId: string | null;
  recipientId: string | null;
  currentRole: string | null;
  setOrg: (orgId: string, recipientId: string, role: string) => void;
};

const AppContext = createContext<AppContextValue>({
  orgId: null,
  recipientId: null,
  currentRole: null,
  setOrg: () => {},
});

type AppProviderProps = {
  children: React.ReactNode;
  initialOrgId?: string | null;
  initialRecipientId?: string | null;
  initialRole?: string | null;
};

export function AppProvider({
  children,
  initialOrgId = null,
  initialRecipientId = null,
  initialRole = null,
}: AppProviderProps) {
  const [orgId, setOrgId] = useState<string | null>(initialOrgId);
  const [recipientId, setRecipientId] = useState<string | null>(
    initialRecipientId,
  );
  const [currentRole, setCurrentRole] = useState<string | null>(initialRole);

  function setOrg(o: string, r: string, role: string) {
    setOrgId(o);
    setRecipientId(r);
    setCurrentRole(role);
  }

  return (
    <AppContext.Provider value={{ orgId, recipientId, currentRole, setOrg }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
