import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_SETTINGS, filterGraph, matchesNode, nodeColor, parseSettings, validateGraph } from "../src/lib/graph/model.ts";
import { REGION_TARGETS, KIND_LABELS, classifyRegion, classifyKind, classifyPeriod } from '../src/lib/graph/classification.ts';
import { artworkTitle, createArtworkGraph } from "../src/lib/graph/artworks.ts";
import { getArtworkTranslation, localizedCreatorLabel, localizedDate, localizedCulture, localizedDepartment, localizedMeasurements } from '../src/lib/graph/localization.ts';
import type { Artwork, GraphData, GraphNode } from "../src/lib/graph/types.ts";

const snapshot: Artwork[] = JSON.parse(readFileSync(new URL("../src/data/artworks.json", import.meta.url), "utf8"));
const node = (number: number, title: string, tags: string[]): GraphNode => ({
  id: `artwork:${number}`, title, tags, number, subtitle: '作者 · 1800', accessionNumber: `2026.${number}`,
  region: number === 25 ? 'West' : 'Japan', kind: number === 25 ? 'Sculpture' : 'Painting', period: '1800-1899',
  searchTerms: ['Hokusai', '北斎'], href: `/artworks/${number}/`, image: '', summary: '',
});
const graph: GraphData = {
  nodes: [node(1, '富士', ['Painting', 'Japan', '1800-1899']), node(2, '山水', ['Painting', 'Japan', '1800-1899']), node(25, 'Landscape', ['Sculpture', 'West', '1800-1899'])],
  links: [{ source: 'artwork:1', target: 'artwork:2', kind: 'artist', label: '同じ作者' }],
};

