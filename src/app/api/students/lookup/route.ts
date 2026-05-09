import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students, devices } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
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

  const url = new URL(req.url);
  const uid = url.searchParams.get("uid");
  const studentId = url.searchParams.get("student_id");

  if (!uid && !studentId) {
    return NextResponse.json({ error: "Missing uid or student_id" }, { status: 400 });
  }

  let student;
  if (studentId) {
    const [s] = await db
      .select()
      .from(students)
      .where(eq(students.studentId, studentId))
      .limit(1);
    student = s;
  } else if (uid) {
    const [s] = await db
      .select()
      .from(students)
      .where(eq(students.uid, uid))
      .limit(1);
    student = s;
  }

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  return NextResponse.json({
    student_id: student.studentId,
    name: student.name,
    grade: student.grade,
    house: student.house,
  });
}
