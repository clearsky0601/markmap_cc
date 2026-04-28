import type {
  Break,
  Heading,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  Root,
  Text,
} from "mdast";
import type { Node as UnistNode } from "unist";
import { deriveId, type NodeId } from "./nodeIds";

// Zero-width space placeholder for "empty" text. Without it, an empty
// listItem serializes to "-\n", which the next round of parsing interprets
// as a setext-H2 underline when adjacent to text — destroying the tree.
const EMPTY_PLACEHOLDER = "\u200B";

function nonEmpty(line: string): string {
  return line === "" ? EMPTY_PLACEHOLDER : line;
}

function textToInline(text: string): PhrasingContent[] {
  if (text === "")
    return [{ type: "text", value: EMPTY_PLACEHOLDER } satisfies Text];
  const lines = text.split("\n");
  const out: PhrasingContent[] = [];
  for (let i = 0; i < lines.length; i++) {
    out.push({ type: "text", value: nonEmpty(lines[i]) } satisfies Text);
    if (i < lines.length - 1) out.push({ type: "break" } satisfies Break);
  }
  return out;
}

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

export function findPath(root: Root, id: NodeId): number[] | null {
  const stack: { node: UnistNode; path: number[] }[] = [{ node: root, path: [] }];
  while (stack.length) {
    const { node, path } = stack.pop()!;
    if (deriveId(node) === id) return path;
    const children = (node as { children?: UnistNode[] }).children;
    if (children) {
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({ node: children[i], path: [...path, i] });
      }
    }
  }
  return null;
}

export function resolvePath(root: Root, path: number[]): UnistNode | null {
  let node: UnistNode = root;
  for (const idx of path) {
    const children = (node as { children?: UnistNode[] }).children;
    if (!children || idx < 0 || idx >= children.length) return null;
    node = children[idx];
  }
  return node;
}

