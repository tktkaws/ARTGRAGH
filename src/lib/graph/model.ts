import type { GraphData, GraphNode, GraphSettings, GraphFilters } from "./types.ts";
import { REGION_LABELS, KIND_LABELS, PERIOD_LABELS } from './classification.ts';

export const TYPE_LABELS: Record<string, string> = {
  ...REGION_LABELS, ...KIND_LABELS, ...PERIOD_LABELS,
};
export const DEFAULT_SETTINGS: GraphSettings = {
  arrows: false,
  fade: 1.5,
  nodeSize: 1,
  linkWidth: 1,
  center: 0.52,
  repulsion: 10,
  linkStrength: 1,
  distance: 100,
  showOrphans: true,
  groups: [],
};

export function matchesNode(node: GraphNode, query: string): boolean {
  const text = query.trim().toLocaleLowerCase().normalize("NFKC");
  return (
    !text ||
    [
      node.title,
      node.subtitle,
      node.accessionNumber,
      ...node.searchTerms,
      String(node.number),
      ...node.tags,
      ...node.tags.map((tag) => TYPE_LABELS[tag] ?? tag),
    ].some((value) =>
      value.toLocaleLowerCase().normalize("NFKC").includes(text),
    )
  );
}

export function filterGraph(
  data: GraphData,
  query: string,
  filters: GraphFilters,
  showOrphans: boolean,
): GraphData {
  let nodes = data.nodes.filter(
    (node) => matchesNode(node, query)
      && (!filters.region || node.region === filters.region)
      && (!filters.period || node.period === filters.period)
      && (!filters.kind || node.kind === filters.kind),
  );
  const ids = new Set(nodes.map((node) => node.id));
  const links = data.links.filter(
    (link) => ids.has(link.source) && ids.has(link.target),
  );
  if (!showOrphans) {
    const connected = new Set(
      links.flatMap((link) => [link.source, link.target]),
    );
    nodes = nodes.filter((node) => connected.has(node.id));
  }
  return { nodes, links };
}

export function nodeColor(node: GraphNode, settings: GraphSettings): string {
  return (
    settings.groups.find(
      (group) => group.query.trim() && matchesNode(node, group.query),
    )?.color ?? "#bcb9c5"
  );
}

export function validateGraph(data: GraphData): void {
  const ids = new Set(data.nodes.map((node) => node.id));
  if (ids.size !== data.nodes.length)
    throw new Error("Duplicate graph node ID");
  for (const node of data.nodes)
    if (node.href !== `/artworks/${node.number}/`)
      throw new Error(`Invalid article URL: ${node.id}`);
  for (const link of data.links)
    if (link.source === link.target || !ids.has(link.source) || !ids.has(link.target))
      throw new Error("Unknown edge endpoint");
  const edgeKeys = data.links.map(link => [link.source, link.target].sort().join('|'));
  if (new Set(edgeKeys).size !== edgeKeys.length) throw new Error('Duplicate graph edge');
}

export function parseSettings(value: unknown): GraphSettings {
  const defaults = structuredClone(DEFAULT_SETTINGS);
  if (!value || typeof value !== "object") return defaults;
  const stored = value as Record<string, unknown>;
  if (
    stored.version !== 1 ||
    !stored.settings ||
    typeof stored.settings !== "object"
  )
    return defaults;
  const input = stored.settings as Record<string, unknown>;
  const ranges = {
    fade: [0, 4],
    nodeSize: [0.3, 3],
    linkWidth: [0.2, 4],
    center: [0, 1],
    repulsion: [0, 30],
    linkStrength: [0, 1],
    distance: [30, 300],
  };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const val = input[key];
    if (typeof val === "number" && Number.isFinite(val))
      Object.assign(defaults, { [key]: Math.max(min!, Math.min(max!, val)) });
  }
  for (const key of ["arrows", "showOrphans"] as const)
    if (typeof input[key] === "boolean") defaults[key] = input[key];
  if (Array.isArray(input.groups))
    defaults.groups = input.groups
      .slice(0, 20)
      .filter(
        (group) =>
          group &&
          typeof group.id === "string" &&
          typeof group.query === "string" &&
          /^#[0-9a-f]{6}$/i.test(group.color),
      )
      .map((group) => ({
        id: group.id,
        query: group.query.slice(0, 100),
        color: group.color,
      }));
  return defaults;
}
