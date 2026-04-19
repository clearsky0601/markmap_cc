import type { Root } from "mdast";
import { toMarkdown } from "mdast-util-to-markdown";

export function markdownFromMdast(root: Root): string {
  return toMarkdown(root, {
    bullet: "-",
    listItemIndent: "one",
    emphasis: "*",
    strong: "*",
    fences: true,
    setext: false,
  });
}
