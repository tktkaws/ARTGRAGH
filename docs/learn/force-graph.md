# force-graphの基礎：点と線を描き、操作する

[学習ガイド](./README.md) · 次：[d3-forceの基礎](./d3-force.md)

対応するデモ：開発サーバーの`/learn/force-graph/`

## 1. force-graphとは何か

force-graphは、**つながりを持つデータを、操作できる2Dのグラフとして表示するJavaScriptライブラリ**です。Canvasに点と線を描き、ズーム、背景の移動、ノードのドラッグ、ホバー、クリックなどを扱えます。内部の位置計算にはd3-forceを使います。[公式README](https://github.com/vasturiano/force-graph)

ここでいうグラフは、売上の棒グラフなどではなく、もの同士のつながりを表すデータ構造です。

| 用語 | 意味 | このリポジトリでの例 |
| --- | --- | --- |
| ノード（node） | ひとつの対象を表す点 | 美術館の作品 |
| リンク／エッジ（link / edge） | 2つの点のつながりを表す線 | 同じ作者、同じシリーズなど |
| レイアウト | 点をどこへ置くかという配置 | 力の計算で求めた座標 |

「どの作品同士を結ぶか」はアプリ側の仕事です。force-graphへ渡しただけで、美術館の情報から関連作品を推測してくれるわけではありません。

## 2. 入力はnodesとlinks

デモは6ノード・6リンクです。グループもアプリ側で付けた情報です。

```js
const source = {
  nodes: [
    { id: 'A', group: 'left' },
    { id: 'B', group: 'left' },
    { id: 'C', group: 'left' },
    { id: 'D', group: 'right' },
    { id: 'E', group: 'right' },
    { id: 'F', group: 'right' },
  ],
  links: [
    { source: 'A', target: 'B' },
    { source: 'A', target: 'C' },
    { source: 'B', target: 'C' },
    { source: 'C', target: 'D' },
    { source: 'D', target: 'E' },
    { source: 'D', target: 'F' },
  ],
};
```

`id`は各ノードを識別する値です。リンクの`source`と`target`は、配列の添字ではなくノードのIDを参照します。Aを動かしても、リンクを書き換えなければAの接続先はB・Cのままです。

## 3. HTML要素へグラフを表示する

表示領域には、幅と高さが必要です。次は初期化の最小例です。

```html
<div id="graph" style="width: 100%; height: 400px;"></div>
```

```js
import ForceGraph from 'force-graph';

const container = document.getElementById('graph');
const graph = new ForceGraph(container)
  .width(container.clientWidth)
  .height(container.clientHeight)
  .nodeId('id')
  .graphData(structuredClone(source));
```

ブラウザの`document`を使うので、Astroのフロントマターではなく、ブラウザ用のスクリプトで実行します。

`structuredClone()`で渡すのは、位置計算がノードへ座標などを追加し、リンクの端点もノード参照として扱うためです。検索や絞り込み用の原本と、描画中に更新されるデータを分けます。

## 4. 基本操作のデモ

デモの「01 基本操作」で、次の順に試してください。

1. Aをクリックするか、AのHTMLボタンを押す。接続先のB・Cを確認。
2. 「接続先を強調」を切り替え、ホバー中の点と周囲の見え方を比較。
3. ホイールやピンチ、＋・−ボタンでズーム。「全体を表示」で戻す。
4. 背景をドラッグして視点を移動し、点をドラッグして座標を変更。
5. 「ノードをドラッグ」をオフにして、操作の違いを確認。

| 目的 | 主なAPI |
| --- | --- |
| 点の選択を受け取る | `onNodeClick()` |
| ホバーを受け取る | `onNodeHover()` |
| 倍率を変更する | `zoom()` |
| 視点の中心を変える | `centerAt()` |
| 全体が入る範囲へ調整する | `zoomToFit()` |
| ドラッグの有効・無効 | `enableNodeDrag()` |

これらのAPIは[公式リファレンス](https://github.com/vasturiano/force-graph#api-reference)で確認できます。

クリック時の処理はアプリ側で決めます。デモは接続先を表示し、本番のグラフビューは`location.assign(node.href)`で作品ページへ移動します。ドラッグ直後に遷移しないよう、アプリ側でもポインターの移動量を判定しています。

Canvasの点は通常のHTMLリンクではないため、キーボードでも選べるHTMLボタンを併設しています。本番では作品一覧の`<a>`が別の移動手段になります。

## 5. 描画を変えるデモ

「02 描画のカスタマイズ」で、ノードの大きさ、線の太さ、色分け、矢印、ラベルの閾値を変更できます。

このデモは`nodeCanvasObject()`で円と文字を描きます。コールバックには、ノード、Canvasの描画コンテキスト、ズーム倍率が渡されます。

```js
graph.nodeCanvasObject((node, ctx, scale) => {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#c4b5fd';
  ctx.fill();

  if (scale > 1.3) {
    ctx.font = `${12 / scale}px sans-serif`;
    ctx.fillStyle = '#eeeeee';
    ctx.fillText(node.id, x, y + 15);
  }
});
```

これは描画の仕組みを示す簡略例です。実際のデモでは、ラベルを徐々に表示し、選択中や隣接する点のラベルを優先します。全体を見ているときに文字が重なりすぎないようにする工夫です。

デモのノードサイズは、このコールバック内の円の半径へ反映しています。自前で円を描く場合は、既定描画用の`nodeRelSize()`だけで見た目を制御する構成とは異なります。

`nodePointerAreaPaint()`では、見た目とは別にポインターが反応する領域を描けます。小さな点でも選びやすいよう、デモでは画面上の半径22px以上を確保します。

「線を表示」は`linkVisibility()`による表示の切り替えで、リンクの力は残ります。矢印も描画上の設定です。このサンプルの線に、歴史的な影響の方向といった意味はありません。

## 6. 検索と絞り込みのデモ

検索やグループ条件の判定は、force-graphの外側で実装します。選んだデータを`graphData()`へ渡して表示を更新します。

```js
const nodes = source.nodes.filter(node => node.group === 'left');
const ids = new Set(nodes.map(node => node.id));
const links = source.links.filter(link =>
  ids.has(link.source) && ids.has(link.target)
);
graph.graphData(structuredClone({ nodes, links }));
```

両端が残るリンクだけにすることで、消えた点へ向かう線を除きます。実際のデモはこの処理に加え、変更前の座標をIDごとに保存して復元します。

「03 検索とフィルタ」で、次の結果を確かめられます。

| 操作 | 期待する表示 |
| --- | --- |
| A・B・Cへ絞り込み | 3ノード、3リンク |
| D・E・Fへ絞り込み | 3ノード、2リンク |
| Aだけ検索し、孤立ノードを表示 | 1ノード、0リンク |
| その状態で孤立ノードを非表示 | 0ノード、0リンク |

下部の「表示中のnodes / links」で、見た目と入力データを対応させられます。

## 7. 本番の実装へつなげる

| 学んだこと | 本番側の処理 |
| --- | --- |
| 点と線のデータを用意 | [artworks.ts](../../src/lib/graph/artworks.ts)の`createArtworkGraph()` |
| 検索・フィルタで対象を計算 | [model.ts](../../src/lib/graph/model.ts)の`filterGraph()` |
| 描画・クリック・ホバー | [graph-view.ts](../../src/scripts/graph-view.ts)の初期化部分 |
| 座標を引き継いで更新 | 同ファイルの`updateData()` |
| 力の設定を変更 | 同ファイルの`applyForces()` |

コンテナのサイズ変更には`ResizeObserver`で追従し、画面を破棄するときは監視・イベント・描画を解放します。戻る・進む用キャッシュに残る場合は、一時停止して復帰時に再開する処理もあります。

デモ自体の実装は[learn-force-graph.ts](../../src/scripts/learn-force-graph.ts)です。位置計算の詳細は、次の[d3-forceの基礎](./d3-force.md)で扱います。
