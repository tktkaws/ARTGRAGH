import snapshot from "../../data/artworks.json";
import { createArtworkGraph } from "./artworks";
import { isRegion, REGION_LABELS } from './classification';
import type { Artwork, GraphData } from "./types";

export const artworks: Artwork[] = snapshot.map(work => {
  if (!isRegion(work.region)) throw new Error(`Unknown artwork region: ${work.region}`);
  return { ...work, region: work.region };
});
export function buildGraph(): GraphData {
  return createArtworkGraph(artworks);
}

export const graph = buildGraph();
export const japaneseCount = artworks.filter(artwork => artwork.japanese).length;
export const regionCounts = Object.entries(REGION_LABELS).map(([id, label]) => ({ id, label, count: artworks.filter(work => work.region === id).length }));
