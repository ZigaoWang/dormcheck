import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lockers, students, devices } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getSessionUser, houseFilter } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const house = houseFilter(user, req.nextUrl.searchParams.get("house"));

  const studentConditions = [eq(students.isActive, true), inArray(students.grade, [9, 10])];
  if (house) studentConditions.push(eq(students.house, house));

  const houseStudents = await db
    .select()
    .from(students)
    .where(and(...studentConditions))
    .orderBy(students.name);

  const studentIds = houseStudents.map((s) => s.studentId);
  if (studentIds.length === 0) {
    return NextResponse.json([]);
  }

  const lockerRows = await db
    .select()
    .from(lockers)
    .where(inArray(lockers.studentId, studentIds));

  const lockerMap = new Map(lockerRows.map((l) => [l.studentId, l]));

  const result = houseStudents.map((s) => {
    const locker = lockerMap.get(s.studentId);
    return {
      studentId: s.studentId,
      name: s.name,
      grade: s.grade,
      house: s.house,
      locker: locker
        ? {
            id: locker.id,
            hasPhone: locker.hasPhone,
            hasLaptop: locker.hasLaptop,
            hasIpad: locker.hasIpad,
          }
        : null,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-device-api-key");
  if (!apiKey) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } else {
    const [device] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.apiKey, apiKey), eq(devices.isActive, true)))
      .limit(1);
    if (!device) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const body = await req.json();
  const { studentId, hasPhone, hasLaptop, hasIpad } = body;

  if (!studentId) {
    return NextResponse.json({ error: "Missing studentId" }, { status: 400 });
  }

  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.studentId, studentId))
    .limit(1);

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(lockers)
    .where(eq(lockers.studentId, studentId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(lockers)
      .set({
        hasPhone: hasPhone ?? true,
        hasLaptop: hasLaptop ?? true,
        hasIpad: hasIpad ?? false,
        house: student.house,
        updatedAt: new Date(),
      })
      .where(eq(lockers.id, existing.id))
      .returning();
    return NextResponse.json(updated);
  }

  const [created] = await db
    .insert(lockers)
    .values({
      studentId,
      hasPhone: hasPhone ?? true,
      hasLaptop: hasLaptop ?? true,
      hasIpad: hasIpad ?? false,
      house: student.house,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await db.delete(lockers).where(eq(lockers.id, id));
  return NextResponse.json({ ok: true });
}
