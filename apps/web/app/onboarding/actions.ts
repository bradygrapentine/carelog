"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createIdentity } from "@/server/repositories/identityRepository";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { createOrganization } from "@/server/repositories/organizationsRepository";

export async function createCareTeamAction(formData: FormData) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const recipientName = formData.get("recipientName") as string;
  const recipientDob = formData.get("recipientDob") as string;
  const orgName = formData.get("orgName") as string;

  if (!recipientName || !orgName) {
    return { error: "Please fill in all required fields." };
  }

  try {
    // 1. Create organization
    const org = await createOrganization({
      name: orgName,
      orgType: "family",
    });

    // 2. Create identity in vault
    const identityToken = await createIdentity({
      orgId: org.id,
      fullName: recipientName,
      dob: recipientDob || undefined,
    });

    // 3. Create care recipient
    const { data: recipient, error: rError } = await supabaseAdmin
      .from("care_recipients")
      .insert({
        org_id: org.id,
        identity_token: identityToken,
      })
      .select("id")
      .single();

    if (rError || !recipient) {
      return { error: "Failed to create care recipient." };
    }

    // 4. Create coordinator membership
    const { error: mError } = await supabaseAdmin.from("memberships").insert({
      org_id: org.id,
      user_id: user.id,
      recipient_id: null,
      role: "coordinator",
      accepted_at: new Date().toISOString(),
    });

    if (mError) {
      return { error: "Failed to set up your membership." };
    }

    // 5. Mark user as onboarded
    await supabaseAdmin
      .from("user_profiles")
      .update({ onboarded: true })
      .eq("id", user.id);
  } catch (e: unknown) {
    const errorMessage = typeof e === "object" && e !== null && "message" in e
      ? (e as { message?: string }).message
      : undefined;
    return { error: errorMessage ?? "Something went wrong." };
  }

  redirect("/dashboard");
}
