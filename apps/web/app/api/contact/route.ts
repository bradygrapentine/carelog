import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resend } from "../../../server/resend.server";
import { rateLimit } from "@/lib/rateLimit";
import { getPostHogClient } from "@/lib/posthog-server";

const MAX_BODY_BYTES = 16 * 1024; // 16 KB cap — contact form should not exceed this

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(1).max(5000),
});

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, "contact");
  if (limited) return limited;

  // Cap body size before JSON parse
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing or invalid fields" },
      { status: 400 },
    );
  }

  const { name, email, message } = parsed.data;

  if (resend) {
    await resend.emails.send({
      from: "Carelog Contact <noreply@carelog.app>",
      to: ["hello@carelog.app"],
      reply_to: email,
      subject: "Contact form: " + name,
      text: "From: " + name + " <" + email + ">\n\n" + message,
    });
  }

  try {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: email,
      event: "contact_form_submitted",
      properties: { has_email: !!email },
    });
  } catch {
    // analytics failure should not break the endpoint
  }

  return NextResponse.json({ ok: true });
}
