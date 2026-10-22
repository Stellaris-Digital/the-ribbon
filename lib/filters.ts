export type RibbonFilter = {
  labelIds: string[];
  placeIds: string[];
  showAll: boolean;
};

type TreeNode = { id: string; parentId: string | null };

function withDescendants(nodes: TreeNode[], selected: string[]): Set<string> {
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const list = children.get(node.parentId) ?? [];
    list.push(node.id);
    children.set(node.parentId, list);
  }
  const expanded = new Set<string>();
  const stack = [...selected];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || expanded.has(id)) continue;
    expanded.add(id);
    for (const child of children.get(id) ?? []) stack.push(child);
  }
  return expanded;
}

export function eventMatchesRibbon(
  event: { labelIds: string[]; placeIds: string[] },
  ribbon: RibbonFilter,
  labels: TreeNode[],
  places: TreeNode[],
): boolean {
  const labelFilter = ribbon.labelIds.length > 0;
  const placeFilter = ribbon.placeIds.length > 0;
  if (!labelFilter && !placeFilter) return ribbon.showAll;

  if (labelFilter) {
    const allowed = withDescendants(labels, ribbon.labelIds);
    if (!event.labelIds.some((id) => allowed.has(id))) return false;
  }
  if (placeFilter) {
    const allowed = withDescendants(places, ribbon.placeIds);
    if (!event.placeIds.some((id) => allowed.has(id))) return false;
  }
  return true;
}
