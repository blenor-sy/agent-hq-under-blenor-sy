import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { identityFromClaims, isSupabaseAuthCookie } from "@/lib/supabase/session";

function clearStaleAuthCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach(({ name }) => {
    if (isSupabaseAuthCookie(name)) {
      response.cookies.set(name, "", { path: "/", maxAge: 0 });
    }
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next();
  const hadAuthCookie = request.cookies.getAll().some(({ name }) => isSupabaseAuthCookie(name));

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items, headers) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // Verify the access token without forcing concurrent requests to rotate the
  // same refresh token. Supabase recommends getClaims for SSR route guards.
  const { data, error } = await supabase.auth.getClaims();
  const identity = identityFromClaims(data?.claims);
  const protectedPath = request.nextUrl.pathname.startsWith("/dashboard");
  if (error || !identity) {
    if (!protectedPath) return clearStaleAuthCookies(request, response);
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", request.nextUrl.pathname);
    if (hadAuthCookie) login.searchParams.set("error", "session_expired");
    return clearStaleAuthCookies(request, NextResponse.redirect(login));
  }
  if (request.nextUrl.pathname === "/login") {
    const dashboard = request.nextUrl.clone();
    dashboard.pathname = "/dashboard";
    dashboard.search = "";
    return NextResponse.redirect(dashboard);
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
