import { NextResponse } from "next/server";
import { resend } from "../../../server/resend.server";

export async function POST(req: Request) {
  const body = await req.json();
  const { name, email, message } = body ?? {};

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (resend) {
    await resend.emails.send({
      from: "Carelog Contact <noreply@carelog.app>",
      to: ["hello@carelog.app"],
      replyTo: email,
      subject: "Contact form: " + name,
      text: "From: " + name + " <" + email + ">\n\n" + message,
    });
  }

  return NextResponse.json({ ok: true });
}
