import { forceSimulation, forceManyBody, forceLink, forceX, forceY, type Simulation } from 'd3-force';
import { createDemoData, DEMO_DEFAULTS, type DemoNode, type DemoLink, type DemoSettings } from './force-graph-demo.ts';

export type ForceSettings = DemoSettings & { charge: boolean; link: boolean; position: boolean };
export const DEFAULT_FORCES: ForceSettings = { ...DEMO_DEFAULTS, charge: true, link: true, position: true };
export const FORCE_PRESETS = [
  { id: 'none', label: '力なし', charge: false, link: false, position: false },
  { id: 'charge', label: '反発だけ', charge: true, link: false, position: false },
  { id: 'link', label: '反発＋リンク', charge: true, link: true, position: false },
  { id: 'all', label: '中心力も追加', charge: true, link: true, position: true },
] as const;

export function configureSimulation(simulation: Simulation<DemoNode, DemoLink>, links: DemoLink[], settings: ForceSettings) {
  simulation
    .force('charge', settings.charge ? forceManyBody<DemoNode>().strength(-settings.repulsion) : null)
    .force('link', settings.link ? forceLink<DemoNode, DemoLink>(links).id(node => node.id).distance(settings.distance).strength(settings.linkStrength) : null)
    .force('x', settings.position ? forceX<DemoNode>(0).strength(settings.center) : null)
    .force('y', settings.position ? forceY<DemoNode>(0).strength(settings.center) : null);
  return simulation;
}

// Start stopped: the UI owns when to tick, animate, and release the timer.
export function createDemoSimulation(settings: ForceSettings = DEFAULT_FORCES) {
  const { nodes, links } = createDemoData();
  const simulation = forceSimulation<DemoNode, DemoLink>(nodes).stop();
  return { nodes, links, simulation: configureSimulation(simulation, links, settings) };
}
