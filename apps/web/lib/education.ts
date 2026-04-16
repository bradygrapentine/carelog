import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

// ─── types ───────────────────────────────────────────────────────────────────

export type Guide = {
  slug: string;
  title: string;
  summary: string;
  challenges: string[];
  topics: string[];
  tips: string[];
  external_url: string;
  content: string; // raw markdown body (without frontmatter)
};

// ─── helpers ─────────────────────────────────────────────────────────────────

const CONTENT_DIR = path.join(process.cwd(), "../../content/education");

function readGuideFile(filename: string): Guide | null {
  const slug = filename.replace(/\.md$/, "");
  const fullPath = path.join(CONTENT_DIR, filename);
  try {
    const raw = fs.readFileSync(fullPath, "utf-8");
    const { data, content } = matter(raw);
    return {
      slug,
      title: typeof data.title === "string" ? data.title : "",
      summary: typeof data.summary === "string" ? data.summary : "",
      challenges: Array.isArray(data.challenges) ? (data.challenges as string[]) : [],
      topics: Array.isArray(data.topics) ? (data.topics as string[]) : [],
      tips: Array.isArray(data.tips) ? (data.tips as string[]) : [],
      external_url: typeof data.external_url === "string" ? data.external_url : "",
      content,
    };
  } catch (err) {
    console.error(`Failed to read guide: ${filename}`, err);
    return null;
  }
}

// ─── public API ──────────────────────────────────────────────────────────────

export function getAllGuides(): Guide[] {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));
  return files.map(readGuideFile).filter((g): g is Guide => g !== null);
}

export function getGuideBySlug(slug: string): Guide | null {
  return readGuideFile(`${slug}.md`);
}

export function getGuidesByTags(tags: string[]): Guide[] {
  const allGuides = getAllGuides();
  const scored = allGuides.map((guide) => {
    const overlap = tags.filter(
      (tag) => guide.challenges.includes(tag) || guide.topics.includes(tag),
    ).length;
    return { guide, overlap };
  });
  return scored
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .map(({ guide }) => guide);
}
