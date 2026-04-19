import type { Node as UnistNode } from "unist";

export type NodeId = string;

export function deriveId(node: UnistNode): NodeId {
  const offset = node.position?.start?.offset ?? -1;
  return `${node.type}:${offset}`;
}
