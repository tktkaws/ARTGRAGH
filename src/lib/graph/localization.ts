import { createHash } from 'node:crypto';
import translations from '../../data/artwork-translations.ja.json' with { type: 'json' };
import type { Artwork } from './types.ts';

export type ArtworkTranslation = {
  sourceHash: string; title: string; description: string; didYouKnow: string; technique: string;
};
const translated: Record<string, ArtworkTranslation> = translations;

export function translationSourceHash(artwork: Artwork): string {
  return createHash('sha256').update(JSON.stringify([
    artwork.title, artwork.originalTitle, artwork.description, artwork.didYouKnow, artwork.technique,
  ])).digest('hex');
}

export function getArtworkTranslation(artwork: Artwork): ArtworkTranslation | null {
  const entry = translated[String(artwork.id)];
  return entry?.sourceHash === translationSourceHash(artwork) ? entry : null;
}

const CREATOR_NAMES: Record<string, string> = {
  '33725': 'コウシュン（Kōshun）', '33728': 'コウシン（Koshin）', '33731': 'ジョウシュン（Joshun）',
  '34633': '尾形乾山', '381102': '長沢芦雪',
  '3005': 'ジョージ・ベローズ', '2424': 'トマス・サリー', '2324': 'ベルナルド・ストロッツィ',
  '2501': 'ピーター・レリー', '2541': 'ジョシュア・レノルズ', '2665': 'ウィリアム・ペイジ',
  '4037': 'トマス・イーキンズ', '2841': 'ジェプサ・ホーマー・ウェイド', '2659': 'トマス・コール',
  '3246': 'モーリス・プレンダーガスト', '3664': 'マーサ・S・ベイカー', '2409': 'ジョン・シングルトン・コプリー',
  '3047': 'ジョージ・B・バトラー', '2460': 'ヤン・アントニスゾーン・ファン・ラーフェステイン',
  '46950': 'ペドロ・ベルゲーテ', '2472': 'サミュエル・ラヴェット・ウォルドー', '3080': 'ケニヨン・コックス',
  '42714': 'ビフザード', '379425': 'トトクロの名工',
};

export function localizedCreatorLabel(artwork: Artwork): string {
  return artwork.creators.map(creator => CREATOR_NAMES[creator.id] || creator.originalName || creator.name).join(' / ') || '作者不詳';
}

export function localizedDate(value: string): string {
  if (!value) return '年代不明';
  let result = value.replace(/(\d{3,4})[–-](\d{1,2})(?!\d)/g, (_, start: string, end: string) => {
    const scale = 10 ** end.length;
    let expanded = Math.floor(Number(start) / scale) * scale + Number(end);
    if (expanded < Number(start)) expanded += scale;
    return `${start}〜${expanded}`;
  });
  const qualifiers: [RegExp, string][] = [
    [/^c\.?\s*/, '約'], [/early to mid-(\d{3,4})s/g, '$1年代初頭〜半ば'],
    [/early-mid (\d{3,4})s/g, '$1年代初頭〜半ば'], [/mid- to late (\d{3,4})s/g, '$1年代半ば〜後半'],
    [/early[ -](\d{3,4})s/g, '$1年代初頭'], [/mid[ -](\d{3,4})s/g, '$1年代半ば'],
    [/late[ -](\d{3,4})s/g, '$1年代後半'], [/(\d{3,4})s/g, '$1年代'],
    [/before (\d+)/g, '$1年以前'], [/by (\d+)/g, '$1年までに'],
    [/radiocarbon date, ([\d.]+)% probability/g, '放射性炭素年代、確率$1%'],
    [/Chimú style/g, 'チムー様式'],
  ];
  for (const [pattern, replacement] of qualifiers) result = result.replace(pattern, replacement);
  result = result.replace(/(\d+)\s*BCE/g, '紀元前$1年').replace(/(\d+)\s*CE/g, '西暦$1年');
  result = result.replace(/(\d+)[–-]紀元前(\d+)年/g, '紀元前$1〜$2年');
  result = result.replace(/(\d+)[–-]西暦(\d+)年/g, '西暦$1〜$2年');
  result = result.replace(/[–]/g, '〜').replace(/\(/g, '（').replace(/\)/g, '）');
  result = result.replace(/(\d)(?=\s*（|）|$)/g, '$1年').replace(/年年/g, '年').replace(/, /g, '、');
  return result;
}

