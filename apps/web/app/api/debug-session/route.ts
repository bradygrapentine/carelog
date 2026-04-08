import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function GET() {
  if (process.env.DEBUG_SESSION_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
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
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  return NextResponse.json({
    cookies: all.map((c) => c.name),
    user: user?.email,
    userError: userError?.message,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}
