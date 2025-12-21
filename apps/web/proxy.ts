import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimitMiddleware, applyRateLimitHeaders } from '@/lib/rate-limit/limiter';

export async function proxy(request: NextRequest) {
  // Check rate limits first (before authentication)
  // For API routes, we rate limit by IP initially
  const rateLimitResponse = await rateLimitMiddleware(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if accessing onboarding routes
  const isOnboardingRoute = request.nextUrl.pathname.startsWith('/onboarding');

  // Protected routes - redirect to login if not authenticated
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/api/protected') ||
    isOnboardingRoute;

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Check onboarding status for authenticated users accessing dashboard
  if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
    // Check if user has completed onboarding
    const { data: progress } = await supabase
      .from('onboarding_progress')
      .select('completed_at, current_step')
      .eq('user_id', user.id)
      .single();

    // Redirect to onboarding if not completed
    if (!progress?.completed_at) {
      const url = request.nextUrl.clone();
      const currentStep = progress?.current_step || 'welcome';
      url.pathname = `/onboarding/${currentStep}`;
      return NextResponse.redirect(url);
    }
  }

  // Redirect authenticated users away from auth pages
  const isAuthRoute =
    request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup';

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    // Check if onboarding is complete before redirecting to dashboard
    const { data: progress } = await supabase
      .from('onboarding_progress')
      .select('completed_at, current_step')
      .eq('user_id', user.id)
      .single();

    if (progress?.completed_at) {
      url.pathname = '/dashboard';
    } else {
      url.pathname = `/onboarding/${progress?.current_step || 'welcome'}`;
    }
    return NextResponse.redirect(url);
  }

  // Apply rate limit headers to successful responses
  // Now we can use the user ID for more accurate rate limiting
  const finalResponse = await applyRateLimitHeaders(request, supabaseResponse, user?.id);

  return finalResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/inngest (Inngest webhook - has its own rate limiting)
     * - api/webhooks (External webhooks - has its own rate limiting)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
