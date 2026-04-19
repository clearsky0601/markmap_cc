import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Root } from "mdast";

const processor = unified().use(remarkParse);

export function mdastFromMarkdown(markdown: string): Root {
  return processor.parse(markdown) as Root;
}
