import { getAllGuides } from "@/lib/education";
import { EducationClient } from "./EducationClient";

export default function EducationPage() {
  const allGuides = getAllGuides();
  const allTopics = Array.from(
    new Set(allGuides.flatMap((g) => g.topics)),
  ).sort();

  return <EducationClient guides={allGuides} topics={allTopics} />;
}
