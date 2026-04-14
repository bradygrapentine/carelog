import { supabase } from "./supabase";
import { resetUser } from "./posthog";
import type { Session } from "@supabase/supabase-js";

export async function getSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token ?? null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  resetUser();
}
