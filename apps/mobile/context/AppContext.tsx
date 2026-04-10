import { createContext, useContext, useState } from 'react'

type AppContextValue = {
  orgId: string | null
  recipientId: string | null
  currentRole: string | null
  setOrg: (orgId: string, recipientId: string, role: string) => void
}

const AppContext = createContext<AppContextValue>({
  orgId: null,
  recipientId: null,
  currentRole: null,
  setOrg: () => {},
})

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [recipientId, setRecipientId] = useState<string | null>(null)
  const [currentRole, setCurrentRole] = useState<string | null>(null)

  function setOrg(o: string, r: string, role: string) {
    setOrgId(o)
    setRecipientId(r)
    setCurrentRole(role)
  }

  return (
    <AppContext.Provider value={{ orgId, recipientId, currentRole, setOrg }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
