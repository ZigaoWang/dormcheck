import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { config } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, houseFilter } from "@/lib/session";

const DEFAULTS = {
  feverThreshold: 37.3,
  lateGraceMinutes: 5,
  morningStart: "06:30",
  morningEnd: "08:00",
  morningDeadlineJunior: "07:15",
  morningDeadlineSenior: "07:30",
  studyhallEnd: "19:15",
};

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const requestedHouse = url.searchParams.get("house");
  const house = houseFilter(user, requestedHouse);

  if (!house) {
    const all = await db.select().from(config);
    return NextResponse.json(all);
  }

  const [cfg] = await db.select().from(config).where(eq(config.house, house)).limit(1);
  return NextResponse.json(cfg || { house, ...DEFAULTS });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { house: targetHouse, ...settings } = body;

  const house = user.isAdmin ? (targetHouse || user.house) : user.house;

  if (!house) {
    return NextResponse.json({ error: "No house specified" }, { status: 400 });
  }

  if (!user.isAdmin && user.house !== house) {
    return NextResponse.json({ error: "Cannot change settings for another house" }, { status: 403 });
  }

  await db
    .insert(config)
    .values({ house, ...DEFAULTS, ...settings })
    .onConflictDoUpdate({
      target: config.house,
      set: settings,
    });

  const [updated] = await db.select().from(config).where(eq(config.house, house));
  return NextResponse.json(updated);
}
