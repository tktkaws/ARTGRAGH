import ForceGraph from 'force-graph';
import { forceX, forceY } from 'd3-force';
import { DEMO_NODES, DEMO_LINKS, type DemoNode, type DemoLink } from '../lib/learn/force-graph-demo';

function startDemo(root: HTMLElement) {
  const controller = new AbortController();
  const { signal } = controller;
  const el = <T extends HTMLElement = HTMLElement>(id: string) => {
    const node = root.querySelector<T>(`#${root.dataset.instance}-${id}`);
    if (!node) throw new Error(`Missing demo element: ${id}`);
    return node;
  };
  const input = (id: string) => el<HTMLInputElement>(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
  const duration = reduced ? 0 : 250;
  const container = el('fg-canvas');
  const positions = new Map<string, { x: number; y: number }>();
  let graph: ForceGraph<DemoNode, DemoLink> | undefined;
  let observer: ResizeObserver | undefined;
  let visibility: IntersectionObserver | undefined;
  let visible = false;
  let selected = 'A';
  let hover: string | null = null;
  let visibleIds = new Set<string>();
  let links: { source: string; target: string }[] = [];
  let pointer: { x: number; y: number } | null = null;
  let dragged = false;
  let disposed = false;
  let fitPending = true;

  const endpoint = (value: DemoLink['source']) => typeof value === 'object' ? value.id : String(value);
  const neighbors = (id: string) => new Set(links.flatMap(link => link.source === id ? [link.target] : link.target === id ? [link.source] : []));
  function redraw() { graph?.nodeColor(() => '#bcb9c5'); }
  function fit() { if (!disposed && visibleIds.size) graph?.zoomToFit(duration, 56); }
  function selection(id: string) {
    selected = id;
    root!.querySelectorAll<HTMLButtonElement>('[data-fg-node]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.fgNode === id));
      button.disabled = !visibleIds.has(button.dataset.fgNode!);
    });
    el('fg-selection').textContent = visibleIds.has(id)
      ? `${id}：接続先 ${[...neighbors(id)].join('・') || 'なし'}` : '表示中のノードなし';
    redraw();
  }
  function update() {
    if (!graph) return;
    for (const node of graph.graphData().nodes) {
      if (Number.isFinite(node.x) && Number.isFinite(node.y)) positions.set(node.id, { x: node.x!, y: node.y! });
    }
    const query = input('fg-search').value.trim().normalize('NFKC').toLowerCase();
    const group = el<HTMLSelectElement>('fg-group').value;
    let nodes = DEMO_NODES.filter(node => node.id.toLowerCase().includes(query) && (!group || node.group === group));
    const ids = new Set<string>(nodes.map(node => node.id));
    links = DEMO_LINKS.filter(link => ids.has(link.source) && ids.has(link.target)).map(link => ({ ...link }));
    if (!input('fg-orphans').checked) {
      const connected = new Set(links.flatMap(link => [link.source, link.target]));
      nodes = nodes.filter(node => connected.has(node.id));
    }
    visibleIds = new Set(nodes.map(node => node.id));
    hover = null;
    fitPending = true;
    graph.warmupTicks(reduced ? 160 : 30).cooldownTime(reduced ? 0 : 1800)
      .cooldownTicks(reduced ? 0 : Infinity).graphData({
        nodes: nodes.map(node => ({ ...node, ...(positions.get(node.id) ?? {}) })),
        links: links.map(link => ({ ...link })),
      });
    el('fg-count').textContent = `${nodes.length} ノード / ${links.length} リンク`;
    container.setAttribute('aria-label', `${nodes.length}ノードと${links.length}リンク。ボタンでも選択できます。`);
    el('fg-empty').hidden = nodes.length > 0;
    el('fg-data').textContent = JSON.stringify({ nodes: nodes.map(({ id, group }) => ({ id, group })), links }, null, 2);
    selection(visibleIds.has(selected) ? selected : nodes[0]?.id ?? '');
    requestAnimationFrame(fit);
  }
  function style() {
    if (!graph) return;
    graph.linkVisibility(() => input('fg-links').checked)
      .linkWidth(Number(input('fg-linkWidth').value))
      .linkDirectionalArrowLength(input('fg-arrows').checked ? 6 : 0)
      .enableNodeDrag(input('fg-drag').checked);
    root!.querySelectorAll<HTMLInputElement>('[data-fg-style]').forEach(control => {
      el<HTMLOutputElement>(`fg-output-${control.dataset.fgStyle}`).value = control.value;
    });
    redraw();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    visibility?.disconnect();
    graph?._destructor();
    controller.abort();
  }

  try {
    graph = new ForceGraph<DemoNode, DemoLink>(container)
      .width(container.clientWidth).height(container.clientHeight)
      .backgroundColor('rgba(0,0,0,0)').minZoom(0.3).maxZoom(5).nodeId('id').nodeLabel('id')
      .linkColor(link => input('fg-highlight').checked && (endpoint(link.source) === (hover ?? selected) || endpoint(link.target) === (hover ?? selected)) ? '#b295df' : '#79717e66')
      .nodeCanvasObject((node, ctx, scale) => {
        const active = node.id === (hover ?? selected);
        const connected = input('fg-highlight').checked && neighbors(hover ?? selected).has(node.id);
        const radius = (active ? 9 : 6) * Number(input('fg-nodeSize').value);
        const x = node.x ?? 0, y = node.y ?? 0;
        ctx.save();
        if (hover && input('fg-highlight').checked && !active && !connected) ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = active ? '#d0b3ff' : input('fg-colors').checked ? node.group === 'left' ? '#a78bfa' : '#86c8ac' : '#bcb9c5';
        ctx.fill();
        const opacity = active || connected ? 1 : Math.max(0, Math.min(1, (scale - Number(input('fg-fade').value)) / 0.6));
        if (opacity > 0) {
          ctx.globalAlpha *= opacity;
          ctx.font = `500 ${12 / scale}px sans-serif`;
          ctx.fillStyle = textColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(node.id, x, y + radius + 7 / scale);
        }
        ctx.restore();
      })
      .nodePointerAreaPaint((node, color, ctx, scale) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(node.x ?? 0, node.y ?? 0, Math.max(9 * Number(input('fg-nodeSize').value), 22 / scale), 0, Math.PI * 2);
        ctx.fill();
      })
      .onNodeHover(node => { hover = node?.id ?? null; container.style.cursor = node ? 'pointer' : 'grab'; redraw(); })
      .onNodeClick(node => { if (!dragged) selection(node.id); })
      .onNodeDrag(() => { dragged = true; })
      .onNodeDragEnd(() => { if (reduced) graph!.cooldownTicks(0); })
      .onZoom(({ k }) => { el('fg-zoom').textContent = `${Math.round(k * 100)}%`; })
      .onEngineStop(() => { if (fitPending) { fitPending = false; fit(); } });
    graph.d3Force('center', null);
    graph.d3Force('x', forceX<DemoNode>(0).strength(0.05));
    graph.d3Force('y', forceY<DemoNode>(0).strength(0.05));
    graph.d3Force('charge')!.strength(-100);
    graph.d3Force('link')!.distance(90).strength(0.4);
    root.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('button, input, select').forEach(control => { control.disabled = false; });
    style();
    update();

    root.querySelectorAll<HTMLButtonElement>('[data-fg-node]').forEach(button => button.addEventListener('click', () => selection(button.dataset.fgNode!), { signal }));
    root.querySelectorAll<HTMLInputElement>('[data-fg-style], [data-fg-toggle]').forEach(control => control.addEventListener('input', style, { signal }));
    input('fg-search').addEventListener('input', update, { signal });
    el('fg-group').addEventListener('change', update, { signal });
    input('fg-orphans').addEventListener('change', update, { signal });
    el('fg-clear').addEventListener('click', () => { input('fg-search').value = ''; el<HTMLSelectElement>('fg-group').value = ''; input('fg-orphans').checked = true; update(); }, { signal });
    el('fg-reset').addEventListener('click', () => {
      root.querySelectorAll<HTMLInputElement>('input').forEach(control => {
        if (control.type === 'checkbox') control.checked = control.defaultChecked;
        else control.value = control.defaultValue;
      });
      el<HTMLSelectElement>('fg-group').value = '';
      selected = 'A';
      positions.clear();
      graph!.graphData({ nodes: [], links: [] });
      style();
      update();
    }, { signal });
    el('fg-fit').addEventListener('click', fit, { signal });
    el('fg-zoom-in').addEventListener('click', () => graph!.zoom(Math.min(5, graph!.zoom() * 1.3), duration), { signal });
    el('fg-zoom-out').addEventListener('click', () => graph!.zoom(Math.max(0.3, graph!.zoom() / 1.3), duration), { signal });
    container.addEventListener('pointerdown', event => { pointer = { x: event.clientX, y: event.clientY }; dragged = false; }, { signal });
    window.addEventListener('pointermove', event => { if (pointer && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 5) dragged = true; }, { signal });
    for (const event of ['pointerup', 'pointercancel']) window.addEventListener(event, () => { pointer = null; }, { signal });
    observer = new ResizeObserver(() => { graph!.width(container.clientWidth).height(container.clientHeight); fit(); });
    observer.observe(container);
    graph.pauseAnimation();
    visibility = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible) graph!.resumeAnimation();
      else graph!.pauseAnimation();
    }, { rootMargin: '100px' });
    visibility.observe(root);
    window.addEventListener('pagehide', event => { if (event.persisted) graph!.pauseAnimation(); else dispose(); }, { signal });
    window.addEventListener('pageshow', event => { if (event.persisted && visible) graph!.resumeAnimation(); }, { signal });
  } catch (error) {
    console.error(error);
    dispose();
    el('fg-error').hidden = false;
    root.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('button, input, select').forEach(control => { control.disabled = true; });
  }
}

document.querySelectorAll<HTMLElement>('[data-force-graph-demo]').forEach(startDemo);
