import { NextRequest, NextResponse } from "next/server";
import { createWorkspace } from "@/lib/repo/workspace";
import { checkRateLimit, getClientIp, UNKNOWN_IP } from "@/lib/rate-limit";

// Brake on runaway/abusive creation, not a security control (see lib/rate-limit.ts).
const BOOTSTRAP_LIMIT = 10;
const BOOTSTRAP_WINDOW_MS = 60 * 60 * 1000;

/**
 * Creates a new anonymous workspace. This is the one workspace route that
 * does not require the x-workspace-id / x-workspace-token headers, since it
 * is what mints them in the first place - and correspondingly the one
 * unauthenticated route that writes DB rows with zero required input, so it
 * is rate-limited per IP.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    // Fail OPEN rather than throttle: an unresolved IP (e.g. a proxy that
    // strips every forwarding header) would otherwise share one "unknown"
    // bucket across every such visitor, rate-limiting all of them together.
    if (ip !== UNKNOWN_IP) {
      const { allowed } = checkRateLimit(`workspace-bootstrap:${ip}`, BOOTSTRAP_LIMIT, BOOTSTRAP_WINDOW_MS);
      if (!allowed) {
        return NextResponse.json({ error: "Too many workspaces created from this address. Try again later." }, { status: 429 });
      }
    }

    let name: string | null = null;
    try {
      const body = await request.json();
      if (body && typeof body.name === "string" && body.name.trim()) {
        name = body.name.trim();
      }
    } catch {
      // No JSON body, or an empty one; name stays null.
    }

    const workspace = await createWorkspace(name);
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    console.error("Workspace bootstrap error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