export function plainTextOf(node: UnistNode): string {
  if (node.type === "text" || node.type === "inlineCode") {
    return (node as Text).value.replace(/\u200B/g, "");
  }
  if (node.type === "break") return "\n";
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

  const inline = textToInline(newText);

  if (target.type === "heading") {
    (target as Heading).children = inline as Heading["children"];
  } else if (target.type === "listItem") {
    const li = target as ListItem;
    const firstParaIdx = li.children.findIndex((c) => c.type === "paragraph");
    const para: Paragraph = {
      type: "paragraph",
      children: inline as Paragraph["children"],
    };
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

function makeListItem(text: string): ListItem {
  return {
    type: "listItem",
    spread: false,
    children: [
      {
        type: "paragraph",
        children: textToInline(text) as Paragraph["children"],
      },
    ],
  };
}

function makeList(items: ListItem[]): List {
  return { type: "list", ordered: false, spread: false, children: items };
}

function findSectionEnd(
  rootChildren: Root["children"],
  headingIdx: number,
  depth: number,
): number {
  let end = headingIdx + 1;
  while (end < rootChildren.length) {
    const n = rootChildren[end];
    if (n.type === "heading" && n.depth <= depth) break;
    end++;
  }
  return end;
}

export function addSiblingAfter(
  root: Root,
  targetId: NodeId,
  text = "",
): { root: Root; path: number[] } | null {
  const cloned = structuredClone(root) as Root;
  const path = findPath(cloned, targetId);
  if (!path || path.length === 0) return null;

  const parentPath = path.slice(0, -1);
  const parent = resolvePath(cloned, parentPath);
  if (!parent) return null;
  const idxInParent = path[path.length - 1];
  const parentChildren = (parent as unknown as { children?: UnistNode[] }).children;
  if (!parentChildren) return null;
  const target = parentChildren[idxInParent];

  if (target.type === "listItem" && parent.type === "list") {
    (parent as List).children.splice(idxInParent + 1, 0, makeListItem(text));
    return { root: cloned, path: [...parentPath, idxInParent + 1] };
  }

  if (target.type === "heading" && parent.type === "root") {
    const heading = target as Heading;
    const rootChildren = (cloned as Root).children;
    const sectionEnd = findSectionEnd(rootChildren, idxInParent, heading.depth);
    const newHeading: Heading = {
      type: "heading",
      depth: heading.depth,
      children: textToInline(text) as Heading["children"],
    };
    rootChildren.splice(sectionEnd, 0, newHeading);
    return { root: cloned, path: [sectionEnd] };
  }

  return null;
}

export function addChildLast(
  root: Root,
  targetId: NodeId,
  text = "",
): { root: Root; path: number[] } | null {
  const cloned = structuredClone(root) as Root;
  const path = findPath(cloned, targetId);
  if (!path) return null;
  const target = resolvePath(cloned, path);
  if (!target) return null;

  if (target.type === "listItem") {
    const li = target as ListItem;
    const lastIdx = li.children.length - 1;
    const last = lastIdx >= 0 ? li.children[lastIdx] : undefined;
    if (last && last.type === "list") {
      const list = last as List;
      list.children.push(makeListItem(text));
      return {
        root: cloned,
        path: [...path, lastIdx, list.children.length - 1],
      };
    }
    const newList = makeList([makeListItem(text)]);
    li.children.push(newList);
    return { root: cloned, path: [...path, li.children.length - 1, 0] };
  }

  if (target.type === "heading") {
    if (path.length !== 1) return null;
    const heading = target as Heading;
    const rootChildren = (cloned as Root).children;
    const targetIdx = path[0];
    const sectionEnd = findSectionEnd(rootChildren, targetIdx, heading.depth);

    let lastListIdx = -1;
    for (let i = sectionEnd - 1; i > targetIdx; i--) {
      if (rootChildren[i].type === "list") {
        lastListIdx = i;
        break;
      }
    }
    if (lastListIdx >= 0) {
      const list = rootChildren[lastListIdx] as List;
      list.children.push(makeListItem(text));
      return {
        root: cloned,
        path: [lastListIdx, list.children.length - 1],
      };
    }
    const newList = makeList([makeListItem(text)]);
    rootChildren.splice(sectionEnd, 0, newList);
    return { root: cloned, path: [sectionEnd, 0] };
  }

  return null;
}

export function deleteNode(
  root: Root,
  targetId: NodeId,
): { root: Root; selectPath: number[] | null } | null {
  const cloned = structuredClone(root) as Root;
  const path = findPath(cloned, targetId);
  if (!path || path.length === 0) return null;

  const target = resolvePath(cloned, path);
  if (!target) return null;

  if (target.type === "listItem") {
    if (path.length < 2) return null;
    const parentPath = path.slice(0, -1);
    const parent = resolvePath(cloned, parentPath);
    if (!parent || parent.type !== "list") return null;

    const parentList = parent as List;
    const idxInParent = path[path.length - 1];

    let selectPath: number[] | null = null;
    if (parentList.children.length > 1) {
      if (idxInParent + 1 < parentList.children.length) {
        selectPath = [...parentPath, idxInParent]; // next sibling shifts down
      } else {
        selectPath = [...parentPath, idxInParent - 1];
      }
    } else {
      const gpPath = path.slice(0, -2);
      if (gpPath.length === 0) {
        const listIdx = path[path.length - 2];
        for (let i = listIdx - 1; i >= 0; i--) {
          if ((cloned as Root).children[i].type === "heading") {
            selectPath = [i];
            break;
          }
        }
      } else {
        const gp = resolvePath(cloned, gpPath);
        if (gp && gp.type === "listItem") selectPath = gpPath;
      }
    }

    parentList.children.splice(idxInParent, 1);

    if (parentList.children.length === 0) {
      const gpPath = path.slice(0, -2);
      const gp = resolvePath(cloned, gpPath);
      if (gp) {
        const gpChildren = (gp as unknown as { children?: UnistNode[] }).children;
        if (gpChildren) gpChildren.splice(path[path.length - 2], 1);
      }
    }

    return { root: cloned, selectPath };
  }

  if (target.type === "heading" && path.length === 1) {
    const heading = target as Heading;
    const rootChildren = (cloned as Root).children;
    const targetIdx = path[0];
    const sectionEnd = findSectionEnd(rootChildren, targetIdx, heading.depth);

    let selectPath: number[] | null = null;
    if (sectionEnd < rootChildren.length) {
      selectPath = [targetIdx];
    } else {
      for (let i = targetIdx - 1; i >= 0; i--) {
        if (rootChildren[i].type === "heading") {
          selectPath = [i];
          break;
        }
      }
    }

    rootChildren.splice(targetIdx, sectionEnd - targetIdx);
    return { root: cloned, selectPath };
  }

  return null;
}

export function moveNodeAsChild(
  root: Root,
  sourceId: NodeId,
  targetId: NodeId,
): { root: Root; path: number[] } | null {
  if (sourceId === targetId) return null;

  const cloned = structuredClone(root) as Root;
  const sourcePath = findPath(cloned, sourceId);
  const targetPath = findPath(cloned, targetId);
  if (!sourcePath || !targetPath) return null;

  // Prevent moving into own subtree
  if (
    sourcePath.length < targetPath.length &&
    sourcePath.every((v, i) => v === targetPath[i])
  )
    return null;

  const source = resolvePath(cloned, sourcePath);
  if (!source || source.type !== "listItem") return null;

  const sourceParentPath = sourcePath.slice(0, -1);
  const sourceParent = resolvePath(cloned, sourceParentPath);
  if (!sourceParent || sourceParent.type !== "list") return null;

  const sourceList = sourceParent as List;
  const sourceIdx = sourcePath[sourcePath.length - 1];
  const [removed] = sourceList.children.splice(sourceIdx, 1);

  if (sourceList.children.length === 0) {
    const gpPath = sourcePath.slice(0, -2);
    const gp = resolvePath(cloned, gpPath);
    if (gp) {
      const gpChildren = (gp as unknown as { children?: UnistNode[] }).children;
      if (gpChildren) gpChildren.splice(sourcePath[sourcePath.length - 2], 1);
    }
  }

  // Re-find target after source removal (indices may have shifted)
  const newTargetPath = findPath(cloned, targetId);
  if (!newTargetPath) return null;
  const target = resolvePath(cloned, newTargetPath);
  if (!target) return null;

  if (target.type === "listItem") {
    const li = target as ListItem;
    const last = li.children[li.children.length - 1];
    if (last && last.type === "list") {
      (last as List).children.push(removed);
      return {
        root: cloned,
        path: [...newTargetPath, li.children.length - 1, (last as List).children.length - 1],
      };
    }
    const newList = makeList([removed]);
    li.children.push(newList);
    return { root: cloned, path: [...newTargetPath, li.children.length - 1, 0] };
  }

  if (target.type === "heading" && newTargetPath.length === 1) {
    const heading = target as Heading;
    const rootChildren = (cloned as Root).children;
    const headingIdx = newTargetPath[0];
    const sectionEnd = findSectionEnd(rootChildren, headingIdx, heading.depth);

    let lastListIdx = -1;
    for (let i = sectionEnd - 1; i > headingIdx; i--) {
      if (rootChildren[i].type === "list") {
        lastListIdx = i;
        break;
      }
    }
    if (lastListIdx >= 0) {
      const list = rootChildren[lastListIdx] as List;
      list.children.push(removed);
      return { root: cloned, path: [lastListIdx, list.children.length - 1] };
    }
    const newList = makeList([removed]);
    rootChildren.splice(sectionEnd, 0, newList);
    return { root: cloned, path: [sectionEnd, 0] };
  }

  return null;
}

export function outdent(
  root: Root,
  targetId: NodeId,
): { root: Root; path: number[] } | null {
  const cloned = structuredClone(root) as Root;
  const path = findPath(cloned, targetId);
  if (!path || path.length < 4) return null;

  const target = resolvePath(cloned, path);
  const parent = resolvePath(cloned, path.slice(0, -1));
  const gp = resolvePath(cloned, path.slice(0, -2));
  const ggp = resolvePath(cloned, path.slice(0, -3));
  if (!target || !parent || !gp || !ggp) return null;
  if (
    target.type !== "listItem" ||
    parent.type !== "list" ||
    gp.type !== "listItem" ||
    ggp.type !== "list"
  ) {
    return null;
  }

  const idxInParent = path[path.length - 1];
  const parentIdxInGp = path[path.length - 2];
  const gpIdxInGgp = path[path.length - 3];

  const removed = (parent as List).children.splice(idxInParent, 1)[0];
  (ggp as List).children.splice(gpIdxInGgp + 1, 0, removed);

  if ((parent as List).children.length === 0) {
    (gp as ListItem).children.splice(parentIdxInGp, 1);
  }

  return {
    root: cloned,
    path: [...path.slice(0, -3), gpIdxInGgp + 1],
  };
}
