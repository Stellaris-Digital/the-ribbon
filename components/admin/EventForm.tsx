"use client";

import { useActionState, useState } from "react";
import { deleteEvent, saveEvent, type ActionState } from "@/lib/actions";
import type { Catalog, CatalogEvent } from "@/lib/catalog-types";
import { endpointToInput, type Era } from "@/lib/dates";
import { flattenTree } from "@/lib/trees";

const inputClass = "mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm";

export function EventForm({ catalog, event }: { catalog: Catalog; event?: CatalogEvent }) {
  const [state, action, pending] = useActionState(saveEvent, null as ActionState);
  const [kind, setKind] = useState(event?.endOpen ? "ongoing" : event?.end ? "range" : "point");
  const [error, setError] = useState<string | null>(null);
  const start = event ? endpointToInput(event.start) : null;
  const end = event?.end ? endpointToInput(event.end) : null;

  return (
    <form action={action} className="space-y-6">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <label className="block text-sm">
        Title
        <input className={inputClass} name="title" defaultValue={event?.title ?? ""} required />
      </label>
      <label className="block text-sm">
        Summary
        <textarea className={inputClass} name="summary" defaultValue={event?.summary ?? ""} rows={3} />
      </label>
      <label className="block text-sm">
        Citation
        <input className={inputClass} name="citation" defaultValue={event?.citation ?? ""} />
      </label>
      <fieldset>
        <legend className="text-sm font-medium">Kind</legend>
        <div className="mt-2 flex gap-4 text-sm">
          {(["point", "range", "ongoing"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
              {value === "point" ? "Date" : value === "range" ? "Date range" : "Ongoing"}
            </label>
          ))}
        </div>
      </fieldset>
      <EndpointFields prefix="start" legend="Start" value={start} />
      {kind === "range" ? <EndpointFields prefix="end" legend="End" value={end} /> : null}
      <CheckTree name="labelIds" legend="Labels" nodes={catalog.labels} selected={event?.labelIds ?? []} />
      <CheckTree name="placeIds" legend="Places" nodes={catalog.places} selected={event?.placeIds ?? []} />
      {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-3">
        <button className="rounded-full bg-[#241c15] px-4 py-2 text-sm text-[#f7f1e4]" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save event"}
        </button>
        {event ? (
          <button
            type="button"
            className="text-sm text-red-700"
            onClick={async () => {
              if (!window.confirm(`Delete ${event.title}?`)) return;
              const result = await deleteEvent(event.id);
              setError(result?.error ?? null);
            }}
          >
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}

function EndpointFields({
  prefix,
  legend,
  value,
}: {
  prefix: "start" | "end";
  legend: string;
  value: { year: number; era: Era; month: number | null; day: number | null; certainty: "certain" | "estimated" } | null;
}) {
  return (
    <fieldset className="grid gap-3 rounded border border-[#e6dcc8] p-3 sm:grid-cols-4">
      <legend className="px-1 text-sm font-medium">{legend}</legend>
      <label className="text-sm">
        Year
        <input className={inputClass} name={`${prefix}Year`} type="number" min={1} defaultValue={value?.year ?? ""} required={prefix === "start"} />
      </label>
      <label className="text-sm">
        Era
        <select className={inputClass} name={`${prefix}Era`} defaultValue={value?.era ?? "CE"}>
          <option value="CE">CE</option>
          <option value="BCE">BCE</option>
        </select>
      </label>
      <label className="text-sm">
        Month
        <select className={inputClass} name={`${prefix}Month`} defaultValue={value?.month ?? ""}>
          <option value="">Unknown</option>
          {Array.from({ length: 12 }, (_, index) => (
            <option key={index + 1} value={index + 1}>
              {index + 1}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Day
        <input className={inputClass} name={`${prefix}Day`} type="number" min={1} max={31} defaultValue={value?.day ?? ""} />
      </label>
      <label className="text-sm sm:col-span-2">
        Certainty
        <select className={inputClass} name={`${prefix}Certainty`} defaultValue={value?.certainty ?? "certain"}>
          <option value="certain">Known date</option>
          <option value="estimated">Estimate</option>
        </select>
      </label>
    </fieldset>
  );
}

function CheckTree({
  name,
  legend,
  nodes,
  selected,
}: {
  name: string;
  legend: string;
  nodes: { id: string; parentId: string | null; name: string; position: number }[];
  selected: string[];
}) {
  const ordered = flattenTree(nodes);
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2 max-h-56 space-y-1 overflow-auto rounded border border-[#e6dcc8] p-3">
        {ordered.map((node) => (
          <label key={node.id} className="flex items-center gap-2 text-sm" style={{ paddingLeft: depthOf(nodes, node.id) * 14 }}>
            <input type="checkbox" name={name} value={node.id} defaultChecked={selected.includes(node.id)} />
            {node.name}
          </label>
        ))}
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
