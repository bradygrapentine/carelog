import { inngest } from "../client";
import { supabaseAdmin } from "../../server/supabaseAdmin.server";
import { getGuidesByTags } from "../../lib/education";

export const educationTipRefresh = inngest.createFunction(
  { id: "education-tip-refresh", name: "Refresh education tip per org" },
  { cron: "0 6 * * *" }, // 6am UTC daily
  async () => {
    // Get all active orgs
    const { data: orgs, error } = await supabaseAdmin
      .from("organizations")
      .select("id");

    if (error || !orgs) return { refreshed: 0 };

    let refreshed = 0;

    for (const org of orgs) {
      // Get last 7 days of mood entries to extract challenge tags
      const since = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data: moodEntries } = await supabaseAdmin
        .from("mood_entries")
        .select("mood, notes")
        .eq("org_id", org.id)
        .gte("created_at", since);

      const { data: careEvents } = await supabaseAdmin
        .from("care_events")
        .select("notes")
        .eq("org_id", org.id)
        .gte("created_at", since);

      // Build tag signal from mood data
      const tags: string[] = [];
      if (
        moodEntries?.some((e) => e.mood === "difficult" || e.mood === "crisis")
      ) {
        tags.push("agitation", "sundowning");
      }
      if (moodEntries?.some((e) => e.mood === "okay" || e.mood === "good")) {
        tags.push("caregiver-wellbeing");
      }
      if (careEvents && careEvents.length > 5) {
        tags.push("caregiver-burnout");
      }

      if (tags.length === 0) tags.push("caregiver-burnout"); // sensible default

      const [topGuide] = getGuidesByTags(tags);
      if (!topGuide) continue;

      await supabaseAdmin.from("education_tip_cache").upsert(
        {
          org_id: org.id,
          guide_slug: topGuide.slug,
          refreshed_at: new Date().toISOString(),
        },
        { onConflict: "org_id" },
      );

      refreshed++;
    }

    return { refreshed };
  },
);
