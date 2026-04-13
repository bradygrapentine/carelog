import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";
import { parseBody } from "@/lib/parseBody";

const verifySchema = z.object({
  email: z.string().email().max(254),
  token: z.string().length(6),
});

export async function POST(request: NextRequest) {
  // OTP verify: allow 30 attempts per 15 minutes. Legitimate users retry
  // after mistyping the 6-digit code, checking a second device, or after the
  // first email hits spam and they request a new one.
  const limited = await rateLimit(request, "auth/verify", { max: 30 });
  if (limited) return limited;

  const { data: body, error: bodyError } = await parseBody(
    request,
    verifySchema,
  );
  if (bodyError) return bodyError;

  const { email, token } = body;

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
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
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data.session) {
    return NextResponse.json({ error: "No session" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
