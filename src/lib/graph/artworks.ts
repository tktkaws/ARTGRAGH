import type { Artwork, GraphData, GraphLink } from './types.ts';
import { validateGraph } from './model.ts';
import { REGION_LABELS, KIND_LABELS, classifyKind, classifyPeriod } from './classification.ts';
import { getArtworkTranslation, localizedCreatorLabel, localizedDate } from './localization.ts';

export const artworkTitle = (artwork: Artwork) => getArtworkTranslation(artwork)?.title || (artwork.japanese && /[\u3040-\u30ff\u3400-\u9fff]/.test(artwork.originalTitle) ? artwork.originalTitle : artwork.title);
export const creatorLabel = localizedCreatorLabel;

export function createArtworkGraph(artworks: Artwork[]): GraphData {
  for (const artwork of artworks) {
    if (artwork.license !== 'CC0' || !artwork.image.startsWith('https://openaccess-cdn.clevelandart.org/')) throw new Error(`Artwork ${artwork.id} is missing a CC0 image`);
  }
  const nodes = artworks.map(artwork => ({
    id: `artwork:${artwork.id}`, number: artwork.id, accessionNumber: artwork.accessionNumber,
    title: artworkTitle(artwork), subtitle: `${creatorLabel(artwork)} · ${localizedDate(artwork.date)}`,
    href: `/artworks/${artwork.id}/`, image: artwork.image,
    summary: getArtworkTranslation(artwork)?.description || artwork.description || artwork.didYouKnow || `${artwork.title} — ${artwork.date}, ${artwork.technique}`,
    region: artwork.region, kind: classifyKind(artwork.type), period: classifyPeriod(artwork.yearStart),
    tags: [classifyKind(artwork.type), artwork.region, classifyPeriod(artwork.yearStart)],
    searchTerms: [artwork.title, artwork.originalTitle, artwork.series, artwork.technique, artwork.type, ...artwork.cultures, ...artwork.creators.flatMap(creator => [creator.name, creator.originalName])],
  }));
  // Relationships from the museum take priority; other links describe shared metadata.
  const candidates: { source: Artwork; target: Artwork; kind: GraphLink['kind']; label: string; priority: number; distance: number }[] = [];
  for (let i = 0; i < artworks.length; i++) {
    const a = artworks[i]!;
    for (const b of artworks.slice(i + 1)) {
      const distance = a.yearStart !== null && b.yearStart !== null ? Math.abs(a.yearStart - b.yearStart) : 10000;
      if (a.relatedIds.includes(b.id) || b.relatedIds.includes(a.id)) candidates.push({ source: a, target: b, kind: 'related', label: '美術館が示す関連作品', priority: 4, distance });
      else if (a.series && a.series === b.series) candidates.push({ source: a, target: b, kind: 'series', label: `同じシリーズ：${a.series}`, priority: 3, distance });
      else if (a.creators.some(creator => b.creators.some(other => creator.id === other.id))) candidates.push({ source: a, target: b, kind: 'artist', label: '同じ作者', priority: 2, distance });
      else if (a.type === b.type && a.region === b.region) candidates.push({ source: a, target: b, kind: 'category', label: `同じ地域・種類：${REGION_LABELS[a.region]}・${KIND_LABELS[classifyKind(a.type)]}`, priority: 1, distance });
    }
  }
  candidates.sort((a, b) => b.priority - a.priority || a.distance - b.distance || a.source.id - b.source.id || a.target.id - b.target.id);
  const degrees = new Map<number, number>();
  const links: GraphLink[] = [];
  for (const candidate of candidates) {
    const { source, target, kind, label } = candidate;
    if ((degrees.get(source.id) ?? 0) >= 3 || (degrees.get(target.id) ?? 0) >= 3) continue;
    degrees.set(source.id, (degrees.get(source.id) ?? 0) + 1);
    degrees.set(target.id, (degrees.get(target.id) ?? 0) + 1);
    links.push({ source: `artwork:${source.id}`, target: `artwork:${target.id}`, kind, label });
  }
  const graph = { nodes, links };
  validateGraph(graph);
  return graph;
}
