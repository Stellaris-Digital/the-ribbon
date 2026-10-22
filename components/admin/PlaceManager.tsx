"use client";

import { useActionState, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { deletePlace, movePlace, savePlace, type ActionState } from "@/lib/actions";
import type { CatalogPlace, CatalogPlaceName } from "@/lib/catalog-types";
import { astronomicalToEra, type Era } from "@/lib/dates";
import { flattenTree, wouldCreateCycle } from "@/lib/trees";

const inputClass = "mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm";

type NameDraft = {
  name: string;
  startYear: string;
  startEra: Era;
  endYear: string;
  endEra: Era;
};

export function PlaceManager({ places }: { places: CatalogPlace[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const ordered = flattenTree(places);
  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <section className="rounded-lg border border-[#e6dcc8] bg-[#fffdf8] p-4">
        <h2 className="mb-3 font-semibold">New place</h2>
        <PlaceForm places={places} />
      </section>
      <ul className="space-y-3">
        {ordered.map((place) => (
          <li key={place.id} className="rounded-lg border border-[#e6dcc8] bg-[#fffdf8] p-4" style={{ marginLeft: depthOf(places, place.id) * 16 }}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium">{place.name}</span>
              <button type="button" className="text-sm text-stone-600" onClick={() => run(() => movePlace(place.id, "up"), setError, router)}>
                Up
              </button>
              <button type="button" className="text-sm text-stone-600" onClick={() => run(() => movePlace(place.id, "down"), setError, router)}>
                Down
              </button>
              <button
                type="button"
                className="text-sm text-red-700"
                onClick={() => {
                  if (!window.confirm(`Delete ${place.name}?`)) return;
                  void run(() => deletePlace(place.id), setError, router);
                }}
              >
                Delete
              </button>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-stone-600">Edit</summary>
              <div className="mt-3">
                <PlaceForm places={places} place={place} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlaceForm({ places, place }: { places: CatalogPlace[]; place?: CatalogPlace }) {
  const [state, action, pending] = useActionState(savePlace, null as ActionState);
  const [names, setNames] = useState<NameDraft[]>(place ? place.names.map(toDraft) : []);
  const parents = flattenTree(places).filter((item) => !place || (item.id !== place.id && !wouldCreateCycle(places, place.id, item.id)));
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {place ? <input type="hidden" name="id" value={place.id} /> : null}
      <input type="hidden" name="names" value={JSON.stringify(names)} />
      <label className="text-sm">
        Name
        <input className={inputClass} name="name" defaultValue={place?.name ?? ""} required />
      </label>
      <label className="text-sm">
        Parent
        <select className={inputClass} name="parentId" defaultValue={place?.parentId ?? ""}>
          <option value="">None</option>
          {parents.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Latitude
        <input className={inputClass} name="latitude" defaultValue={place?.latitude ?? ""} inputMode="decimal" />
      </label>
      <label className="text-sm">
        Longitude
        <input className={inputClass} name="longitude" defaultValue={place?.longitude ?? ""} inputMode="decimal" />
      </label>
      <div className="space-y-2 sm:col-span-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Historical names</h3>
          <button
            type="button"
            className="text-sm text-stone-600"
            onClick={() => setNames((current) => [...current, { name: "", startYear: "", startEra: "CE", endYear: "", endEra: "CE" }])}
          >
            Add name
          </button>
        </div>
        {names.map((name, index) => (
          <div key={index} className="grid gap-2 rounded border border-stone-200 p-2 sm:grid-cols-5">
            <input
              className="rounded border border-stone-300 px-2 py-1 text-sm sm:col-span-2"
              aria-label="Historical name"
              value={name.name}
              onChange={(event) => updateName(setNames, index, { name: event.target.value })}
            />
            <YearField label="From" year={name.startYear} era={name.startEra} onYear={(startYear) => updateName(setNames, index, { startYear })} onEra={(startEra) => updateName(setNames, index, { startEra })} />
            <YearField label="To" year={name.endYear} era={name.endEra} onYear={(endYear) => updateName(setNames, index, { endYear })} onEra={(endEra) => updateName(setNames, index, { endEra })} />
            <button type="button" className="text-sm text-red-700" onClick={() => setNames((current) => current.filter((_, item) => item !== index))}>
              Remove
            </button>
          </div>
        ))}
      </div>
      {state?.error ? <p className="text-sm text-red-700 sm:col-span-2">{state.error}</p> : null}
      <button className="rounded-full bg-[#241c15] px-4 py-2 text-sm text-[#f7f1e4] sm:col-span-2" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save place"}
      </button>
    </form>
  );
}

function YearField({
  label,
  year,
  era,
  onYear,
  onEra,
}: {
  label: string;
  year: string;
  era: Era;
  onYear: (value: string) => void;
  onEra: (value: Era) => void;
}) {
  return (
    <label className="text-xs text-stone-600">
      {label}
      <span className="mt-1 flex gap-1">
        <input className="w-full rounded border border-stone-300 px-2 py-1 text-sm" value={year} onChange={(event) => onYear(event.target.value)} inputMode="numeric" />
        <select className="rounded border border-stone-300 px-1 text-sm" value={era} onChange={(event) => onEra(event.target.value as Era)}>
          <option value="CE">CE</option>
          <option value="BCE">BCE</option>
        </select>
      </span>
    </label>
  );
}

function updateName(setNames: Dispatch<SetStateAction<NameDraft[]>>, index: number, patch: Partial<NameDraft>) {
  setNames((current) => current.map((name, item) => (item === index ? { ...name, ...patch } : name)));
}

function toDraft(name: CatalogPlaceName): NameDraft {
  const start = name.startYear == null ? null : astronomicalToEra(name.startYear);
  const end = name.endYear == null ? null : astronomicalToEra(name.endYear);
  return {
    name: name.name,
    startYear: start ? String(start.year) : "",
    startEra: start?.era ?? "CE",
    endYear: end ? String(end.year) : "",
    endEra: end?.era ?? "CE",
  };
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