const DEPARTMENTS: Record<string, string> = {
  'Japanese Art': '日本美術', 'Chinese Art': '中国美術', 'Korean Art': '朝鮮半島の美術',
  'African Art': 'アフリカ美術', 'American Painting and Sculpture': 'アメリカの絵画・彫刻',
  'European Painting and Sculpture': 'ヨーロッパの絵画・彫刻', 'Art of the Americas': 'アメリカ大陸の美術',
  'Islamic Art': 'イスラーム美術', 'Egyptian and Ancient Near Eastern Art': 'エジプト・古代近東美術',
  Textiles: '染織',
};
export const localizedDepartment = (value: string) => DEPARTMENTS[value] ?? value;

const CULTURE_TERMS: Record<string, string> = {
  'Democratic Republic of the Congo': 'コンゴ民主共和国', 'Democratic Republic of Congo': 'コンゴ民主共和国',
  'Central African Republic': '中央アフリカ共和国', 'United States': 'アメリカ合衆国',
  'Southern Song dynasty': '南宋', 'Qing dynasty': '清', 'Ming dynasty': '明', 'Yuan dynasty': '元',
  'Qianlong period': '乾隆期', 'Joseon dynasty': '朝鮮王朝', 'Goryeo dynasty': '高麗時代',
  'Edo period': '江戸時代', 'Kamakura period': '鎌倉時代', 'Heian period': '平安時代',
  'Meiji period': '明治時代', 'Muromachi period': '室町時代', 'Momoyama period': '桃山時代', 'Nara period': '奈良時代',
  'Timurid period': 'ティムール朝期', 'Ilkhanid period': 'イルハン朝期', 'Qajar period': 'カージャール朝期',
  'Ottoman period': 'オスマン朝期', 'Safavid period': 'サファヴィー朝期', 'Seljuq period': 'セルジューク朝期',
  'Achaemenid period': 'アケメネス朝期', 'Urartian period': 'ウラルトゥ王国期', 'Neolithic period': '新石器時代',
  'Dali kingdom': '大理国', 'Hongshan culture': '紅山文化',
  'Central or Eastern Africa': '中央または東部アフリカ', 'Central Africa': '中央アフリカ',
  'Southern Africa': '南部アフリカ', 'West Africa': '西アフリカ', 'Central Asia': '中央アジア',
  'Northern Italy': '北イタリア', 'Northern Iran': 'イラン北部', 'Eastern Iran': 'イラン東部',
  'Northeast China': '中国東北部', 'South Coast': '南海岸', 'North Coast': '北海岸',
  'Côte d\'Ivoire': 'コートジボワール', 'Sierra Leone': 'シエラレオネ',
  'Zande': 'ザンデ', 'Chokwe': 'チョクウェ', 'Bangala': 'バンガラ', 'Mangbetu': 'マンベトゥ',
  'Shona': 'ショナ', 'Pende': 'ペンデ', 'Baule': 'バウレ', 'Kuba': 'クバ', 'Bushoong': 'ブショング',
  'Asante': 'アシャンティ', 'Bamana': 'バマナ', 'Koulikoro': 'クリコロ',
  'Japan': '日本', 'Korea': '朝鮮半島', 'China': '中国', 'India': 'インド', 'Peru': 'ペルー', 'Colombia': 'コロンビア',
  'Iran': 'イラン', 'Iraq': 'イラク', 'Turkey': 'トルコ', 'Syria': 'シリア', 'Egypt': 'エジプト',
  'Africa': 'アフリカ', 'Angola': 'アンゴラ', 'Congo': 'コンゴ', 'Sudan': 'スーダン', 'Zimbabwe': 'ジンバブエ',
  'Ghana': 'ガーナ', 'Mali': 'マリ', 'Italy': 'イタリア', 'England': 'イングランド', 'Netherlands': 'オランダ',
  'Spain': 'スペイン', 'America': 'アメリカ', 'Ohio': 'オハイオ州', 'Cleveland': 'クリーブランド',
  'Shiraz': 'シーラーズ', 'Kashan': 'カーシャーン', 'Rasht': 'ラシュト', 'Bursa': 'ブルサ', 'Isfahan': 'イスファハーン',
  'Caucasian': 'コーカサス', 'Azerbaijan': 'アゼルバイジャン', 'Kashmir': 'カシミール',
  'Chongoyape': 'チョンゴヤペ', 'Chavín': 'チャビン', 'Paracas': 'パラカス', 'Nasca': 'ナスカ',
  'Chimú': 'チムー', 'Inka': 'インカ', 'Sicán': 'シカン', 'Ocucaje': 'オクカヘ', 'Ica Valley': 'イカ谷',
  'Liao dynasty': '遼', 'Yunnan province': '雲南省', 'Zhejiang province': '浙江省',
  'Hamadan': 'ハマダーン', 'Urartian': 'ウラルトゥ', 'Gusçi': 'グシュチ', 'Lake Urmia': 'ウルミア湖',
  'Achaemenid': 'アケメネス朝', 'Persepolis': 'ペルセポリス', 'Afghanistan': 'アフガニスタン',
  'Akan': 'アカン', 'Cavernas': 'カベルナス', 'Middle Horizon': '中期ホライズン',
  'Wari Culture': 'ワリ文化', 'Early Horizon': '前期ホライズン', 'Tembladera': 'テンブラデラ',
  'Isthmian Region': '地峡地域', 'Tolima': 'トリマ', 'northwest': '北西部',
};
const cultureReplacements = Object.entries(CULTURE_TERMS).sort((a, b) => b[0].length - a[0].length).map(([term, replacement]) => ({
  pattern: new RegExp(`(?<![A-Za-z])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'g'), replacement,
}));

export function localizedCulture(value: string): string {
  let result = value;
  for (const { pattern, replacement } of cultureReplacements) result = result.replace(pattern, replacement);
  result = result.replace(/(\d+)(?:th|st|nd|rd) century/g, '$1世紀')
    .replace(/(\d+)(?:th|st|nd|rd)(?=\s*[–-])/g, '$1世紀').replace(/(\d{3,4})s/g, '$1年代')
    .replace(/late /g, '後期・').replace(/early /g, '初期・').replace(/mid /g, '中期・')
    .replace(/-style makers?/g, '様式の制作者').replace(/-style blacksmith-carver/g, '様式の鍛冶・彫刻職人')
    .replace(/-style/g, '様式').replace(/ style/g, '様式').replace(/ peoples?/g, 'の人々')
    .replace(/unidentified carver/g, '作者不詳の彫刻家').replace(/probably/g, 'おそらく').replace(/possibly|maybe/g, '推定')
    .replace(/\bcarver\b/g, '彫刻家').replace(/\bartist\b/g, '作者').replace(/\bblacksmith\b/g, '鍛冶職人')
    .replace(/ or /g, ' または ').replace(/ and /g, ' と ').replace(/ to /g, '〜').replace(/ of /g, '・')
    .replace(/ site/g, '遺跡').replace(/, /g, '、').replace(/[–]/g, '〜')
    .replace(/\bBCE\b/g, '紀元前').replace(/\bCE\b/g, '西暦');
  return result;
}

const MEASUREMENT_TERMS: Record<string, string> = {
  'Overall with hanging bar': '掛棒を含む全体', 'Overall with knobs': '軸端を含む全体',
  'Overall with mounting': '表装を含む全体', 'Overall with cover': '蓋を含む全体',
  'Overall': '全体', 'Painting': '画面', 'Mounted': '表装', 'Image': '画像部分', 'Sheet': '紙面',
  'Framed': '額装', 'Unframed': '額なし', 'Frame': '額', 'Average': '平均', 'Closed': '閉じた状態',
  'Open': '開いた状態', 'Each': '各', 'Diameter': '直径', 'Width': '幅', 'Height': '高さ',
  'Depth': '奥行', 'Length': '長さ', 'Base': '台座', 'Foot': '底部', 'Rim': '口縁',
  'Widest end': '最も広い端部', 'with lid': '蓋を含む', 'with handles': '取っ手を含む',
  'of mouth': '口部', 'with mat': 'マットを含む', 'and cord': '紐を含む',
  'with': '付き', 'only': 'のみ', 'Container': '容器', 'Embroidery': '刺繍部分', 'Panel': '一面',
  'leaf': '一葉', 'Former': '旧額', 'Recto': '表面', 'Verso': '裏面',
  'Barrel': '銃身', 'Outside': '外側', 'Blade': '刃', 'Part': '部分',
};
export function localizedMeasurements(value: string): string {
  let result = value.replace(/\s*\([^)]*\bin\.[^)]*\)/g, '');
  for (const [term, replacement] of Object.entries(MEASUREMENT_TERMS)) result = result.replace(new RegExp(`\\b${term}\\b`, 'gi'), replacement);
  result = result.replace(/直径 of (口縁|額)/g, '$1の直径');
  return result.replace(/\s+x\s+/g, ' × ').replace(/;\s*/g, '／').replace(/:\s*/g, '：');
}
