/** What a node represents — drives its shape/label in the graph. */
export type StoryKind = "hypothesis" | "ablation" | "fork" | "baseline";

export interface ResearchStory {
  id: string;
  title: string;
  description: string;
  validationCriteria: string;
  /** Parent node id (RS-NNN). Absent → child of the research-document root. */
  parent?: string;
  /** Node kind. Defaults to "hypothesis". */
  kind: StoryKind;
}

export interface ResearchDocument {
  title: string;
  summary: string;
  stories: ResearchStory[];
}

export function parseResearchDocument(content: string): ResearchDocument {
  const titleMatch = content.match(/^# RD:\s*(.+)/m);
  const title = titleMatch?.[1]?.trim() ?? "Untitled Research";

  const summaryMatch = content.match(/###\s*1\.2\s+Research summary\s*\n([\s\S]*?)(?=\n##|\n###\s*\d|$)/i);
  const summary = summaryMatch?.[1]?.trim() ?? "";

  return { title, summary, stories: parseStories(content) };
}

function parseStories(content: string): ResearchStory[] {
  const section10 = content.match(/##\s*10\.?\s+Research stories?\s*\n([\s\S]*?)(?=\n##\s*\d|$)/i);
  if (!section10) return [];

  const stories: ResearchStory[] = [];
  for (const block of section10[1].split(/(?=###\s*10\.\d+\.)/)) {
    const heading = block.match(/###\s*10\.\d+\.\s*(.+)/);
    if (!heading) continue;

    const id = block.match(/\*\*ID\*\*:[^\S\n]*(RS-\d+)/i)?.[1]?.trim();
    if (!id) continue;

    const desc = block.match(/\*\*Description\*\*:[^\S\n]*([^\n]+(?:\n(?![-\s]*\*\*)[^\n]+)*)/i)?.[1]?.trim() ?? "";
    const valid = block.match(/\*\*Validation criteria\*\*:[^\S\n]*([\s\S]*?)(?=\n\s*-\s*\*\*|\n###|$)/i)?.[1]?.trim() ?? "";
    const parent = block.match(/\*\*Parent\*\*:[^\S\n]*(RS-\d+)/i)?.[1]?.trim();
    const kindRaw = block.match(/\*\*(?:Kind|Type)\*\*:[^\S\n]*(\w+)/i)?.[1]?.toLowerCase();
    const kind: StoryKind =
      kindRaw === "ablation" ? "ablation" :
      kindRaw === "fork"     ? "fork" :
      kindRaw === "baseline" ? "baseline" : "hypothesis";

    stories.push({ id, title: heading[1].trim(), description: desc, validationCriteria: valid, parent, kind });
  }
  return stories;
}
