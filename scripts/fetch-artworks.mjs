import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { REGION_LABELS, REGION_TARGETS, classifyRegion } from '../src/lib/graph/classification.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = join(root, '.cache/cleveland');
const refresh = process.argv.includes('--refresh');
const TOTAL_COUNT = Object.values(REGION_TARGETS).reduce((sum, count) => sum + count, 0);
const fields = ['id', 'accession_number', 'title', 'title_in_original_language', 'creation_date', 'creation_date_earliest', 'creation_date_latest', 'creators', 'culture', 'department', 'technique', 'type', 'series', 'related_works', 'description', 'did_you_know', 'url', 'images', 'share_license_status', 'measurements'];
await mkdir(cache, { recursive: true });
await mkdir(join(root, 'src/data'), { recursive: true });

async function request(parameters) {
  const url = new URL('https://openaccess-api.clevelandart.org/api/artworks/');
  url.search = new URLSearchParams({ cc0: '', has_image: '1', fields: fields.join(','), ...parameters }).toString();
  const path = join(cache, `${createHash('sha256').update(url.href).digest('hex').slice(0, 16)}.json`);
  if (!refresh) {
    try { const cached = JSON.parse(await readFile(path, 'utf8')); if (Array.isArray(cached.data)) return cached.data; } catch {}
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`CMA API returned ${response.status}`);
      const result = await response.json();
      if (!Array.isArray(result.data)) throw new Error('Unexpected CMA API response');
      await writeFile(path, JSON.stringify(result));
      return result.data;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
}

function text(value) {
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
const eligible = work => work.share_license_status === 'CC0' && Number.isInteger(work.id) && text(work.title) && /^https:\/\/openaccess-cdn\.clevelandart\.org\//.test(work.images?.web?.url ?? '');
const quality = work => (work.description ? 5 : 0) + (work.did_you_know ? 2 : 0) + (work.title_in_original_language ? 2 : 0) + (work.related_works?.length ? 2 : 0);
function selectDiverse(pool, count) {
  const sorted = [...pool].sort((a, b) => quality(b) - quality(a) || a.id - b.id);
  const selected = new Map();
  const creatorCounts = new Map();
  for (const cap of [3, 6, Infinity]) {
    for (const work of sorted) {
      if (selected.size >= count) return [...selected.values()];
      if (selected.has(work.id)) continue;
      const creator = work.creators?.[0]?.description ?? `anonymous:${work.type}`;
      if ((creatorCounts.get(creator) ?? 0) >= cap) continue;
      selected.set(work.id, work);
      creatorCounts.set(creator, (creatorCounts.get(creator) ?? 0) + 1);
    }
  }
  return [...selected.values()];
}

const regionRequests = {
  Japan: [{ culture: 'Japan', limit: '500' }],
  Asia: [{ culture: 'China', limit: '150' }, { culture: 'Korea', limit: '100' }, { culture: 'India', limit: '100' }],
  West: [{ department: 'European Painting and Sculpture', limit: '150' }, { department: 'American Painting and Sculpture', limit: '100' }],
  MiddleEast: [{ culture: 'Iran', limit: '150' }, { culture: 'Turkey', limit: '100' }],
  Africa: [{ department: 'African Art', limit: '200' }],
  SouthAmerica: [{ culture: 'Peru', limit: '150' }, { culture: 'Colombia', limit: '100' }],
};
const selected = [];
const selectedIds = new Set();
for (const [region, count] of Object.entries(REGION_TARGETS)) {
  const candidates = new Map();
  for (const parameters of regionRequests[region]) {
    for (const work of await request(parameters)) {
      if (eligible(work) && classifyRegion(work) === region && !selectedIds.has(work.id)) candidates.set(work.id, work);
    }
  }
  const works = selectDiverse([...candidates.values()], count);
  if (works.length !== count) throw new Error(`${REGION_LABELS[region]}: wanted ${count} artworks, found ${works.length}; previous snapshot preserved.`);
  for (const work of works) { selected.push(work); selectedIds.add(work.id); }
  console.log(`${REGION_LABELS[region]}: ${works.length} selected from ${candidates.size} CC0 image records`);
}
if (selected.length !== TOTAL_COUNT) throw new Error('Incomplete regional collection; previous snapshot preserved.');

const artworks = selected.map(work => ({
  id: work.id,
  accessionNumber: text(work.accession_number),
  title: text(work.title),
  originalTitle: text(work.title_in_original_language),
  date: text(work.creation_date),
  yearStart: Number.isFinite(work.creation_date_earliest) ? work.creation_date_earliest : null,
  yearEnd: Number.isFinite(work.creation_date_latest) ? work.creation_date_latest : null,
  creators: (work.creators ?? []).map(creator => ({
    id: String(creator.id ?? text(creator.description)),
    name: text(creator.description),
    originalName: text(creator.name_in_original_language),
  })),
  cultures: (work.culture ?? []).map(text),
  japanese: classifyRegion(work) === 'Japan',
  region: classifyRegion(work),
  type: text(work.type) || 'Other',
  technique: text(work.technique),
  department: text(work.department),
  series: text(work.series),
  description: text(work.description),
  didYouKnow: text(work.did_you_know),
  measurements: text(work.measurements),
  image: work.images.web.url,
  imageWidth: Number(work.images.web.width) || 900,
  imageHeight: Number(work.images.web.height) || 900,
  sourceUrl: work.url,
  apiUrl: `https://openaccess-api.clevelandart.org/api/artworks/${work.id}`,
  license: 'CC0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  relatedIds: (work.related_works ?? []).map(related => Number(related.id ?? related.artwork_id)).filter(id => Number.isInteger(id) && id > 0),
}));
const destination = join(root, 'src/data/artworks.json');
await writeFile(`${destination}.tmp`, JSON.stringify(artworks, null, 2) + '\n');
await rename(`${destination}.tmp`, destination);
console.log(`Saved ${artworks.length} artworks across ${Object.keys(REGION_TARGETS).length} regions. All images CC0.`);
