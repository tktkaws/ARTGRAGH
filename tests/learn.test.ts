import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoData, DEMO_LINKS, type DemoNode } from '../src/lib/learn/force-graph-demo.ts';
import { createDemoSimulation, configureSimulation, DEFAULT_FORCES } from '../src/lib/learn/d3-simulation.ts';

test('simulation updates its own nodes and endpoints without changing the lesson source', () => {
  const source = createDemoData();
  const original = structuredClone(source);
  const { nodes, links, simulation } = createDemoSimulation();
  simulation.tick(40);
  assert.deepEqual(source, original);
  assert(DEMO_LINKS.every(link => typeof link.source === 'string' && typeof link.target === 'string'));
  assert(links.every(link => typeof link.source === 'object' && typeof link.target === 'object'));
  assert(nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y)));
  assert(nodes.some((node, index) => node.x !== original.nodes[index]!.x));
});

test('the no-force preset keeps initially stationary nodes still when manually ticking', () => {
  const { nodes, simulation } = createDemoSimulation({ ...DEFAULT_FORCES, charge: false, link: false, position: false });
  const before = nodes.map(node => ({ x: node.x, y: node.y }));
  simulation.tick(30);
  assert.deepEqual(nodes.map(node => ({ x: node.x, y: node.y })), before);
});

test('repulsion alone increases separation between nodes', () => {
  const { nodes, simulation } = createDemoSimulation({ ...DEFAULT_FORCES, charge: true, link: false, position: false });
  const distance = (items: DemoNode[]) => items.reduce((sum, node, index) => sum + items.slice(index + 1).reduce((subtotal, other) => subtotal + Math.hypot(node.x! - other.x!, node.y! - other.y!), 0), 0);
  const before = distance(nodes);
  simulation.tick(30);
  assert(distance(nodes) > before);
});

test('the link distance control changes the settled distance for an isolated pair', () => {
  function settle(distance: number) {
    const { simulation } = createDemoSimulation();
    const nodes: DemoNode[] = [{ id: 'A', group: 'test', x: -20, y: 0 }, { id: 'B', group: 'test', x: 20, y: 0 }];
    simulation.force('link', null).nodes(nodes);
    configureSimulation(simulation, [{ source: 'A', target: 'B' }], { ...DEFAULT_FORCES, charge: false, position: false, distance, linkStrength: 1 });
    simulation.alpha(1).tick(250);
    return Math.hypot(nodes[0]!.x! - nodes[1]!.x!, nodes[0]!.y! - nodes[1]!.y!);
  }
  assert(Math.abs(settle(60) - 60) < 1);
  assert(Math.abs(settle(160) - 160) < 1);
});
