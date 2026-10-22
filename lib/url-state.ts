import type { TimeView } from "@/lib/timeline-math";

export type RibbonState = {
  caption: string;
  showAll: boolean;
  labelIds: string[];
  placeIds: string[];
};

export type ViewState = {
  view: TimeView;
  ribbons: RibbonState[];
};

export function serializeViewState(state: ViewState): string {
  const params = new URLSearchParams();
  params.set("t", `${state.view.startDay},${state.view.endDay}`);
  for (const ribbon of state.ribbons) {
    params.append("c", ribbon.caption);
    params.append("a", ribbon.showAll ? "1" : "0");
    params.append("l", ribbon.labelIds.join(","));
    params.append("p", ribbon.placeIds.join(","));
  }
  return params.toString();
}

export function parseViewState(params: URLSearchParams): ViewState | null {
  const time = params.get("t");
  if (!time) return null;
  const [startRaw, endRaw] = time.split(",");
  const startDay = Number(startRaw);
  const endDay = Number(endRaw);
  if (!Number.isFinite(startDay) || !Number.isFinite(endDay) || endDay <= startDay) return null;
  const captions = params.getAll("c");
  const flags = params.getAll("a");
  const labels = params.getAll("l");
  const places = params.getAll("p");
  if (captions.length === 0) return null;
  const ribbons = captions.map((caption, index) => ({
    caption,
    showAll: flags[index] === "1",
    labelIds: labels[index] ? labels[index].split(",").filter(Boolean) : [],
    placeIds: places[index] ? places[index].split(",").filter(Boolean) : [],
  }));
  return { view: { startDay, endDay }, ribbons };
}

export function defaultViewState(view: TimeView): ViewState {
  return {
    view,
    ribbons: [{ caption: "All events", showAll: true, labelIds: [], placeIds: [] }],
  };
}
