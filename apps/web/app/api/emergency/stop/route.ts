import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { executeEmergencyStop } from '@/lib/emergency';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Emergency stop API endpoint
 * POST /api/emergency/stop
 *
 * Immediately halts all marketing automation for the authenticated user's organization.
 * Requires authentication and appropriate permissions (owner or admin).
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    // Get organization_id from request body
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing required field: organizationId' },
        { status: 400 }
      );
    }

    // Verify user has permission (must be owner or admin)
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Organization not found or access denied' },
        { status: 403 }
      );
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json(
        {
          error: 'Insufficient permissions - only owners and admins can trigger emergency stop',
        },
        { status: 403 }
      );
    }

    // Execute emergency stop
    const result = await executeEmergencyStop(organizationId, user.id);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'error' in result ? result.error : 'Emergency stop failed',
          timestamp: result.timestamp,
        },
        { status: 500 }
      );
    }

    // Return success with summary
    return NextResponse.json(
      {
        success: true,
        organizationId: result.organizationId,
        summary: result.summary,
        timestamp: result.timestamp,
        triggeredBy: result.triggeredBy,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Emergency stop API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get emergency stop status
 * GET /api/emergency/stop?organizationId=xxx
 *
 * Returns whether the organization is in sandbox mode (emergency stop active)
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    // Get organization_id from query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing required parameter: organizationId' },
        { status: 400 }
      );
    }

    // Verify user has access to this organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Organization not found or access denied' },
        { status: 403 }
      );
    }

    // Get organization settings
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const settings = (org.settings as Record<string, unknown>) || {};
    const sandboxMode = settings.sandbox_mode === true;
    const sandboxEnabledAt = settings.sandbox_enabled_at as string | undefined;

    return NextResponse.json({
      organizationId,
      sandboxMode,
      sandboxEnabledAt,
      emergencyStopActive: sandboxMode,
    });
  } catch (error) {
    console.error('Emergency stop status API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
