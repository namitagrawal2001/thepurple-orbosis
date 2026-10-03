export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(
    { status: 'healthy' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
