import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js 16 proxy layer: reject browser cross-origin writes to our API.
 * Server-to-server callbacks without an Origin header remain allowed.
 */
export function proxy(request: NextRequest) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== request.nextUrl.host) {
          return NextResponse.json({ error: "Cross-origin write rejected." }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid Origin header." }, { status: 403 });
      }
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
