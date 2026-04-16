import { createServerSupabase } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import { ErrorBoundary } from "../../../components/ErrorBoundary";
import { DashboardClient } from "./DashboardClient";
import { DashboardViewTracker } from "./DashboardViewTracker";
import { EducationTipWidget } from "@/components/education/EducationTipWidget";
import { getGuideBySlug } from "@/lib/education";

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .limit(1)
    .maybeSingle();

  const { data: tipCache } = membership?.org_id
    ? await supabase
        .from("education_tip_cache")
        .select("guide_slug")
        .eq("org_id", membership.org_id)
        .maybeSingle()
    : { data: null };

  const tipGuide = tipCache ? getGuideBySlug(tipCache.guide_slug) : null;

  return (
    <ErrorBoundary>
      <DashboardViewTracker orgId={membership?.org_id ?? undefined} />
      {tipGuide && (
        <EducationTipWidget
          guideSlug={tipGuide.slug}
          guideTitle={tipGuide.title}
          guideSummary={tipGuide.summary}
        />
      )}
      <DashboardClient user={user} />
    </ErrorBoundary>
  );
}
