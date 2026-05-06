import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV must have a header and at least one row" }, { status: 400 });
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const requiredCols = ["student_id", "name", "grade", "house"];
  for (const col of requiredCols) {
    if (!header.includes(col)) {
      return NextResponse.json({ error: `Missing column: ${col}` }, { status: 400 });
    }
  }

  const idIdx = header.indexOf("student_id");
  const nameIdx = header.indexOf("name");
  const gradeIdx = header.indexOf("grade");
  const houseIdx = header.indexOf("house");
  const timeIdx = header.indexOf("expected_morning_time");

  const rows: {
    studentId: string;
    name: string;
    grade: number;
    house: string;
    expectedMorningTime: string;
  }[] = [];

  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const studentId = cols[idIdx];
    const name = cols[nameIdx];
    const grade = parseInt(cols[gradeIdx], 10);
    const house = cols[houseIdx];
    const expectedTime = timeIdx >= 0 ? cols[timeIdx] || (grade <= 10 ? "07:15" : "07:30") : (grade <= 10 ? "07:15" : "07:30");

    if (!studentId || !name || isNaN(grade) || !house) {
      errors.push(`Row ${i + 1}: missing required fields`);
      continue;
    }

    if (!/^\d{5}$/.test(studentId)) {
      errors.push(`Row ${i + 1}: student_id must be 5 digits, got "${studentId}"`);
      continue;
    }

    if (!user.isAdmin && user.house !== house) {
      errors.push(`Row ${i + 1}: cannot import students for house ${house}`);
      continue;
    }

    rows.push({ studentId, name, grade, house, expectedMorningTime: expectedTime });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows", details: errors }, { status: 400 });
  }

  let upserted = 0;
  for (const row of rows) {
    await db
      .insert(students)
      .values(row)
      .onConflictDoUpdate({
        target: students.studentId,
        set: {
          name: sql`excluded.name`,
          grade: sql`excluded.grade`,
          house: sql`excluded.house`,
          expectedMorningTime: sql`excluded.expected_morning_time`,
        },
      });
    upserted++;
  }

  return NextResponse.json({
    ok: true,
    imported: upserted,
    errors: errors.length > 0 ? errors : undefined,
  });
}
