import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { getRequestUser } from "@/lib/supabaseServer";
import { rateLimit } from "@/lib/rateLimit";
import { getPostHogClient } from "@/lib/posthog-server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const limited = await rateLimit(request, "invite/accept");
  if (limited) return limited;

  const user = await getRequestUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { token } = await params;

    const { data, error } = await supabaseAdmin.rpc("accept_invite", {
      p_token: token,
      p_user_id: user.id,
      p_email: user.email?.toLowerCase().trim() ?? "",
    });

    if (error) {
      // TD-167: never echo raw Postgres / PostgREST error strings to the client —
      // they can include table/column names and parameterized values. Log
      // server-side via Sentry, return a generic message.
      Sentry.captureException(error, {
        tags: { component: "invite-accept", path: "rpc.error" },
      });
      return NextResponse.json(
        { error: "Internal error — please try again" },
        { status: 500 },
      );
    }

    if (!data.success) {
      const statusMap: Record<string, number> = {
        not_found: 404,
        email_mismatch: 403,
        already_used: 410,
      };
      const status = statusMap[data.error] ?? 400;
      const messageMap: Record<string, string> = {
        not_found: "Invite not found or has expired",
        email_mismatch: "This invite was sent to a different email address",
        already_used:
          "This invite has already been used. Ask the coordinator to send a new one.",
      };
      const message = messageMap[data.error];
      if (!message) {
        // TD-167: unknown sentinel code — surface it server-side so we notice the
        // SQL function gained a new failure mode, but don't echo the raw code.
        Sentry.captureException(
          new Error(`Unknown invite sentinel: ${data.error}`),
          {
            tags: { component: "invite-accept", path: "sentinel.unknown" },
          },
        );
      }
      return NextResponse.json(
        { error: message ?? "Request could not be completed" },
        { status },
      );
    }

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.id,
      event: "invite_accepted",
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    // TD-167: catch path also leaked e.message — Postgres errors can include
    // PII or token data. Log diagnostic server-side, return generic.
    Sentry.captureException(e, {
      tags: { component: "invite-accept", path: "catch" },
    });
    return NextResponse.json(
      { error: "Internal error — please try again" },
      { status: 500 },
    );
  }
}