test('filtering removes dangling edges and computes orphans within the result', () => {
  assert.equal(filterGraph(graph, '富士', {}, true).links.length, 0);
  assert.equal(filterGraph(graph, '', { kind: 'Sculpture' }, true).nodes.length, 1);
  assert.equal(filterGraph(graph, '', { kind: 'Sculpture' }, false).nodes.length, 0);
  assert.equal(filterGraph(graph, '', { region: 'Japan' }, false).nodes.length, 2);
  assert.equal(filterGraph(graph, 'no match', {}, true).nodes.length, 0);
});
test('search covers Japanese type and region labels, creators, accession numbers and full-width input', () => {
  assert(matchesNode(graph.nodes[0]!, '絵画'));
  assert(matchesNode(graph.nodes[0]!, '日本'));
  assert(matchesNode(graph.nodes[0]!, '北斎'));
  assert(matchesNode(graph.nodes[0]!, 'HOKUSAI'));
  assert(matchesNode(graph.nodes[2]!, '２５'));
  assert(matchesNode(graph.nodes[2]!, '2026.25'));
});
test('groups use the first matching nonempty condition', () => {
  const settings = { ...DEFAULT_SETTINGS, groups: [
    { id: 'empty', query: '', color: '#ffffff' },
    { id: 'first', query: '日本', color: '#112233' },
    { id: 'second', query: '絵画', color: '#445566' },
  ] };
  assert.equal(nodeColor(graph.nodes[0]!, settings), '#112233');
  assert.equal(nodeColor(graph.nodes[2]!, settings), '#bcb9c5');
});
test('corrupt settings fall back and numeric settings are clamped', () => {
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings({ version: 2 }), DEFAULT_SETTINGS);
  const parsed = parseSettings({ version: 1, settings: { nodeSize: -5, center: NaN, arrows: 'true', groups: [null, { id: 'a', query: 'Japan', color: 'invalid' }] } });
  assert.equal(parsed.nodeSize, 0.3);
  assert.equal(parsed.center, DEFAULT_SETTINGS.center);
  assert.equal(parsed.arrows, false);
  assert.deepEqual(parsed.groups, []);
});
test('duplicate IDs, invalid URLs, self links, duplicate links and unknown endpoints are rejected', () => {
  assert.throws(() => validateGraph({ nodes: [graph.nodes[0]!, graph.nodes[0]!], links: [] }));
  assert.throws(() => validateGraph({ nodes: [{ ...graph.nodes[0]!, href: '/external/' }], links: [] }));
  assert.throws(() => validateGraph({ nodes: graph.nodes, links: [{ ...graph.links[0]!, target: 'artwork:999' }] }));
  assert.throws(() => validateGraph({ nodes: graph.nodes, links: [{ ...graph.links[0]!, target: 'artwork:1' }] }));
  assert.throws(() => validateGraph({ nodes: graph.nodes, links: [graph.links[0]!, graph.links[0]!] }));
});
test('snapshot has 150 unique CC0 artworks, with 50 Japanese works first', () => {
  assert.equal(snapshot.length, 150);
  assert.equal(new Set(snapshot.map(work => work.id)).size, 150);
  assert.equal(snapshot.filter(work => work.japanese).length, 50);
  assert(snapshot.slice(0, 50).every(work => work.japanese));
  assert.equal(snapshot.slice(50).length, 100);
  assert(snapshot.slice(50).every(work => !work.japanese));
  for (const [region, count] of Object.entries(REGION_TARGETS)) {
    assert.equal(snapshot.filter(work => work.region === region).length, count);
  }
  for (const work of snapshot) assert.equal(classifyRegion({ culture: work.cultures, department: work.department }), work.region);
  for (const work of snapshot) {
    assert.equal(work.license, 'CC0');
    assert(work.title && work.accessionNumber && work.sourceUrl && work.apiUrl);
    assert(work.image.startsWith('https://openaccess-cdn.clevelandart.org/'));
    assert(work.imageWidth > 0 && work.imageHeight > 0);
  }
});
test('Japanese original titles take priority when supplied', () => {
  const work = { ...snapshot[0]!, japanese: true, title: 'Landscape', originalTitle: '山水図' };
  assert.equal(artworkTitle(work), '山水図');
  assert.equal(artworkTitle({ ...work, originalTitle: '' }), 'Landscape');
});
test('museum-related works take priority over series and artist links', () => {
  const base = snapshot[0]!;
  const works = [
    { ...base, id: 1, series: 'Series A', relatedIds: [2] },
    { ...base, id: 2, series: 'Series A', relatedIds: [] },
    { ...base, id: 3, series: 'Series A', relatedIds: [] },
  ];
  const links = createArtworkGraph(works).links;
  assert.equal(links.find(link => link.source === 'artwork:1' && link.target === 'artwork:2')?.kind, 'related');
  assert.equal(links.find(link => link.source === 'artwork:1' && link.target === 'artwork:3')?.kind, 'series');
});
test('generated graph is deterministic, bounded, valid and searchable as Japanese works', () => {
  const result = createArtworkGraph(snapshot);
  assert.deepEqual(result, createArtworkGraph(snapshot));
  validateGraph(result);
  assert.equal(result.nodes.length, 150);
  assert(result.links.length > 0 && result.links.length <= 225);
  const degree = new Map<string, number>();
  for (const link of result.links) for (const id of [link.source, link.target]) degree.set(id, (degree.get(id) ?? 0) + 1);
  assert([...degree.values()].every(value => value <= 3));
  const japanese = filterGraph(result, '', { region: 'Japan' }, true);
  assert.equal(japanese.nodes.length, 50);
  const ids = new Set(japanese.nodes.map(item => item.id));
  assert(japanese.links.every(link => ids.has(link.source) && ids.has(link.target)));
});
test('non-CC0 artworks and images from unexpected hosts are rejected', () => {
  assert.throws(() => createArtworkGraph([{ ...snapshot[0]!, license: 'Copyrighted' }]));
  assert.throws(() => createArtworkGraph([{ ...snapshot[0]!, image: 'https://example.com/image.jpg' }]));
});

