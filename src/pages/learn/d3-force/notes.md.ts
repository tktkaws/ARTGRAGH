import text from '../../../../docs/learn/d3-force.md?raw';

export const prerender = true;

export function GET() {
  return new Response(text, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="d3-force.md"',
    },
  });
}
