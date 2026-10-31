import { buildGraph } from '../lib/graph/build';
export const prerender = true;
export function GET() { return new Response(JSON.stringify(buildGraph()), { headers: { 'Content-Type': 'application/json; charset=utf-8' } }); }
