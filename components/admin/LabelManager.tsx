"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteLabel, moveLabel, saveLabel, type ActionState } from "@/lib/actions";
import type { CatalogLabel } from "@/lib/catalog-types";
import { flattenTree, wouldCreateCycle } from "@/lib/trees";

const inputClass = "mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm";

export function LabelManager({ labels }: { labels: CatalogLabel[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const ordered = flattenTree(labels);

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <section className="rounded-lg border border-[#e6dcc8] bg-[#fffdf8] p-4">
        <h2 className="mb-3 font-semibold">New label</h2>
        <LabelForm labels={labels} />
      </section>
      <ul className="space-y-3">
        {ordered.map((label) => (
          <li key={label.id} className="rounded-lg border border-[#e6dcc8] bg-[#fffdf8] p-4" style={{ marginLeft: depthOf(labels, label.id) * 16 }}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ background: label.color }} />
              <span className="font-medium">{label.name}</span>
              <button type="button" className="text-sm text-stone-600" onClick={() => run(() => moveLabel(label.id, "up"), setError, router)}>
                Up
              </button>
              <button type="button" className="text-sm text-stone-600" onClick={() => run(() => moveLabel(label.id, "down"), setError, router)}>
                Down
              </button>
              <button
                type="button"
                className="text-sm text-red-700"
                onClick={() => {
                  if (!window.confirm(`Delete ${label.name}?`)) return;
                  void run(() => deleteLabel(label.id), setError, router);
                }}
              >
                Delete
              </button>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-stone-600">Edit</summary>
              <div className="mt-3">
                <LabelForm labels={labels} label={label} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LabelForm({ labels, label }: { labels: CatalogLabel[]; label?: CatalogLabel }) {
  const [state, action, pending] = useActionState(saveLabel, null as ActionState);
  const parents = flattenTree(labels).filter((item) => !label || (item.id !== label.id && !wouldCreateCycle(labels, label.id, item.id)));
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {label ? <input type="hidden" name="id" value={label.id} /> : null}
      <label className="text-sm">
        Name
        <input className={inputClass} name="name" defaultValue={label?.name ?? ""} required />
      </label>
      <label className="text-sm">
        Parent
        <select className={inputClass} name="parentId" defaultValue={label?.parentId ?? ""}>
          <option value="">None</option>
          {parents.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Color
        <input className={`${inputClass} h-10`} name="color" type="color" defaultValue={label?.color ?? "#1d4e89"} />
      </label>
      <label className="text-sm sm:col-span-2">
        Description
        <textarea className={inputClass} name="description" defaultValue={label?.description ?? ""} rows={2} />
      </label>
      {state?.error ? <p className="text-sm text-red-700 sm:col-span-2">{state.error}</p> : null}
      <button className="rounded-full bg-[#241c15] px-4 py-2 text-sm text-[#f7f1e4] sm:col-span-2" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save label"}
      </button>
    </form>
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

async function run(
  action: () => Promise<ActionState>,
  setError: (value: string | null) => void,
  router: { refresh: () => void },
) {
  const result = await action();
  setError(result?.error ?? null);
  if (!result?.error) router.refresh();
}
