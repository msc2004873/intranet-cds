import supabase from '../../../../lib/supabase-server.js';

export async function GET(request) {
  // DISABLED: This endpoint was auto-calculating TC ajustado incorrectly (TC - 10)
  // TC ajustado values must be set MANUALLY per period, not auto-calculated
  // To use this endpoint again, fix the logic and restore proper values

  return Response.json({
    error: 'ENDPOINT DISABLED - TC ajustado must be set manually, not auto-calculated',
    status: 'disabled'
  }, { status: 403 });
}
