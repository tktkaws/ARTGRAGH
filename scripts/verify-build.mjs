import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const artworks = JSON.parse(await readFile(new URL('src/data/artworks.json', root), 'utf8'));
const translations = JSON.parse(await readFile(new URL('src/data/artwork-translations.ja.json', root), 'utf8'));
const graph = JSON.parse(await readFile(new URL('dist/graph.json', root), 'utf8'));
assert.equal(graph.nodes.length, artworks.length);
assert(graph.nodes.length >= 100 && graph.nodes.length <= 150);
const ids = new Set(graph.nodes.map(node => node.id));
for (const node of graph.nodes) {
  const html = await readFile(new URL(`dist${node.href}index.html`, root), 'utf8');
  assert(html.includes('CC0 1.0'), `Missing rights information: ${node.href}`);
  assert(html.includes('clevelandart.org'), `Missing source: ${node.href}`);
  assert(html.includes('美術館の原文を読む（英語）') && html.includes('<div lang="en">'), `Missing original text: ${node.href}`);
  assert(html.includes('class="artwork-description" lang="ja"'), `Missing Japanese description: ${node.href}`);
  assert(html.includes('日本語は当サイトによる参考訳です（一部要約）。'), `Missing translation attribution: ${node.href}`);
  assert.equal(node.title, translations[node.number]?.title, `Graph title is not translated: ${node.href}`);
  assert(!/PokéAPI|Pokégraph|pokemon-placeholder/.test(html), `Stale content: ${node.href}`);
}
for (const link of graph.links) assert(ids.has(link.source) && ids.has(link.target));
await assert.rejects(access(new URL('dist/pokemon/1/index.html', root)));
console.log(`Verified ${graph.nodes.length} artwork pages and ${graph.links.length} links; no legacy Pokémon route.`);
