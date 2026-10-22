import type { layoutRibbon } from "@/lib/layout";
import { fitCatalog, type TimeView } from "@/lib/timeline-math";

export const AXIS_HEIGHT = 44;
export const ROW_HEIGHT = 168;

type RibbonLayout = ReturnType<typeof layoutRibbon>;

export function rowHeightFor(): number {
  return ROW_HEIGHT;
}

export function spineY(top: number, rowHeight: number): number {
  return top + rowHeight / 2;
}

export type TimelineHit = {
  eventId: string | null;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zoom?: TimeView;
};

export function ribbonHits(layout: RibbonLayout, top: number, rowHeight: number): TimelineHit[] {
  const y = spineY(top, rowHeight);
  const nodeHits = layout.nodes.map((node) => ({
    eventId: node.id,
    title: node.title,
    x: node.x - 14,
    y: y - 14,
    w: 28,
    h: 28,
  }));
  const clusterHits = layout.clusters.map((cluster) => ({
    eventId: null,
    title: cluster.title,
    x: cluster.x - 16,
    y: y - 16,
    w: 32,
    h: 32,
    zoom: fitCatalog(cluster.startDay, cluster.endDay, 0.2),
  }));
  return [...nodeHits, ...clusterHits];
}
