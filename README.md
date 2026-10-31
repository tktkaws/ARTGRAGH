# ARTGRAPH

クリーブランド美術館のCC0画像付き作品を探索する、Astro + TypeScript + force-graph / d3-force のグラフビューです。

現在のコレクションは **150作品（日本50作品、アジア・欧米・中東・アフリカ・南米を各20作品）**。作品名・解説・豆知識・技法と素材は日本語で表示します。日本語は当サイトによる参考訳で、一部の長文を要約しています。美術館の公式訳ではありません。詳細ページの「美術館の原文を読む（英語）」から元の情報も確認できます。

## 開発

Node.js 24以降を推奨します（`.nvmrc`）。

```sh
npm install
npm run dev -- --background
npm run astro -- dev status
npm run astro -- dev logs
npm run astro -- dev stop
```

開発URLは起動時の出力を確認してください。ポートが使用中の場合は別のポートで起動します。

```sh
npm run check
npm test
npm run build
npm run test:build
```

## データ更新

```sh
npm run data:fetch
npm run data:fetch -- --refresh
```

`src/data/artworks.json`は取得済みの正規化データです。通常の開発・ビルドではAPIを呼びません。初回取得時はネットワーク接続が必要です。生レスポンスは`.cache/cleveland/`へ保存し、`--refresh`時のみ再取得します。更新が失敗した場合、前回のJSONを維持します。

地域ごとの候補を取得し、日本50件、アジア・欧米・中東・アフリカ・南米を各20件採用します。`share_license_status`が`CC0`で画像のある作品に絞り、解説・原題・関連作品の有無と作者の偏りを考慮して選びます。

参考訳は`src/data/artwork-translations.ja.json`に作品IDごとに保存し、取得した原文とは分けて管理します。データ取得で訳文は上書きしません。原文の作品名・原題・解説・豆知識・技法からハッシュを照合し、変更や作品の入れ替えがあれば、その作品は原文表示へ戻します。更新後は訳文を見直し、対応する`sourceHash`も更新してください。作者名・文化・収蔵部門・年代・寸法の日本語表記は`src/lib/graph/localization.ts`で管理します。英語の作品名・作者名も検索に使えます。

## 線の意味

線は、美術館の関連作品、同じシリーズ、同じ作者、共通の種類・地域の順に優先して作成します。共通の種類・地域による接続では、元データの作品種別も一致し、年代が近いものを優先します。作者・種別などから生成した線は探索用の共通点を示し、歴史的な影響関係を主張するものではありません。各作品の次数を最大3に制限し、線の重なりを抑えています。

## 主な構成

- `scripts/fetch-artworks.mjs`：作品選定・取得・キャッシュ
- `src/data/artworks.json`：取得済み作品150件
- `src/data/artwork-translations.ja.json`：150作品の日本語参考訳
- `src/lib/graph/localization.ts`：訳文の照合とメタデータの日本語表記
- `src/lib/graph/artworks.ts`：ノードと関係線の生成
- `src/lib/graph/classification.ts`：地域・年代・種類の定義と分類
- `src/scripts/graph-view.ts`：グラフ操作・検索・設定保存
- `src/pages/artworks/[id].astro`：作品の詳細ページ
- `src/pages/graph.json.ts`：静的なグラフデータ

検索は作品名、作者、所蔵番号、地域、年代、種類に対応します。設定と閲覧位置はブラウザ内に保存します。ページを再読み込みしたときは、保存したズーム・位置よりも「全体を表示」を優先します。

## 分類とフィルタ

分類は次の3項目に限定しています。それぞれ独立したフィルタで、すべての条件を満たす作品を表示します。

| 分類 | 選択肢 |
| --- | --- |
| 地域 | 日本、アジア、欧米、中東、アフリカ、南米 |
| 年代 | 1000年未満（紀元前を含む）、1000〜1599年、1600年代、1700年代、1800年代、1900年以降、年代不明 |
| 種類 | 絵画、彫刻、それ以外 |

地域はAPIの文化・地域情報を優先し、必要に応じて収蔵部門から判断する探索用の分類です。アジアには中国・韓国・インドなどを含み、日本と中東は別枠にします。欧米は欧州・北米、中東はイラン・トルコなど、南米はペルー・コロンビアなどを対象とし、中米は含めません。地域が判別できない作品は採用しません。

年代は`creation_date_earliest`（制作開始年）を基準に分類し、値がない場合は年代不明とします。画面の年代表記は美術館の情報をもとに「約」「紀元前」「年代後半」などを日本語にします。種類はAPIの`Painting`を絵画、`Sculpture`を彫刻、版画・陶磁器・染織などをすべて「それ以外」として扱います。

件数と分類ルールは`src/lib/graph/classification.ts`、地域ごとの取得条件は`scripts/fetch-artworks.mjs`で管理します。

## 出典・権利情報

画像と作品データはThe Cleveland Museum of ArtのCC0対象から取得しています。各作品ページに元ページ・API・CC0ライセンスへのリンクを掲載しています。

- [API仕様](https://openaccess-api.clevelandart.org/)
- [美術館のOpen Access方針](https://www.clevelandart.org/open-access)
- [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)

公式サイトとの提携・推奨を示すものではありません。
