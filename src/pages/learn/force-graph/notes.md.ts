import text from '../../../../docs/learn/force-graph.md?raw';

export const prerender = true;

export function GET() {
  return new Response(text, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="force-graph.md"',
    },
  });
}
