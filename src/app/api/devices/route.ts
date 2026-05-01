import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { devices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser, houseFilter } from "@/lib/session";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const requestedHouse = url.searchParams.get("house");
  const house = houseFilter(user, requestedHouse);

  const conditions = [];
  if (house) conditions.push(eq(devices.house, house));

  const all = await db
    .select({
      id: devices.id,
      name: devices.name,
      house: devices.house,
      lastSeen: devices.lastSeen,
      isActive: devices.isActive,
    })
    .from(devices)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, house: deviceHouse } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  const assignedHouse = user.isAdmin ? (deviceHouse || null) : user.house;

  if (!user.isAdmin && deviceHouse && deviceHouse !== user.house) {
    return NextResponse.json({ error: "Cannot create devices for another house" }, { status: 403 });
  }

  const id = crypto.randomUUID();
  const apiKey = `dk_${crypto.randomBytes(24).toString("hex")}`;

  await db.insert(devices).values({ id, name, house: assignedHouse, apiKey });

  return NextResponse.json({ id, name, house: assignedHouse, apiKey });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, house: deviceHouse } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(devices)
    .where(eq(devices.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  if (!user.isAdmin && user.house !== existing.house) {
    return NextResponse.json({ error: "Cannot edit devices from another house" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (deviceHouse !== undefined) {
    if (!user.isAdmin && deviceHouse !== user.house) {
      return NextResponse.json({ error: "Cannot move device to another house" }, { status: 403 });
    }
    updates.house = deviceHouse;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(devices).set(updates).where(eq(devices.id, id));
  }

  const [updated] = await db.select({
    id: devices.id,
    name: devices.name,
    house: devices.house,
    lastSeen: devices.lastSeen,
    isActive: devices.isActive,
  }).from(devices).where(eq(devices.id, id));

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(devices)
    .where(eq(devices.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  if (!user.isAdmin && user.house !== existing.house) {
    return NextResponse.json({ error: "Cannot revoke devices from another house" }, { status: 403 });
  }

  await db.update(devices).set({ isActive: false }).where(eq(devices.id, id));
  return NextResponse.json({ ok: true });
}
