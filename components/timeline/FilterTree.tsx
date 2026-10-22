"use client";

import { flattenTree } from "@/lib/trees";

type Node = { id: string; parentId: string | null; name: string; position: number };

export function FilterTree({
  label,
  nodes,
  selected,
  onChange,
}: {
  label: string;
  nodes: Node[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const ordered = flattenTree(nodes);
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">{label}</legend>
      <div className="max-h-40 space-y-1 overflow-auto pr-1">
        {ordered.map((node) => {
          const depth = depthOf(nodes, node.id);
          return (
            <label key={node.id} className="flex items-center gap-2 text-sm" style={{ paddingLeft: depth * 12 }}>
              <input
                type="checkbox"
                checked={selected.includes(node.id)}
                onChange={() => {
                  onChange(
                    selected.includes(node.id)
                      ? selected.filter((id) => id !== node.id)
                      : [...selected, node.id],
                  );
                }}
              />
              <span>{node.name}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function depthOf(nodes: { id: string; parentId: string | null }[], id: string) {
  let depth = 0;
  let current = nodes.find((node) => node.id === id);
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = nodes.find((node) => node.id === current?.parentId);
  }
  return depth;
}
