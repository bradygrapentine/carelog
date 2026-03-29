import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const all = cookieStore.getAll();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  return NextResponse.json({
    cookies: all.map((c) => ({
      name: c.name,
      valueStart: c.value.slice(0, 50),
    })),
    session: session
      ? {
          expires_at: session.expires_at,
          user_email: session.user.email,
        }
      : null,
    sessionError: error?.message,
    user: user?.email,
    userError: userError?.message,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}
