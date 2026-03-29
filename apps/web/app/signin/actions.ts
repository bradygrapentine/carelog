"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function verifyOtpAction(
  email: string,
  token: string,
): Promise<{ error?: string; success?: boolean }> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: { path: string; expires: Date } }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    return { error: "No session returned. Please try again." };
  }

  return { success: true };
}
