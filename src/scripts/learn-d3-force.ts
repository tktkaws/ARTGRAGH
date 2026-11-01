import { createDemoSimulation, configureSimulation, DEFAULT_FORCES, FORCE_PRESETS, type ForceSettings } from '../lib/learn/d3-simulation';
import { FORCE_CONTROLS, type ForceControl, type DemoLink, type DemoNode } from '../lib/learn/force-graph-demo';

function startDemo(root: HTMLElement) {
  const controller = new AbortController();
  const { signal } = controller;
  const el = <T extends Element = HTMLElement>(id: string) => {
    const element = root.querySelector<T>(`#${root.dataset.instance}-${id}`);
    if (!element) throw new Error(`Missing d3 demo element: ${id}`);
    return element;
  };
  const input = (id: string) => el<HTMLInputElement>(id);
  const svg = el<SVGSVGElement>('d3-svg');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
  const namespace = 'http://www.w3.org/2000/svg';
  const mode = root.dataset.mode;
  let settings: ForceSettings = {
    ...DEFAULT_FORCES,
    link: mode === 'link' || mode === 'position',
    position: mode === 'position',
  };
  let data = createDemoSimulation(settings);
  let selected = 'A';
  let running = false;
  let disposed = false;
  let observer: ResizeObserver | undefined;
  let visibility: IntersectionObserver | undefined;
  let visible = false;
  const lines: SVGLineElement[] = [];
  const groups = new Map<string, SVGGElement>();

  function setRunning(value: boolean) {
    running = value;
    el('d3-state').textContent = value ? '計算中' : '停止中';
    el('d3-run').textContent = value ? '計算を停止' : '計算を再開';
    el('d3-run').setAttribute('aria-pressed', String(value));
  }
  function point(endpoint: DemoLink['source']): DemoNode {
    return typeof endpoint === 'object' ? endpoint : data.nodes.find(node => node.id === String(endpoint))!;
  }
  function render() {
    if (disposed) return;
    data.links.forEach((link, index) => {
      const source = point(link.source), target = point(link.target);
      lines[index]!.setAttribute('x1', String(source.x ?? 0));
      lines[index]!.setAttribute('y1', String(source.y ?? 0));
      lines[index]!.setAttribute('x2', String(target.x ?? 0));
      lines[index]!.setAttribute('y2', String(target.y ?? 0));
    });
    for (const node of data.nodes) {
      const group = groups.get(node.id)!;
      group.setAttribute('transform', `translate(${node.x ?? 0}, ${node.y ?? 0})`);
      group.querySelector('circle')!.setAttribute('fill', node.id === selected ? '#d0b3ff' : '#bcb9c5');
    }
    const node = data.nodes.find(node => node.id === selected)!;
    for (const key of ['x', 'y', 'vx', 'vy'] as const) {
      el<HTMLOutputElement>(`d3-${key}`).value = (node[key] ?? 0).toFixed(2);
    }
    el<HTMLOutputElement>('d3-alpha').value = data.simulation.alpha().toFixed(3);
  }
  function fit() {
    if (disposed) return;
    const xs = data.nodes.map(node => node.x ?? 0), ys = data.nodes.map(node => node.y ?? 0);
    const width = Math.max(400, Math.max(...xs) - Math.min(...xs) + 120);
    const height = Math.max(300, Math.max(...ys) - Math.min(...ys) + 120);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2 - width / 2;
    const y = (Math.min(...ys) + Math.max(...ys)) / 2 - height / 2;
    svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  }
  function select(id: string) {
    selected = id;
    root!.querySelectorAll<HTMLButtonElement>('[data-d3-node]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.d3Node === id));
    });
    el('d3-coordinate-caption').textContent = `ノード ${id} の計算結果`;
    render();
  }
  function sync() {
    for (const control of FORCE_CONTROLS) {
      const enabled = control.key === 'repulsion' ? settings.charge : control.key === 'center' ? settings.position : settings.link;
      input(`d3-${control.key}`).value = String(settings[control.key]);
      input(`d3-${control.key}`).disabled = !enabled;
      el<HTMLOutputElement>(`d3-output-${control.key}`).value = String(settings[control.key]);
    }
    for (const key of ['charge', 'link', 'position'] as const) input(`d3-${key}`).checked = settings[key];
    root!.querySelectorAll<HTMLButtonElement>('[data-d3-preset]').forEach(button => {
      const preset = FORCE_PRESETS.find(item => item.id === button.dataset.d3Preset)!;
      button.setAttribute('aria-pressed', String(preset.charge === settings.charge && preset.link === settings.link && preset.position === settings.position));
    });
    el('d3-code').textContent = [
      "forceSimulation(nodes)",
      settings.charge ? `  .force('charge', forceManyBody().strength(${-settings.repulsion}))` : "  .force('charge', null)",
      settings.link ? `  .force('link', forceLink(links).id(d => d.id)\n    .distance(${settings.distance}).strength(${settings.linkStrength}))` : "  .force('link', null)",
      settings.position ? `  .force('x', forceX(0).strength(${settings.center}))\n  .force('y', forceY(0).strength(${settings.center}))` : "  .force('x', null)\n  .force('y', null)",
      "  .on('tick', render);",
    ].join('\n');
  }
  function restart(animate = mode !== 'tick' && !reduced) {
    if (animate) {
      data.simulation.alpha(1);
      if (visible) data.simulation.restart();
      setRunning(true);
    } else {
      data.simulation.stop().alpha(1);
      if (mode !== 'tick') data.simulation.tick(160);
      setRunning(false);
      render();
      fit();
    }
  }
  function bindSimulation() {
    data.simulation.on('tick.demo', render).on('end.demo', () => { setRunning(false); render(); fit(); });
  }
  function replaceData() {
    data.simulation.stop();
    data = createDemoSimulation(settings);
    bindSimulation();
    sync();
    render();
    fit();
    restart();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    data.simulation.stop().on('tick.demo', null).on('end.demo', null);
    observer?.disconnect();
    visibility?.disconnect();
    controller.abort();
  }

  try {
    for (let index = 0; index < data.links.length; index++) {
      const line = document.createElementNS(namespace, 'line');
      line.setAttribute('stroke', '#79717e66');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      el('d3-lines').append(line);
      lines.push(line);
    }
    for (const node of data.nodes) {
      const group = document.createElementNS(namespace, 'g');
      group.dataset.nodeId = node.id;
      group.style.cursor = 'pointer';
      const circle = document.createElementNS(namespace, 'circle');
      circle.setAttribute('r', '16');
      const text = document.createElementNS(namespace, 'text');
      text.textContent = node.id;
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dy', '30');
      text.setAttribute('fill', textColor);
      text.setAttribute('font-size', '13');
      group.append(circle, text);
      el('d3-nodes').append(group);
      groups.set(node.id, group);
    }
    root.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button').forEach(control => { control.disabled = false; });
    root.querySelectorAll('output').forEach(output => output.setAttribute('aria-live', 'off'));
    bindSimulation();
    sync();
    select('A');
    fit();
    restart();

    root.querySelectorAll<HTMLButtonElement>('[data-d3-node]').forEach(button => button.addEventListener('click', () => select(button.dataset.d3Node!), { signal }));
    svg.addEventListener('click', event => {
      const target = event.target;
      if (target instanceof Element) {
        const id = target.closest<SVGGElement>('[data-node-id]')?.dataset.nodeId;
        if (id) select(id);
      }
    }, { signal });
    root.querySelectorAll<HTMLInputElement>('[data-d3-setting]').forEach(control => control.addEventListener('input', () => {
      settings[control.dataset.d3Setting as ForceControl] = Number(control.value);
      configureSimulation(data.simulation, data.links, settings);
      sync();
      restart();
    }, { signal }));
    for (const key of ['charge', 'link', 'position'] as const) {
      input(`d3-${key}`).addEventListener('change', event => {
        settings[key] = (event.currentTarget as HTMLInputElement).checked;
        configureSimulation(data.simulation, data.links, settings);
        sync();
        restart();
      }, { signal });
    }
    root.querySelectorAll<HTMLButtonElement>('[data-d3-preset]').forEach(button => button.addEventListener('click', () => {
      const preset = FORCE_PRESETS.find(item => item.id === button.dataset.d3Preset)!;
      settings = { ...DEFAULT_FORCES, charge: preset.charge, link: preset.link, position: preset.position };
      replaceData();
    }, { signal }));
    el('d3-step').addEventListener('click', () => {
      data.simulation.stop();
      if (data.simulation.alpha() < data.simulation.alphaMin()) data.simulation.alpha(1);
      data.simulation.tick();
      setRunning(false);
      render();
    }, { signal });
    el('d3-run').addEventListener('click', () => {
      if (running) { data.simulation.stop(); setRunning(false); }
      else restart(true);
    }, { signal });
    el('d3-reset').addEventListener('click', () => { settings = { ...DEFAULT_FORCES, link: mode === 'link' || mode === 'position', position: mode === 'position' }; selected = 'A'; replaceData(); select('A'); }, { signal });
    el('d3-fit').addEventListener('click', fit, { signal });
    observer = new ResizeObserver(fit);
    observer.observe(svg);
    visibility = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible && running) data.simulation.restart();
      else data.simulation.stop();
    }, { rootMargin: '100px' });
    visibility.observe(root);
    window.addEventListener('pagehide', event => { if (event.persisted) data.simulation.stop(); else dispose(); }, { signal });
    window.addEventListener('pageshow', event => { if (event.persisted && running && visible) data.simulation.restart(); }, { signal });
  } catch (error) {
    console.error(error);
    dispose();
    el<HTMLElement>('d3-error').hidden = false;
    el('d3-state').textContent = '読み込み失敗';
    root.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button').forEach(control => { control.disabled = true; });
  }
}

document.querySelectorAll<HTMLElement>('[data-d3-force-demo]').forEach(startDemo);
