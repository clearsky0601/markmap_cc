import type {
  Root,
  Heading,
  ListItem,
  List,
  PhrasingContent,
  RootContent,
} from "mdast";
import type { IPureNode } from "markmap-common";
import { deriveId, type NodeId } from "./nodeIds";

type MarkmapNode = IPureNode & {
  payload: { id: NodeId; mdastType: "heading" | "listItem" | "synthetic" };
};

const SYNTHETIC_ROOT_ID: NodeId = "synthetic:root";

export function mdastToMarkmap(
  root: Root,
  fallbackTitle = "Untitled",
): MarkmapNode {
  const headings: Heading[] = [];
  const looseLists: List[] = [];
  let firstH1: Heading | undefined;

  for (const child of root.children) {
    if (child.type === "heading") {
      if (child.depth === 1 && !firstH1) firstH1 = child;
      headings.push(child);
    } else if (child.type === "list" && headings.length === 0) {
      looseLists.push(child);
    }
  }

  const rootNode: MarkmapNode = firstH1
    ? buildHeadingNode(firstH1)
    : {
        content: escapeHtml(fallbackTitle),
        children: [],
        payload: { id: SYNTHETIC_ROOT_ID, mdastType: "synthetic" },
      };

  const headingStack: { depth: number; node: MarkmapNode }[] = [
    { depth: firstH1?.depth ?? 0, node: rootNode },
  ];

  let trailingList: List | undefined;

  for (const child of root.children as RootContent[]) {
    if (child.type === "heading") {
      if (child === firstH1) continue;
      const node = buildHeadingNode(child);
      while (
        headingStack.length > 1 &&
        headingStack[headingStack.length - 1].depth >= child.depth
      ) {
        headingStack.pop();
      }
      headingStack[headingStack.length - 1].node.children.push(node);
      headingStack.push({ depth: child.depth, node });
      trailingList = undefined;
    } else if (child.type === "list") {
      const parent = headingStack[headingStack.length - 1].node;
      for (const item of child.children) {
        parent.children.push(buildListItemNode(item));
      }
      trailingList = child;
    }
  }

  // List items appearing before any heading: hang them off the synthetic root.
  if (!firstH1) {
    for (const list of looseLists) {
      for (const item of list.children) {
        rootNode.children.push(buildListItemNode(item));
      }
    }
  }

  void trailingList;
  return rootNode;
}

function buildHeadingNode(node: Heading): MarkmapNode {
  return {
    content: phrasingToHtml(node.children),
    children: [],
    payload: { id: deriveId(node), mdastType: "heading" },
  };
}

function buildListItemNode(item: ListItem): MarkmapNode {
  let label = "";
  const childNodes: MarkmapNode[] = [];

  for (const block of item.children) {
    if (block.type === "paragraph" && !label) {
      label = phrasingToHtml(block.children);
    } else if (block.type === "list") {
      for (const sub of block.children) {
        childNodes.push(buildListItemNode(sub));
      }
    }
  }

  return {
    content: label || "(empty)",
    children: childNodes,
    payload: { id: deriveId(item), mdastType: "listItem" },
  };
}

function phrasingToHtml(children: PhrasingContent[]): string {
  let out = "";
  for (const c of children) {
    switch (c.type) {
      case "text":
        out += escapeHtml(c.value);
        break;
      case "inlineCode":
        out += `<code>${escapeHtml(c.value)}</code>`;
        break;
      case "strong":
        out += `<strong>${phrasingToHtml(c.children)}</strong>`;
        break;
      case "emphasis":
        out += `<em>${phrasingToHtml(c.children)}</em>`;
        break;
      case "delete":
        out += `<del>${phrasingToHtml(c.children)}</del>`;
        break;
      case "link":
        out += `<a href="${escapeAttr(c.url)}">${phrasingToHtml(c.children)}</a>`;
        break;
      case "break":
        out += "<br/>";
        break;
      default:
        if ("value" in c && typeof c.value === "string") out += escapeHtml(c.value);
        break;
    }
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
