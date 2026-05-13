import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const raw = await file.text();
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 1) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }

  // Auto-detect delimiter: TSV if first line has tabs, else CSV
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const splitLine = (l: string) => l.split(delimiter).map((c) => c.trim());

  // Check if first line looks like a header (non-numeric first field)
  const firstFields = splitLine(lines[0]);
  const hasHeader = isNaN(Number(firstFields[0]));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  let idIdx = 0, nameIdx = 1, gradeIdx = 2, houseIdx = -1, timeIdx = -1;
  if (hasHeader) {
    const header = firstFields.map((h) => h.toLowerCase());
    idIdx = header.findIndex((h) => h.includes("student_id") || h === "id");
    nameIdx = header.findIndex((h) => h === "name");
    gradeIdx = header.findIndex((h) => h === "grade");
    houseIdx = header.findIndex((h) => h === "house");
    timeIdx = header.findIndex((h) => h.includes("morning_time"));
    if (idIdx < 0 || nameIdx < 0 || gradeIdx < 0) {
      return NextResponse.json({ error: "Cannot find required columns: student_id, name, grade" }, { status: 400 });
    }
  }

  const rows: {
    studentId: string;
    name: string;
    grade: number;
    house: string | null;
    expectedMorningTime: string;
  }[] = [];

  const errors: string[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const cols = splitLine(dataLines[i]);
    const studentId = cols[idIdx];
    const name = cols[nameIdx];
    const grade = parseInt(cols[gradeIdx], 10);
    const house = houseIdx >= 0 ? (cols[houseIdx] || null) : null;
    const expectedTime = timeIdx >= 0 ? cols[timeIdx] || (grade <= 10 ? "07:15" : "07:30") : (grade <= 10 ? "07:15" : "07:30");

    if (!studentId || !name || isNaN(grade)) {
      errors.push(`Row ${i + (hasHeader ? 2 : 1)}: missing required fields`);
      continue;
    }

    if (!/^\d{4,6}$/.test(studentId)) {
      errors.push(`Row ${i + (hasHeader ? 2 : 1)}: invalid student_id "${studentId}"`);
      continue;
    }

    if (house && !user.isAdmin && user.house !== house) {
      errors.push(`Row ${i + (hasHeader ? 2 : 1)}: cannot import students for house ${house}`);
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
          // preserve existing house if new row has none
          house: sql`COALESCE(excluded.house, students.house)`,
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
  } catch (e) {
    console.error("Import error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
