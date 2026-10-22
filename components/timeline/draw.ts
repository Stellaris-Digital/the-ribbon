import type { layoutRibbon, TimelineCluster, TimelineNode } from "@/lib/layout";
import { axisTicks, type TimeView } from "@/lib/timeline-math";
import { AXIS_HEIGHT, spineY } from "@/components/timeline/geometry";

type RibbonLayout = ReturnType<typeof layoutRibbon>;

function drawNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  estimated: boolean,
  selected: boolean,
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = estimated ? "#fffdf8" : color;
  ctx.fill();
  ctx.lineWidth = selected ? 3 : 2.5;
  ctx.strokeStyle = selected ? "#241c15" : color;
  ctx.setLineDash(estimated ? [3, 2] : []);
  ctx.stroke();
  ctx.setLineDash([]);
  if (estimated) {
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  if (selected && !estimated) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = "#241c15";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function labelY(node: TimelineNode, spine: number) {
  return node.side === "above" ? spine - 28 - node.lane * 22 : spine + 28 + node.lane * 22;
}

function drawStem(ctx: CanvasRenderingContext2D, node: TimelineNode, spine: number) {
  if (!node.showLabel) return;
  const y = labelY(node, spine);
  const stemEnd = node.side === "above" ? y + 12 : y - 4;
  ctx.strokeStyle = "#c4b49a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(node.x, spine + (node.side === "above" ? -9 : 9));
  ctx.lineTo(node.x, stemEnd);
  if (Math.abs(node.labelX - node.x) > 2) ctx.lineTo(node.labelX, stemEnd);
  ctx.stroke();
}

function drawLabel(ctx: CanvasRenderingContext2D, node: TimelineNode, spine: number) {
  if (!node.showLabel) return;
  ctx.fillStyle = "#241c15";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = node.side === "above" ? "bottom" : "top";
  ctx.fillText(node.title, node.labelX, labelY(node, spine));
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawCluster(ctx: CanvasRenderingContext2D, cluster: TimelineCluster, spine: number) {
  ctx.beginPath();
  ctx.arc(cluster.x, spine, 13, 0, Math.PI * 2);
  ctx.fillStyle = "#241c15";
  ctx.fill();
  ctx.fillStyle = "#f7f1e4";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(cluster.count), cluster.x, spine);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

export function drawTimeline(
  ctx: CanvasRenderingContext2D,
  input: {
    width: number;
    height: number;
    view: TimeView;
    layouts: RibbonLayout[];
    rowHeights: number[];
    selectedId: string | null;
    messages: string[];
  },
) {
  const { width, view } = input;
  ctx.clearRect(0, 0, width, input.height);
  ctx.fillStyle = "#f3efe6";
  ctx.fillRect(0, 0, width, input.height);

  let top = AXIS_HEIGHT;
  input.layouts.forEach((layout, index) => {
    const rowHeight = input.rowHeights[index] ?? 0;
    const spine = spineY(top, rowHeight);
    ctx.fillStyle = index % 2 === 0 ? "#fffdf8" : "#f7f1e6";
    ctx.fillRect(0, top, width, rowHeight);

    ctx.strokeStyle = "#cbbfaa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, spine);
    ctx.lineTo(width, spine);
    ctx.stroke();

    if (layout.nodes.length === 0 && layout.clusters.length === 0) {
      ctx.fillStyle = "#8a7b68";
      ctx.font = "13px sans-serif";
      ctx.fillText(input.messages[index] ?? "", 16, spine - 16);
    }

    for (const node of layout.nodes) {
      if (node.endX == null) continue;
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 4;
      ctx.setLineDash(node.estimated ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(node.x, spine);
      ctx.lineTo(node.endX, spine);
      ctx.stroke();
      ctx.setLineDash([]);
      drawNode(ctx, node.endX, spine, 4, node.color, node.estimated, false);
    }

    for (const node of layout.nodes) {
      drawNode(ctx, node.x, spine, 7, node.color, node.estimated, input.selectedId === node.id);
    }
    for (const node of layout.nodes) drawStem(ctx, node, spine);
    for (const node of layout.nodes) drawLabel(ctx, node, spine);
    for (const cluster of layout.clusters) drawCluster(ctx, cluster, spine);

    top += rowHeight;
  });

  ctx.fillStyle = "#f7f1e4";
  ctx.fillRect(0, 0, width, AXIS_HEIGHT);
  ctx.strokeStyle = "#d9cdb8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, AXIS_HEIGHT - 0.5);
  ctx.lineTo(width, AXIS_HEIGHT - 0.5);
  ctx.stroke();
  ctx.fillStyle = "#3a2e22";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  for (const tick of axisTicks(view, width)) {
    const x = ((tick.day - view.startDay) / Math.max(view.endDay - view.startDay, 1)) * width;
    ctx.strokeStyle = "#c8b89f";
    ctx.beginPath();
    ctx.moveTo(x, AXIS_HEIGHT - 8);
    ctx.lineTo(x, AXIS_HEIGHT);
    ctx.stroke();
    ctx.fillText(tick.label, x + 4, 16);
  }
}
