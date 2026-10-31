import ForceGraph, { type NodeObject, type LinkObject } from "force-graph";
import { forceX, forceY, type ForceLink, type ForceManyBody } from "d3-force";
import {
  DEFAULT_SETTINGS,
  filterGraph,
  nodeColor,
  parseSettings,
} from "../lib/graph/model";
import type { GraphData, GraphNode, GraphSettings } from "../lib/graph/types";

type ViewNode = GraphNode & NodeObject;
type ViewLink = LinkObject<ViewNode> & {
  source: string | number | ViewNode;
  target: string | number | ViewNode;
  kind: string;
  label: string;
};
const STORAGE_KEY = "artgraph:settings:v1";
const VIEW_KEY = "artgraph:view:v2";
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const controller = new AbortController();
const { signal } = controller;
const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
const duration = reducedMotion ? 0 : 350;

async function start() {
  const container = el("graph-canvas");
  const textColor = getComputedStyle(document.documentElement).getPropertyValue("--text").trim();
  let settings = structuredClone(DEFAULT_SETTINGS);
  try {
    settings = parseSettings(
      JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"),
    );
  } catch {}
  const query = el<HTMLInputElement>("graph-search");
  const regionFilter = el<HTMLSelectElement>("region-filter");
  const periodFilter = el<HTMLSelectElement>("period-filter");
  const kindFilter = el<HTMLSelectElement>("kind-filter");
  const settingsPanel = el("settings-panel");
  const articlePanel = el("article-panel");
  const helpPanel = el("help-panel");
  const params = new URLSearchParams(location.search);
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const isReload = navigation?.type === "reload";
  let savedView: {
    query?: string;
    region?: string;
    period?: string;
    kind?: string;
    zoom?: number;
    center?: { x: number; y: number };
    positions?: Record<string, { x: number; y: number }>;
  } = {};
  try {
    savedView = JSON.parse(sessionStorage.getItem(VIEW_KEY) || "{}");
  } catch {}
  if (!savedView || typeof savedView !== "object") savedView = {};
  query.value = params.has("focus")
    ? ""
    : (params.get("q") ?? savedView.query ?? "");
  for (const [key, select] of [['region', regionFilter], ['period', periodFilter], ['kind', kindFilter]] as const) {
    select.value = params.has('focus') ? '' : params.get(key) ?? savedView[key] ?? '';
    if (!select.value) select.value = '';
  }

  function panel(
    name: "settings" | "articles" | "help",
    open: boolean,
    returnFocus = false,
  ) {
    const target =
      name === "settings"
        ? settingsPanel
        : name === "articles"
          ? articlePanel
          : helpPanel;
    const toggle = el(name === "articles" ? "list-toggle" : `${name}-toggle`);
    target.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (returnFocus) toggle.focus();
    if (open && window.innerWidth <= 600) {
      for (const other of ["settings", "articles", "help"] as const)
        if (other !== name) panel(other, false);
    }
  }
  panel("settings", window.innerWidth > 600);
  for (const [name, id] of [
    ["settings", "settings-toggle"],
    ["articles", "list-toggle"],
    ["help", "help-toggle"],
  ] as const) {
    el(id).addEventListener(
      "click",
      () => {
        const target =
          name === "settings"
            ? settingsPanel
            : name === "articles"
              ? articlePanel
              : helpPanel;
        panel(name, Boolean(target.hidden));
      },
      { signal },
    );
  }
  document
    .querySelectorAll<HTMLElement>("[data-close]")
    .forEach((button) =>
      button.addEventListener(
        "click",
        () =>
          panel(
            button.dataset.close as "settings" | "articles" | "help",
            false,
            true,
          ),
        { signal },
      ),
    );
  el("graph-tab").addEventListener("click", () => panel("articles", false), {
    signal,
  });
  document.addEventListener(
    "keydown",
    (event) => {
      const editing =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement;
      if (event.key === "/" && !editing) {
        event.preventDefault();
        query.focus();
      }
      if (event.key === "Escape") {
        const active = document.activeElement;
        for (const name of ["help", "articles", "settings"] as const) {
          const target =
            name === "settings"
              ? settingsPanel
              : name === "articles"
                ? articlePanel
                : helpPanel;
          if (!target.hidden) {
            panel(name, false, target.contains(active));
            break;
          }
        }
        if (active === query) query.blur();
      }
    },
    { signal },
  );

  const response = await fetch("/graph.json", { signal });
  if (!response.ok) throw new Error("Graph data could not be loaded");
  const data: GraphData = await response.json();
  let hover: ViewNode | null = null;
  let focusedId = params.get("focus") ? `artwork:${params.get("focus")}` : null;
  let neighbors = new Set<string>();
  let filtered: GraphData = data;
  let running = !reducedMotion;
  let pointerStart: { x: number; y: number } | null = null;
  let dragged = false;
  let disposed = false;
  const positions = new Map<string, { x: number; y: number }>();
  for (const [id, point] of Object.entries(savedView.positions ?? {}))
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y))
      positions.set(id, point);

  const graph = new ForceGraph<ViewNode, ViewLink>(container)
    .backgroundColor("rgba(0,0,0,0)")
    .width(container.clientWidth)
    .height(container.clientHeight)
    .nodeId("id")
    .nodeLabel(() => "")
    .minZoom(0.15)
    .maxZoom(6)
    .warmupTicks(reducedMotion ? 220 : 140)
    .cooldownTime(reducedMotion ? 0 : 3000)
    .d3VelocityDecay(0.45)
    .linkColor((link) => {
      const source =
        typeof link.source === "object" ? link.source.id : link.source;
      const target =
        typeof link.target === "object" ? link.target.id : link.target;
      return hover
        ? source === hover.id || target === hover.id
          ? "#b295df"
          : "#44414b44"
        : "#79717e66";
    })
    .linkDirectionalArrowRelPos(0.85)
    .linkLabel(link => {
      const span = document.createElement('span');
      span.textContent = link.label;
      return span;
    })
    .nodeCanvasObject((node, ctx, scale) => {
      const active = hover?.id === node.id || focusedId === node.id;
      const connected = neighbors.has(node.id);
      const radius = (active ? 5 : 3.3) * settings.nodeSize;
      const x = node.x ?? 0,
        y = node.y ?? 0;
      ctx.globalAlpha = hover && !active && !connected ? 0.27 : 1;
      if (active) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 5 / scale, 0, Math.PI * 2);
        ctx.strokeStyle = "#b79bdf66";
        ctx.lineWidth = 1 / scale;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = active ? "#d0b3ff" : nodeColor(node, settings);
      ctx.fill();
      const opacity =
        active || connected
          ? 1
          : Math.max(0, Math.min(1, (scale - settings.fade) / 0.65));
      if (opacity > 0) {
        ctx.globalAlpha *= opacity;
        const fontSize = 11 / Math.sqrt(Math.max(0.5, scale));
        ctx.font = `400 ${fontSize}px "Noto Sans JP", sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(node.title, x, y + radius + 6 / scale);
      }
      ctx.globalAlpha = 1;
    })
    .nodePointerAreaPaint((node, color, ctx, scale) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(
        node.x ?? 0,
        node.y ?? 0,
        Math.max(3.3 * settings.nodeSize, 10 / scale),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    })
    .onNodeHover((node) => {
      hover = node ?? null;
      neighbors = new Set<string>();
      if (hover)
        for (const link of filtered.links) {
          if (link.source === hover.id) neighbors.add(link.target);
          if (link.target === hover.id) neighbors.add(link.source);
        }
      const preview = el("node-preview");
      preview.hidden = !node;
      container.style.cursor = node ? "pointer" : "grab";
      if (node) {
        el<HTMLImageElement>("preview-image").src = node.image;
        el("preview-number").textContent =
          node.accessionNumber;
        el("preview-title").textContent = node.title;
        el("preview-types").textContent = node.subtitle;
      }
      redraw();
    })
    .onNodeClick((node) => {
      if (dragged) return;
      saveView();
      location.assign(node.href);
    })
    .onNodeDrag(() => {
      dragged = true;
      setRunning(true);
    })
    .onNodeDragEnd(() => {
      graph.cooldownTicks(0);
      setRunning(false);
    })
    .onZoom(({ k }) => {
      el("zoom-level").textContent = `${Math.round(k * 100)}%`;
    })
    .onZoomEnd(() => saveView())
    .onEngineStop(() => setRunning(false));

  function setRunning(value: boolean) {
    running = value;
    el("animate").querySelector("span")!.textContent = value
      ? "アニメーション停止"
      : "アニメーション開始";
    el("animate").setAttribute("aria-pressed", String(value));
  }

  function saveView() {
    if (disposed) return;
    const current = Object.fromEntries(
      graph
        .graphData()
        .nodes.filter(
          (node) => Number.isFinite(node.x) && Number.isFinite(node.y),
        )
        .map((node) => [node.id, { x: node.x, y: node.y }]),
    );
    try {
      sessionStorage.setItem(
        VIEW_KEY,
        JSON.stringify({
          query: query.value,
          region: regionFilter.value,
          period: periodFilter.value,
          kind: kindFilter.value,
          zoom: graph.zoom(),
          center: graph.centerAt(),
          positions: { ...Object.fromEntries(positions), ...current },
        }),
      );
    } catch {}
  }
  function saveSettings() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, settings }),
      );
    } catch {
      document.querySelector(".panel-footnote")!.textContent =
        "このブラウザでは設定を保存できません";
    }
  }
  function redraw() {
    graph.nodeColor((node) => nodeColor(node, settings));
  }
  function applyStyle() {
    graph
      .linkWidth(settings.linkWidth)
      .linkDirectionalArrowLength(settings.arrows ? 5 : 0);
    redraw();
  }
  function applyForces(reheat = true) {
    graph.d3Force("center", null);
    graph.d3Force("x", forceX<ViewNode>(0).strength(settings.center * 0.04));
    graph.d3Force("y", forceY<ViewNode>(0).strength(settings.center * 0.04));
    (graph.d3Force("charge") as ForceManyBody<ViewNode>).strength(
      -settings.repulsion * 2,
    );
    (graph.d3Force("link") as ForceLink<ViewNode, ViewLink>)
      .distance(settings.distance)
      .strength(settings.linkStrength * 0.3);
    if (reheat) {
      graph
        .cooldownTicks(reducedMotion ? 1 : Infinity)
        .cooldownTime(reducedMotion ? 0 : 3000)
        .d3ReheatSimulation();
      setRunning(!reducedMotion);
    }
  }

  function fit() {
    const nodes = graph.graphData().nodes;
    if (!nodes.length) return;
    const xs = nodes.map((node) => node.x ?? 0),
      ys = nodes.map((node) => node.y ?? 0);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const occupied =
      !settingsPanel.hidden && window.innerWidth > 600
        ? settingsPanel.offsetWidth + 45
        : 0;
    const availableWidth = Math.max(
      160,
      container.clientWidth - occupied - 110,
    );
    const availableHeight = Math.max(160, container.clientHeight - 230);
    const zoom = Math.max(
      0.15,
      Math.min(
        2.2,
        availableWidth / Math.max(160, maxX - minX),
        availableHeight / Math.max(160, maxY - minY),
      ),
    );
    graph
      .zoom(zoom, duration)
      .centerAt(
        (minX + maxX) / 2 + occupied / 2 / zoom,
        (minY + maxY) / 2 - 25 / zoom,
        duration,
      );
  }

  function updateData(autoFit = true) {
    for (const node of graph.graphData().nodes)
      if (Number.isFinite(node.x) && Number.isFinite(node.y))
        positions.set(node.id, { x: node.x!, y: node.y! });
    filtered = filterGraph(
      data,
      query.value,
      { region: regionFilter.value, period: periodFilter.value, kind: kindFilter.value },
      settings.showOrphans,
    );
    const nodes: ViewNode[] = filtered.nodes.map((node) => {
      const index = data.nodes.findIndex((item) => item.id === node.id);
      const angle = index * 2.399963;
      const radius = 38 * Math.sqrt(index + 1);
      return {
        ...node,
        ...(positions.get(node.id) ?? {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        }),
      };
    });
    graph.graphData({
      nodes,
      links: filtered.links.map((link) => ({ ...link })),
    });
    hover = null;
    neighbors.clear();
    el("node-preview").hidden = true;
    el("node-count").textContent = String(nodes.length);
    el("link-count").textContent = String(filtered.links.length);
    el("empty-state").hidden = nodes.length > 0;
    const ids = new Set(nodes.map((node) => node.id));
    document.querySelectorAll<HTMLElement>("[data-node-id]").forEach((link) => {
      link.hidden = !ids.has(link.dataset.nodeId!);
    });
    el("graph-canvas").setAttribute(
      "aria-label",
      `${nodes.length}作品と${filtered.links.length}本のつながり。作品一覧からも移動できます。`,
    );
    if (autoFit) {
      applyForces();
      requestAnimationFrame(fit);
    }
  }

  function syncControls() {
    document
      .querySelectorAll<HTMLInputElement>("[data-setting]")
      .forEach((input) => {
        const key = input.dataset.setting as keyof GraphSettings;
        if (input.type === "checkbox") input.checked = settings[key] as boolean;
        else {
          input.value = String(settings[key]);
          input.style.setProperty(
            "--range-progress",
            `${((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100}%`,
          );
          document.querySelector<HTMLOutputElement>(
            `[data-output="${key}"]`,
          )!.value = Number(input.value).toFixed(key === "distance" ? 0 : 2);
        }
      });
  }

  function renderGroups() {
    const list = el("color-groups");
    list.replaceChildren();
    settings.groups.forEach((group, index) => {
      const row = document.createElement("div");
      row.className = "color-group";
      const color = document.createElement("input");
      color.type = "color";
      color.value = group.color;
      color.setAttribute("aria-label", `グループ${index + 1}の色`);
      color.addEventListener(
        "input",
        () => {
          group.color = color.value;
          redraw();
          saveSettings();
        },
        { signal },
      );
      const text = document.createElement("input");
      text.type = "text";
      text.value = group.query;
      text.placeholder = "例：アジア、1800年代、彫刻";
      text.maxLength = 100;
      text.setAttribute("aria-label", `グループ${index + 1}の条件`);
      text.addEventListener(
        "input",
        () => {
          group.query = text.value;
          redraw();
          saveSettings();
        },
        { signal },
      );
      row.append(color, text);
      for (const [label, glyph, change, disabled] of [
        ["上へ移動", "↑", -1, index === 0],
        ["下へ移動", "↓", 1, index === settings.groups.length - 1],
        ["削除", "×", 0, false],
      ] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = glyph;
        button.setAttribute("aria-label", `グループ${index + 1}を${label}`);
        button.disabled = disabled;
        button.addEventListener(
          "click",
          () => {
            if (!change) settings.groups.splice(index, 1);
            else
              [settings.groups[index], settings.groups[index + change]] = [
                settings.groups[index + change]!,
                settings.groups[index]!,
              ];
            redraw();
            saveSettings();
            renderGroups();
          },
          { signal },
        );
        row.append(button);
      }
      list.append(row);
    });
    (el("add-group") as HTMLButtonElement).disabled =
      settings.groups.length >= 20;
  }

  el("add-group").addEventListener(
    "click",
    () => {
      settings.groups.push({
        id: crypto.randomUUID(),
        query: "",
        color: ["#a78bfa", "#86c8ac", "#e4ad7d", "#85b4e3"][
          settings.groups.length % 4
        ]!,
      });
      renderGroups();
      saveSettings();
      el("color-groups")
        .querySelector<HTMLInputElement>(
          ".color-group:last-child input[type=text]",
        )
        ?.focus();
    },
    { signal },
  );
  document
    .querySelectorAll<HTMLInputElement>("[data-setting]")
    .forEach((input) =>
      input.addEventListener(
        "input",
        () => {
          const key = input.dataset.setting!;
          Object.assign(settings, {
            [key]:
              input.type === "checkbox" ? input.checked : Number(input.value),
          });
          syncControls();
          applyStyle();
          if (key === "showOrphans") updateData();
          if (["center", "repulsion", "linkStrength", "distance"].includes(key))
            applyForces();
          saveSettings();
        },
        { signal },
      ),
    );
  el("reset-settings").addEventListener(
    "click",
    () => {
      settings = structuredClone(DEFAULT_SETTINGS);
      query.value = "";
      regionFilter.value = "";
      periodFilter.value = "";
      kindFilter.value = "";
      focusedId = null;
      syncControls();
      renderGroups();
      applyStyle();
      updateData();
      saveSettings();
      saveView();
    },
    { signal },
  );
  el("animate").addEventListener(
    "click",
    () => {
      if (running) {
        graph.cooldownTicks(0);
        setRunning(false);
      } else {
        graph.cooldownTicks(Infinity).cooldownTime(6000).d3ReheatSimulation();
        setRunning(true);
      }
    },
    { signal },
  );
  query.addEventListener(
    "input",
    () => {
      focusedId = null;
      updateData();
      saveView();
    },
    { signal },
  );
  for (const select of [regionFilter, periodFilter, kindFilter]) select.addEventListener(
    "change",
    () => {
      focusedId = null;
      updateData();
      saveView();
    },
    { signal },
  );
  el("clear-filters").addEventListener(
    "click",
    () => {
      query.value = "";
      regionFilter.value = "";
      periodFilter.value = "";
      kindFilter.value = "";
      settings.showOrphans = true;
      syncControls();
      updateData();
      saveSettings();
      saveView();
    },
    { signal },
  );
  el("zoom-in").addEventListener(
    "click",
    () => graph.zoom(Math.min(6, graph.zoom() * 1.3), duration),
    { signal },
  );
  el("zoom-out").addEventListener(
    "click",
    () => graph.zoom(Math.max(0.15, graph.zoom() / 1.3), duration),
    { signal },
  );
  el("zoom-fit").addEventListener("click", fit, { signal });
  container.addEventListener(
    "pointerdown",
    (event) => {
      pointerStart = { x: event.clientX, y: event.clientY };
      dragged = false;
    },
    { signal },
  );
  window.addEventListener(
    "pointermove",
    (event) => {
      if (
        pointerStart &&
        Math.hypot(
          event.clientX - pointerStart.x,
          event.clientY - pointerStart.y,
        ) > 5
      ) {
        dragged = true;
        container.classList.add("is-dragging");
      }
    },
    { signal },
  );
  window.addEventListener(
    "pointerup",
    () => {
      pointerStart = null;
      container.classList.remove("is-dragging");
    },
    { signal },
  );
  window.addEventListener(
    "pointercancel",
    () => {
      pointerStart = null;
      container.classList.remove("is-dragging");
    },
    { signal },
  );

  applyForces(false);
  applyStyle();
  syncControls();
  renderGroups();
  updateData(false);
  setRunning(!reducedMotion);
  el("graph-loading").hidden = true;
  const observer = new ResizeObserver(() =>
    graph.width(container.clientWidth).height(container.clientHeight),
  );
  observer.observe(container);
  requestAnimationFrame(() => {
    if (isReload) {
      fit();
      return;
    }
    const focus = graph.graphData().nodes.find((node) => node.id === focusedId);
    if (focus)
      graph.centerAt(focus.x ?? 0, focus.y ?? 0, duration).zoom(2.5, duration);
    else if (
      Number.isFinite(savedView.zoom) &&
      savedView.center &&
      Number.isFinite(savedView.center.x) &&
      Number.isFinite(savedView.center.y) &&
      !params.has("region") && !params.has("period") && !params.has("kind")
    )
      graph
        .zoom(Math.max(0.15, Math.min(6, savedView.zoom!)))
        .centerAt(savedView.center.x, savedView.center.y);
    else fit();
  });
  window.addEventListener(
    "pagehide",
    (event) => {
      saveView();
      if (event.persisted) {
        graph.pauseAnimation();
        return;
      }
      disposed = true;
      observer.disconnect();
      graph._destructor();
      controller.abort();
    },
    { signal },
  );
  window.addEventListener(
    "pageshow",
    (event) => {
      if (event.persisted) graph.resumeAnimation();
    },
    { signal },
  );
}

start().catch((error) => {
  console.error(error);
  const loading = el("graph-loading");
  loading.textContent =
    "グラフを読み込めませんでした。再読み込みするか、記事一覧をご利用ください。";
  loading.hidden = false;
  el("article-panel").hidden = false;
  el("list-toggle").setAttribute("aria-expanded", "true");
});
