import type { Metadata } from "next";
import { ForReferrersPage } from "../../../components/marketing/ForReferrersPage";

export const metadata: Metadata = {
  title: "For Referrers — Carelog",
  description:
    "Recommend Carelog to the families you work with. A caregiving coordination platform for medications, aide scheduling, and the whole care team — built for social workers, discharge planners, elder law attorneys, and geriatric care managers to refer with confidence.",
};

export default function ForReferrersLandingPage() {
  return (
    <div className="py-20">
      <ForReferrersPage />
    </div>
  );
}
