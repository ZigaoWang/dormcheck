import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, devices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("X-Device-API-Key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.apiKey, apiKey), eq(devices.isActive, true)))
    .limit(1);

  if (!device) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const body = await req.json();
  const { student_id, name, grade } = body;

  if (!student_id || !name || !grade) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!/^\d{5}$/.test(student_id)) {
    return NextResponse.json({ error: "Student ID must be 5 digits" }, { status: 400 });
  }

  const gradeNum = parseInt(String(grade), 10);
  if (isNaN(gradeNum) || gradeNum < 7 || gradeNum > 12) {
    return NextResponse.json({ error: "Grade must be between 7 and 12" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(students)
    .where(eq(students.studentId, student_id))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "Student already exists" }, { status: 409 });
  }

  const house = device.house || "A";
  const expectedMorningTime = gradeNum <= 10 ? "07:15" : "07:30";

  await db.insert(students).values({
    studentId: student_id,
    name,
    grade: gradeNum,
    house,
    expectedMorningTime,
  });

  return NextResponse.json({
    ok: true,
    student_id,
    name,
    grade: gradeNum,
    house,
  });
}
