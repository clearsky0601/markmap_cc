import { useMemo } from "react";
import type { IPureNode } from "markmap-common";
import { useDocStore } from "../../store/docStore";
import { mdastToMarkmap } from "../../sync/mdastToMarkmap";

function Bullet({ node }: { node: IPureNode }) {
  const hasChildren = node.children.length > 0;

  const text = (
    <span
      className="outline__text"
      dangerouslySetInnerHTML={{ __html: node.content }}
    />
  );

  if (!hasChildren) {
    return (
      <li className="outline__item outline__item--leaf">
        <span className="outline__dot">•</span>
        {text}
      </li>
    );
  }

  return (
    <li className="outline__item outline__item--branch">
      <details open className="outline__details">
        <summary className="outline__summary">{text}</summary>
        <ul className="outline__list">
          {node.children.map((child, i) => (
            <Bullet key={i} node={child} />
          ))}
        </ul>
      </details>
    </li>
  );
}

export function OutlineView() {
  const mdast = useDocStore((s) => s.mdast);
  const root = useMemo(() => mdastToMarkmap(mdast), [mdast]);

  return (
    <div className="outline">
      <ul className="outline__list outline__list--root">
        <Bullet node={root} />
      </ul>
    </div>
  );
}
