import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Lets server layouts build safe `callbackUrl` values after login (path only, same origin). */
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/portal/:path*", "/producer/:path*"],
};
