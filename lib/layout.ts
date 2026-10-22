export type LayoutEvent = {
  id: string;
  title: string;
  color: string;
  startDay: number;
  endDay: number;
  startHatched: boolean;
  endHatched: boolean;
  tick: boolean;
  isRange?: boolean;
};

export type TimelineNode = {
  id: string;
  title: string;
  color: string;
  x: number;
  endX: number | null;
  labelX: number;
  lane: number;
  side: "above" | "below";
  showLabel: boolean;
  estimated: boolean;
};

export type TimelineCluster = {
  x: number;
  count: number;
  title: string;
  startDay: number;
  endDay: number;
};

const CLUSTER_GAP = 22;
const LABEL_CHAR_WIDTH = 7.4;
const LABEL_GAP = 12;
const LABEL_STEP = 22;
const LABEL_BASE = 28;

export function labelBox(node: Pick<TimelineNode, "title" | "labelX">) {
  const width = Math.max(28, node.title.length * LABEL_CHAR_WIDTH);
  return { left: node.labelX - width / 2, right: node.labelX + width / 2 };
}

function placeLabels(nodes: TimelineNode[], width: number, height: number) {
  const room = height / 2 - 12;
  const maxLane = Math.max(0, Math.floor((room - LABEL_BASE) / LABEL_STEP));
  const taken: { side: "above" | "below"; lane: number; left: number; right: number }[] = [];

  for (const node of nodes) {
    node.showLabel = false;
    node.labelX = node.x;
    node.lane = 0;
    if (node.x < 0 || node.x > width) continue;
    const full = Math.max(28, node.title.length * LABEL_CHAR_WIDTH);
    if (full + 16 > width) continue;
    const half = full / 2;
    let labelX = node.x;
    if (labelX - half < 8) labelX = half + 8;
    if (labelX + half > width - 8) labelX = width - 8 - half;
    const left = labelX - half;
    const right = labelX + half;

    for (let lane = 0; lane <= maxLane; lane += 1) {
      let placed = false;
      for (const side of ["above", "below"] as const) {
        const overlaps = taken.some(
          (box) =>
            box.side === side &&
            box.lane === lane &&
            left < box.right + LABEL_GAP &&
            right > box.left - LABEL_GAP,
        );
        if (overlaps) continue;
        node.side = side;
        node.lane = lane;
        node.labelX = labelX;
        node.showLabel = true;
        taken.push({ side, lane, left, right });
        placed = true;
        break;
      }
      if (placed) break;
    }
  }
}

export function layoutRibbon(input: {
  events: LayoutEvent[];
  viewStart: number;
  viewEnd: number;
  width: number;
  height: number;
}): { nodes: TimelineNode[]; clusters: TimelineCluster[]; lanes: number } {
  const span = Math.max(input.viewEnd - input.viewStart, 1);
  const placed = input.events
    .map((event) => {
      const startX = ((event.startDay - input.viewStart) / span) * input.width;
      const endX = ((event.endDay - input.viewStart) / span) * input.width;
      const range = Boolean(event.isRange) && endX - startX >= 16;
      return {
        event,
        x: range ? startX : (startX + endX) / 2,
        endX: range ? endX : null,
      };
    })
    .filter((item) => {
      const left = item.endX == null ? item.x : Math.min(item.x, item.endX);
      const right = item.endX == null ? item.x : Math.max(item.x, item.endX);
      return right >= 0 && left <= input.width;
    })
    .sort((a, b) => a.x - b.x || a.event.id.localeCompare(b.event.id));

  const groups: (typeof placed)[] = [];
  for (const item of placed) {
    const current = groups.at(-1);
    const previous = current?.at(-1);
    if (!current || !previous || item.x - previous.x > CLUSTER_GAP) groups.push([item]);
    else current.push(item);
  }

  const nodes: TimelineNode[] = [];
  const clusters: TimelineCluster[] = [];
  for (const group of groups) {
    if (group.length === 1) {
      const item = group[0];
      nodes.push({
        id: item.event.id,
        title: item.event.title,
        color: item.event.color,
        x: item.x,
        endX: item.endX,
        labelX: item.x,
        lane: 0,
        side: "above",
        showLabel: true,
        estimated: item.event.startHatched || item.event.endHatched,
      });
      continue;
    }
    const titles = group.map((item) => item.event.title);
    const shown = titles.slice(0, 3).join(", ");
    clusters.push({
      x: group.reduce((sum, item) => sum + item.x, 0) / group.length,
      count: group.length,
      title: titles.length > 3 ? `${group.length}: ${shown} +${titles.length - 3}` : `${group.length}: ${shown}`,
      startDay: Math.min(...group.map((item) => item.event.startDay)),
      endDay: Math.max(...group.map((item) => item.event.endDay)),
    });
  }

  placeLabels(nodes, input.width, input.height);

  return { nodes, clusters, lanes: 1 };
}
