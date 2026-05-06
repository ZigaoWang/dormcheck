import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { eq, and, or, ilike } from "drizzle-orm";
import { getSessionUser, houseFilter } from "@/lib/session";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get("search");
  const requestedHouse = url.searchParams.get("house");
  const house = houseFilter(user, requestedHouse);

  const conditions = [];
  if (house) conditions.push(eq(students.house, house));
  if (search) {
    conditions.push(
      or(
        ilike(students.name, `%${search}%`),
        ilike(students.studentId, `%${search}%`),
      )!
    );
  }

  const all = await db
    .select()
    .from(students)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(students.grade, students.name);

  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { studentId, name, grade, house: studentHouse } = body;

  if (!studentId || !name || !grade || !studentHouse) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!/^\d{5}$/.test(studentId)) {
    return NextResponse.json({ error: "Student ID must be 5 digits" }, { status: 400 });
  }

  if (!user.isAdmin && user.house !== studentHouse) {
    return NextResponse.json({ error: "Cannot add students to another house" }, { status: 403 });
  }

  const expectedMorningTime = grade <= 10 ? "07:15" : "07:30";

  await db.insert(students).values({
    studentId,
    name,
    grade,
    house: studentHouse,
    expectedMorningTime,
  });

  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { studentId, name, grade, house: studentHouse, isActive } = body;

  if (!studentId) {
    return NextResponse.json({ error: "Missing studentId" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(students)
    .where(eq(students.studentId, studentId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (!user.isAdmin && user.house !== existing.house) {
    return NextResponse.json({ error: "Cannot edit students from another house" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (grade !== undefined) {
    updates.grade = grade;
    updates.expectedMorningTime = grade <= 10 ? "07:15" : "07:30";
  }
  if (studentHouse !== undefined) {
    if (!user.isAdmin && user.house !== studentHouse) {
      return NextResponse.json({ error: "Cannot move student to another house" }, { status: 403 });
    }
    updates.house = studentHouse;
  }
  if (isActive !== undefined) updates.isActive = isActive;

  if (Object.keys(updates).length > 0) {
    await db.update(students).set(updates).where(eq(students.studentId, studentId));
  }

  const [updated] = await db.select().from(students).where(eq(students.studentId, studentId));
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId } = await req.json();
  if (!studentId) {
    return NextResponse.json({ error: "Missing studentId" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(students)
    .where(eq(students.studentId, studentId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  if (!user.isAdmin && user.house !== existing.house) {
    return NextResponse.json({ error: "Cannot delete students from another house" }, { status: 403 });
  }

  await db.update(students).set({ isActive: false }).where(eq(students.studentId, studentId));
  return NextResponse.json({ ok: true });
}