test('regional classification separates Japan, Asia, the Middle East, Africa and South America', () => {
  assert.equal(classifyRegion({ culture: ['Japan, Edo period'] }), 'Japan');
  assert.equal(classifyRegion({ culture: ['China, Ming dynasty'] }), 'Asia');
  assert.equal(classifyRegion({ culture: ['India, Mughal'], department: 'Islamic Art' }), 'Asia');
  assert.equal(classifyRegion({ culture: ['Iran, Safavid period'] }), 'MiddleEast');
  assert.equal(classifyRegion({ culture: ['Egypt, Roman period'] }), 'Africa');
  assert.equal(classifyRegion({ culture: ['Peru, Inca'] }), 'SouthAmerica');
  assert.equal(classifyRegion({ culture: ['Mexico, Aztec'] }), null);
  assert.equal(classifyRegion({ culture: ['France'] }), 'West');
  assert.equal(classifyRegion({ culture: ['America'] }), 'West');
});
test('only three kinds are exposed and period boundaries include BCE and missing dates', () => {
  assert.deepEqual(Object.keys(KIND_LABELS), ['Painting', 'Sculpture', 'Other']);
  assert.equal(classifyKind('Painting'), 'Painting');
  assert.equal(classifyKind('Sculpture'), 'Sculpture');
  assert.equal(classifyKind('Print'), 'Other');
  assert.equal(classifyKind('Textile'), 'Other');
  assert.equal(classifyPeriod(-500), 'before-1000');
  assert.equal(classifyPeriod(999), 'before-1000');
  assert.equal(classifyPeriod(1000), '1000-1599');
  assert.equal(classifyPeriod(1600), '1600-1699');
  assert.equal(classifyPeriod(1700), '1700-1799');
  assert.equal(classifyPeriod(1800), '1800-1899');
  assert.equal(classifyPeriod(1900), '1900-plus');
  assert.equal(classifyPeriod(null), 'unknown');
  assert.equal(classifyPeriod(NaN), 'unknown');
});
test('region, period and kind filters combine with AND and leave no dangling edges', () => {
  assert.equal(filterGraph(graph, '', { region: 'Japan', period: '1800-1899', kind: 'Painting' }, true).nodes.length, 2);
  assert.equal(filterGraph(graph, '', { region: 'Japan', kind: 'Sculpture' }, true).nodes.length, 0);
  assert.equal(filterGraph(graph, '', { period: '1900-plus' }, true).nodes.length, 0);
  const actual = createArtworkGraph(snapshot);
  for (const [region, count] of Object.entries(REGION_TARGETS)) {
    const filtered = filterGraph(actual, '', { region }, true);
    assert.equal(filtered.nodes.length, count);
    const ids = new Set(filtered.nodes.map(node => node.id));
    assert(filtered.links.every(link => ids.has(link.source) && ids.has(link.target)));
  }
});

test('every current artwork has a matching Japanese translation and bilingual search', () => {
  const nodes = createArtworkGraph(snapshot).nodes;
  for (const work of snapshot) {
    const translation = getArtworkTranslation(work);
    assert(translation, `Missing or stale translation: ${work.id}`);
    for (const field of ['title', 'description', 'didYouKnow', 'technique'] as const) {
      assert.match(translation[field], /[ぁ-んァ-ン一-龯]/, `${work.id}: ${field}`);
    }
    assert.equal(artworkTitle(work), translation.title);
    const node = nodes.find(item => item.number === work.id)!;
    assert(matchesNode(node, work.title), `Original title is no longer searchable: ${work.id}`);
    assert(matchesNode(node, translation.title));
  }
});

test('source edits invalidate translations rather than showing stale Japanese text', () => {
  const work = snapshot[0]!;
  for (const field of ['title', 'originalTitle', 'description', 'didYouKnow', 'technique'] as const) {
    assert.equal(getArtworkTranslation({ ...work, [field]: `${work[field]} changed` }), null);
  }
  assert(getArtworkTranslation({ ...work, imageWidth: work.imageWidth + 1 }));
});

test('Japanese metadata preserves date ranges, BCE and metric measurements', () => {
  assert.equal(localizedDate('c. 1830'), '約1830年');
  assert.equal(localizedDate('1314–17'), '1314〜1317年');
  assert.equal(localizedDate('710–94'), '710〜794年');
  assert.equal(localizedDate('late 1800s–early 1900s'), '1800年代後半〜1900年代初頭');
  assert.equal(localizedDate('200 BCE–200 CE'), '紀元前200年〜西暦200年');
  assert.equal(localizedDate('1–800 CE'), '西暦1〜800年');
  assert.equal(localizedDate(''), '年代不明');
  assert.equal(localizedCulture('Japan, Edo period'), '日本、江戸時代');
  assert.equal(localizedDepartment('Japanese Art'), '日本美術');
  assert.equal(localizedMeasurements('Overall: 10.5 x 20 cm (4 1/8 x 7 7/8 in.); Diameter of rim: 0.9 cm'), '全体：10.5 × 20 cm／口縁の直径：0.9 cm');
  assert.equal(localizedCreatorLabel({ ...snapshot[0]!, creators: [] }), '作者不詳');
  assert.equal(localizedCreatorLabel({ ...snapshot[0]!, creators: [{ id: 'unknown', name: 'Unlisted Artist', originalName: '' }] }), 'Unlisted Artist');
});
