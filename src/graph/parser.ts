export interface ResearchStory {
  id: string;
  title: string;
  description: string;
  validationCriteria: string;
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
  const section10 = content.match(/##\s*10\.?\s+Research stories?\s*\n([\s\S]*?)(?=\n##\s*\d+\.|$)/i);
  if (!section10) return [];

  const stories: ResearchStory[] = [];
  for (const block of section10[1].split(/(?=###\s*10\.\d+\.)/)) {
    const heading = block.match(/###\s*10\.\d+\.\s*(.+)/);
    if (!heading) continue;

    const id = block.match(/\*\*ID\*\*:\s*(RS-\d+)/i)?.[1]?.trim();
    if (!id) continue;

    const desc = block.match(/\*\*Description\*\*:\s*([^\n]+(?:\n(?![-\s]*\*\*)[^\n]+)*)/i)?.[1]?.trim() ?? "";
    const valid = block.match(/\*\*Validation criteria\*\*:\s*([\s\S]*?)(?=\n\s*-\s*\*\*|\n###|$)/i)?.[1]?.trim() ?? "";

    stories.push({ id, title: heading[1].trim(), description: desc, validationCriteria: valid });
  }
  return stories;
}
