import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient, type User } from "@supabase/supabase-js";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot write cookies; proxy.ts refreshes them
            // before the layout runs, so this failure path is expected.
          }
        },
      },
    },
  );
}

function getRequestAccessToken(request: Pick<Request, "headers">) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function createRequestSupabase(request: Pick<Request, "headers">) {
  const accessToken = getRequestAccessToken(request);

  if (!accessToken) {
    return createServerSupabase();
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );
}

export async function getRequestUser(
  request: Pick<Request, "headers">,
): Promise<User | null> {
  const supabase = await createRequestSupabase(request);
  const accessToken = getRequestAccessToken(request);

  const { data, error } = accessToken
    ? await supabase.auth.getUser(accessToken)
    : await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}
