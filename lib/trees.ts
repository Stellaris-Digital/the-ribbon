export type TreeRef = { id: string; parentId: string | null };

export function wouldCreateCycle(nodes: TreeRef[], id: string, nextParentId: string | null): boolean {
  if (nextParentId == null) return false;
  const parents = new Map(nodes.map((node) => [node.id, node.parentId]));
  let current: string | null = nextParentId;
  const seen = new Set<string>();
  while (current) {
    if (current === id) return true;
    if (seen.has(current)) return true;
    seen.add(current);
    current = parents.get(current) ?? null;
  }
  return false;
}

export function canDeleteNode(
  id: string,
  nodes: TreeRef[],
  referencedIds: Set<string>,
): { ok: true } | { ok: false; reason: string } {
  if (nodes.some((node) => node.parentId === id)) {
    return { ok: false, reason: "Move or remove nested items first." };
  }
  if (referencedIds.has(id)) {
    return { ok: false, reason: "Remove this from events first." };
  }
  return { ok: true };
}

export function eventColor(
  labelIds: string[],
  labels: { id: string; parentId: string | null; position: number; color: string }[],
): string {
  const order = new Map(flattenTree(labels).map((label, index) => [label.id, index]));
  const sorted = [...labelIds].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  const match = labels.find((label) => label.id === sorted[0]);
  return match?.color ?? "#57534e";
}

export function flattenTree<T extends TreeRef & { position?: number }>(nodes: T[]): T[] {
  const children = new Map<string | null, T[]>();
  for (const node of nodes) {
    const key = node.parentId;
    const list = children.get(key) ?? [];
    list.push(node);
    children.set(key, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));
  }
  const ordered: T[] = [];
  const walk = (parentId: string | null) => {
    for (const child of children.get(parentId) ?? []) {
      ordered.push(child);
      walk(child.id);
    }
  };
  walk(null);
  return ordered;
}

export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}

export function uniqueSlug(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}
