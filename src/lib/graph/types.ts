import type { Region, ArtworkKind, Period } from './classification.ts';

export type GraphNode = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  accessionNumber: string;
  searchTerms: string[];
  href: string;
  image: string;
  summary: string;
  tags: string[];
  region: Region;
  kind: ArtworkKind;
  period: Period;
};
export type GraphFilters = { region?: string; period?: string; kind?: string };
export type GraphLink = {
  source: string;
  target: string;
  kind: "related" | "series" | "artist" | "category";
  label: string;
};
export type GraphData = { nodes: GraphNode[]; links: GraphLink[] };
export type ColorGroup = { id: string; query: string; color: string };
export type GraphSettings = {
  arrows: boolean;
  fade: number;
  nodeSize: number;
  linkWidth: number;
  center: number;
  repulsion: number;
  linkStrength: number;
  distance: number;
  showOrphans: boolean;
  imageNodes: boolean;
  groups: ColorGroup[];
};

export type Artwork = {
  id: number;
  accessionNumber: string;
  title: string;
  originalTitle: string;
  date: string;
  yearStart: number | null;
  yearEnd: number | null;
  creators: { id: string; name: string; originalName: string }[];
  cultures: string[];
  japanese: boolean;
  region: Region;
  type: string;
  technique: string;
  department: string;
  series: string;
  description: string;
  didYouKnow: string;
  measurements: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  sourceUrl: string;
  apiUrl: string;
  license: string;
  licenseUrl: string;
  relatedIds: number[];
};
