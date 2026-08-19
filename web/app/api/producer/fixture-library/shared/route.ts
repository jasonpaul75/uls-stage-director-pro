import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  extractValidatedPresetRowsFromBody,
  FIXTURE_LIBRARY_SHARED_MAX_ENTRIES,
  listSharedFixtureLibraryPortable,
  mergeSharedFixtureLibrary,
  replaceSharedFixtureLibrary,
} from "@/lib/fixture-library-shared-server";
import { GlobalRole } from "@prisma/client";

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

/** Authenticated producers read the tenant-wide hosted fixture preset table. */
export async function GET() {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;

  if (!session?.user?.id || !canProduce(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await listSharedFixtureLibraryPortable();
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Could not load shared fixture library" }, { status: 500 });
  }
}

/** Merge-import presets into the hosted library (duplicate labels skipped — same semantics as browser JSON import). */
export async function POST(req: Request) {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;

  if (!session?.user?.id || !canProduce(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const rows = extractValidatedPresetRowsFromBody(json);
  if (rows === null) {
    return NextResponse.json(
      { error: "Bad payload — need presets array or schemaVersion (or version) 1 interchange." },
      { status: 400 },
    );
  }

  try {
    const result = await mergeSharedFixtureLibrary(session.user.id, rows);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "Could not merge shared fixture library" }, { status: 500 });
  }
}

/** Full replace of hosted presets — **ULS admin only** (producers use POST merge + browser library). */
export async function PUT(req: Request) {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;

  if (!session?.user?.id || role !== GlobalRole.ULS_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const rows = extractValidatedPresetRowsFromBody(json);
  if (rows === null) {
    return NextResponse.json(
      { error: "Bad payload — need presets array or schemaVersion (or version) 1 interchange." },
      { status: 400 },
    );
  }

  if (rows.length > FIXTURE_LIBRARY_SHARED_MAX_ENTRIES) {
    return NextResponse.json(
      { error: `Hosted library accepts at most ${FIXTURE_LIBRARY_SHARED_MAX_ENTRIES} presets.` },
      { status: 400 },
    );
  }

  try {
    await replaceSharedFixtureLibrary(session.user.id, rows);
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "OVER_CAP") {
      return NextResponse.json(
        { error: `Hosted library accepts at most ${FIXTURE_LIBRARY_SHARED_MAX_ENTRIES} presets.` },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Could not replace shared fixture library" }, { status: 500 });
  }
}
