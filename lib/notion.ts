import { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  PageObjectResponse,
  PartialBlockObjectResponse,
  PartialPageObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";

let cachedClient: Client | null = null;

function getClient(): Client {
  if (!cachedClient) {
    const auth = process.env.NOTION_API_KEY;
    if (!auth) {
      throw new Error("NOTION_API_KEY is not set");
    }
    cachedClient = new Client({ auth });
  }
  return cachedClient;
}

function getDatabaseId(): string | null {
  const id = process.env.NOTION_DATABASE_ID;
  return id && id.length > 0 ? id : null;
}

const ID_PATTERN =
  /([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})/i;

export function extractPageId(input: string): string {
  const match = input.trim().match(ID_PATTERN);
  if (!match) {
    throw new Error(
      "Couldn't find a Notion page ID in that input. Paste the page URL or its 32-character ID.",
    );
  }
  return match[1].replace(/-/g, "");
}

export interface PageSummary {
  id: string;
  title: string;
}

type QueryResultItem =
  | PageObjectResponse
  | PartialPageObjectResponse
  | { object: "database" }
  | { object: "page"; id: string };

function isFullPage(item: QueryResultItem): item is PageObjectResponse {
  return "properties" in item;
}

function extractTitle(page: PageObjectResponse): string {
  for (const value of Object.values(page.properties)) {
    if (value.type === "title") {
      return value.title.map((t) => t.plain_text).join("").trim() || "Untitled";
    }
  }
  return "Untitled";
}

export async function listDatabasePages(): Promise<PageSummary[] | null> {
  const databaseId = getDatabaseId();
  if (!databaseId) return null;

  const notion = getClient();
  const response = await notion.databases.query({
    database_id: databaseId,
    page_size: 100,
  });

  return response.results.filter(isFullPage).map((page) => ({
    id: page.id,
    title: extractTitle(page),
  }));
}

export async function getPageTitle(pageId: string): Promise<string> {
  const notion = getClient();
  const page = await notion.pages.retrieve({ page_id: pageId });
  if (!("properties" in page)) return "Untitled";
  return extractTitle(page);
}

function isFullBlock(
  block: BlockObjectResponse | PartialBlockObjectResponse,
): block is BlockObjectResponse {
  return "type" in block;
}

function richTextToPlain(rich: RichTextItemResponse[]): string {
  return rich.map((r) => r.plain_text).join("");
}

function blockToText(block: BlockObjectResponse): string | null {
  switch (block.type) {
    case "paragraph":
      return richTextToPlain(block.paragraph.rich_text);
    case "heading_1":
      return `# ${richTextToPlain(block.heading_1.rich_text)}`;
    case "heading_2":
      return `## ${richTextToPlain(block.heading_2.rich_text)}`;
    case "heading_3":
      return `### ${richTextToPlain(block.heading_3.rich_text)}`;
    case "bulleted_list_item":
      return `- ${richTextToPlain(block.bulleted_list_item.rich_text)}`;
    case "numbered_list_item":
      return `- ${richTextToPlain(block.numbered_list_item.rich_text)}`;
    case "quote":
      return `> ${richTextToPlain(block.quote.rich_text)}`;
    case "callout":
      return richTextToPlain(block.callout.rich_text);
    case "to_do":
      return `- [${block.to_do.checked ? "x" : " "}] ${richTextToPlain(block.to_do.rich_text)}`;
    default:
      return null;
  }
}

export async function getPageText(pageId: string): Promise<string> {
  const notion = getClient();
  const lines: string[] = [];

  let cursor: string | undefined;
  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      if (!isFullBlock(block)) continue;
      const text = blockToText(block);
      if (text && text.trim().length > 0) {
        lines.push(text);
      }
    }

    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return lines.join("\n\n");
}
