import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

export type DemoNode = Pick<SimulationNodeDatum, 'index' | 'x' | 'y' | 'vx' | 'vy'> & { id: string; group: string };
export type DemoLink = SimulationLinkDatum<DemoNode>;

export const DEMO_NODES = [
  { id: 'A', group: 'left', x: -120, y: -65 },
  { id: 'B', group: 'left', x: -175, y: 65 },
  { id: 'C', group: 'left', x: -30, y: 40 },
  { id: 'D', group: 'right', x: 75, y: -25 },
  { id: 'E', group: 'right', x: 175, y: -90 },
  { id: 'F', group: 'right', x: 155, y: 100 },
] as const;

export const DEMO_LINKS = [
  { source: 'A', target: 'B' },
  { source: 'A', target: 'C' },
  { source: 'B', target: 'C' },
  { source: 'C', target: 'D' },
  { source: 'D', target: 'E' },
  { source: 'D', target: 'F' },
] as const;

export const FORCE_CONTROLS = [
  { key: 'repulsion', label: '反発力', min: 0, max: 400, step: 10, value: 100, hint: '大きいほど、ノード同士が離れる' },
  { key: 'distance', label: 'リンクの距離', min: 40, max: 180, step: 5, value: 90, hint: '線でつながる点の目標距離' },
  { key: 'linkStrength', label: 'リンクする力', min: 0, max: 1, step: 0.05, value: 0.4, hint: '目標距離へ戻そうとする強さ' },
  { key: 'center', label: '中心力', min: 0, max: 0.15, step: 0.01, value: 0.05, hint: '大きいほど、原点へ引き寄せる' },
] as const;

export type ForceControl = typeof FORCE_CONTROLS[number]['key'];
export type DemoSettings = Record<ForceControl, number>;
export const DEMO_DEFAULTS: DemoSettings = Object.fromEntries(
  FORCE_CONTROLS.map(control => [control.key, control.value]),
) as DemoSettings;

// d3-force adds positions and replaces link endpoints with node references.
// Always hand the renderer fresh objects so the lesson's source data stays intact.
export function createDemoData(): { nodes: DemoNode[]; links: DemoLink[] } {
  return {
    nodes: DEMO_NODES.map(node => ({ ...node })),
    links: DEMO_LINKS.map(link => ({ ...link })),
  };
}
