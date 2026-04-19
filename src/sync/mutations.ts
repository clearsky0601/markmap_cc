import type { Heading, ListItem, Paragraph, Root, Text } from "mdast";
import type { Node as UnistNode } from "unist";
import { deriveId, type NodeId } from "./nodeIds";

export function findById(root: Root, id: NodeId): UnistNode | null {
  const stack: UnistNode[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    if (deriveId(n) === id) return n;
    const children = (n as { children?: UnistNode[] }).children;
    if (children) {
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    }
  }
  return null;
}

export function plainTextOf(node: UnistNode): string {
  if (node.type === "text" || node.type === "inlineCode") {
    return (node as Text).value;
  }
  if (node.type === "listItem") {
    const para = (node as ListItem).children.find(
      (c): c is Paragraph => c.type === "paragraph",
    );
    return para ? plainTextOf(para) : "";
  }
  const children = (node as { children?: UnistNode[] }).children;
  if (children) return children.map(plainTextOf).join("");
  return "";
}

export function editNodeText(
  root: Root,
  targetId: NodeId,
  newText: string,
): Root {
  const cloned = structuredClone(root) as Root;
  const target = findById(cloned, targetId);
  if (!target) return root;

  const text: Text = { type: "text", value: newText };

  if (target.type === "heading") {
    (target as Heading).children = [text];
  } else if (target.type === "listItem") {
    const li = target as ListItem;
    const firstParaIdx = li.children.findIndex((c) => c.type === "paragraph");
    const para: Paragraph = { type: "paragraph", children: [text] };
    if (firstParaIdx >= 0) {
      li.children[firstParaIdx] = para;
    } else {
      li.children.unshift(para);
    }
  }
  return cloned;
}

export function isEditable(node: UnistNode): boolean {
  return node.type === "heading" || node.type === "listItem";
}
