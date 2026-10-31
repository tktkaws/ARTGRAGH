export const REGION_LABELS = {
  Japan: '日本', Asia: 'アジア', West: '欧米', MiddleEast: '中東', Africa: 'アフリカ', SouthAmerica: '南米',
} as const;
export type Region = keyof typeof REGION_LABELS;
export function isRegion(value: string): value is Region { return Object.hasOwn(REGION_LABELS, value); }
export const REGION_TARGETS: Record<Region, number> = {
  Japan: 50, Asia: 20, West: 20, MiddleEast: 20, Africa: 20, SouthAmerica: 20,
};
export const KIND_LABELS = { Painting: '絵画', Sculpture: '彫刻', Other: 'それ以外' } as const;
export type ArtworkKind = keyof typeof KIND_LABELS;
export const PERIOD_LABELS = {
  'before-1000': '1000年未満（紀元前を含む）',
  '1000-1599': '1000〜1599年', '1600-1699': '1600年代', '1700-1799': '1700年代',
  '1800-1899': '1800年代', '1900-plus': '1900年以降', unknown: '年代不明',
} as const;
export type Period = keyof typeof PERIOD_LABELS;

// These are navigation categories based on the museum's culture metadata.
// Check specific countries before broader departmental fallbacks to avoid overlap.
export function classifyRegion(work: { culture?: string[]; department?: string }): Region | null {
  const culture = (work.culture ?? []).join(' ');
  if (/\bjapan(?:ese)?\b/i.test(culture)) return 'Japan';
  if (/\b(?:south america|peru|peruvian|colombia|colombian|ecuador|ecuadorian|brazil|brazilian|bolivia|bolivian|chile|chilean|argentina|argentine|venezuela|venezuelan|uruguay|paraguay|guyana|suriname|inca|nazca|moche|chimu|chav[ií]n)\b/i.test(culture)) return 'SouthAmerica';
  if (/\b(?:africa|african|egypt|egyptian|nubia|nigeria|congo|cameroon|ghana|mali|benin|sudan|yoruba|sierra leone|liberia|gabon|ethiopia|kenya|uganda|tunisia|morocco)\b/i.test(culture) && !/african[- ]american/i.test(culture)) return 'Africa';
  if (/\b(?:iran|iranian|persia|persian|turkey|turkish|ottoman|iraq|iraqi|mesopotamia|syria|syrian|lebanon|israel|palestine|jordan|arabia|yemen|oman|near east|middle east)\b/i.test(culture)) return 'MiddleEast';
  if (/\b(?:china|chinese|korea|korean|india|indian|nepal|nepalese|tibet|tibetan|pakistan|bangladesh|sri lanka|thailand|thai|cambodia|khmer|indonesia|java|bali|vietnam|burma|myanmar|mongolia|bhutan|laos|afghanistan|central asia)\b/i.test(culture)) return 'Asia';
  if (/\b(?:europe|european|france|french|italy|italian|spain|spanish|england|english|britain|british|germany|german|dutch|netherlands|flemish|flanders|belgium|belgian|swiss|switzerland|austria|austrian|russia|russian|portugal|portuguese|greece|greek|rome|roman|scotland|scottish|ireland|irish|denmark|danish|sweden|swedish|norway|norwegian|finland|finnish|poland|polish|czech|hungary|hungarian|america|american|united states|canada|canadian)\b/i.test(culture)) return 'West';
  const department = work.department ?? '';
  if (department === 'Japanese Art') return 'Japan';
  if (/Chinese Art|Korean Art|Indian and South\s*east Asian Art/i.test(department)) return 'Asia';
  if (department === 'African Art') return 'Africa';
  if (/^(?:Modern European|European|American) Painting and Sculpture$|^Medieval Art$|^Greek and Roman Art$/.test(department)) return 'West';
  return null;
}

export function classifyKind(type: string): ArtworkKind {
  return type === 'Painting' ? 'Painting' : type === 'Sculpture' ? 'Sculpture' : 'Other';
}

export function classifyPeriod(yearStart: number | null): Period {
  if (yearStart === null || !Number.isFinite(yearStart)) return 'unknown';
  if (yearStart < 1000) return 'before-1000';
  if (yearStart < 1600) return '1000-1599';
  if (yearStart < 1700) return '1600-1699';
  if (yearStart < 1800) return '1700-1799';
  if (yearStart < 1900) return '1800-1899';
  return '1900-plus';
}
