import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkins, students } from "@/lib/db/schema";
import { eq, and, gte, lt, inArray, desc } from "drizzle-orm";
import { getSessionUser, houseFilter } from "@/lib/session";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date") || new Date().toISOString().split("T")[0];
  const type = url.searchParams.get("type") as "morning" | "studyhall" | null;
  const requestedHouse = url.searchParams.get("house");
  const house = houseFilter(user, requestedHouse);

  const dayStart = new Date(dateStr + "T00:00:00");
  const dayEnd = new Date(dateStr + "T23:59:59.999");

  const studentConditions = [eq(students.isActive, true)];
  if (house) studentConditions.push(eq(students.house, house));

  const houseStudents = await db
    .select()
    .from(students)
    .where(and(...studentConditions))
    .orderBy(students.grade, students.name);

  const houseStudentIds = houseStudents.map((s) => s.studentId);

  const typeLabel = type === "morning" ? "Morning" : type === "studyhall" ? "Study Hall" : "All";
  const houseLabel = house ? `House ${house}` : "All Houses";
  const dormLabel = house
    ? ["A", "B", "C", "D"].includes(house) ? "Girls Dorm" : "Boys Dorm"
    : "";

  if (houseStudentIds.length === 0) {
    const header = `DormCheck Report - ${houseLabel}${dormLabel ? ` (${dormLabel})` : ""} - ${typeLabel} - ${dateStr}\n\n`;
    return new Response(
      header + "Student ID,Name,Grade,House,Status,Temperature,Time\nNo students found\n",
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="dormcheck-${house ? `house${house}-` : ""}${dateStr}${type ? `-${type}` : ""}.csv"`,
        },
      }
    );
  }

  const checkinConditions = [
    gte(checkins.createdAt, dayStart),
    lt(checkins.createdAt, dayEnd),
    inArray(checkins.studentId, houseStudentIds),
  ];
  if (type) checkinConditions.push(eq(checkins.checkType, type));

  const dayCheckins = await db
    .select()
    .from(checkins)
    .where(and(...checkinConditions))
    .orderBy(checkins.grade, desc(checkins.createdAt));

  const checkedInIds = new Set(dayCheckins.map((c) => c.studentId));
  const absentStudents = houseStudents.filter((s) => !checkedInIds.has(s.studentId));

  const presentCount = checkedInIds.size;
  const lateCount = dayCheckins.filter((c) => c.isLate).length;
  const feverCount = dayCheckins.filter((c) => c.isFever).length;
  const absentCount = absentStudents.length;

  const lines: string[] = [];

  lines.push(`DormCheck Report`);
  lines.push(`${houseLabel}${dormLabel ? ` (${dormLabel})` : ""}`);
  lines.push(`${typeLabel} - ${dateStr}`);
  lines.push(``);
  lines.push(`Total Students,${houseStudents.length}`);
  lines.push(`Checked In,${presentCount}`);
  lines.push(`Late,${lateCount}`);
  lines.push(`High Temperature,${feverCount}`);
  lines.push(`Absent,${absentCount}`);
  lines.push(``);

  for (const grade of [9, 10, 11, 12]) {
    const gradeCheckins = dayCheckins.filter((c) => c.grade === grade);
    const gradeAbsent = absentStudents.filter((s) => s.grade === grade);
    if (gradeCheckins.length === 0 && gradeAbsent.length === 0) continue;

    lines.push(`Year ${grade}`);
    lines.push(`Student ID,Name,Status,Temperature,Time`);

    for (const c of gradeCheckins) {
      const status = c.isFever ? "High Temp" : c.isLate ? "Late" : "Present";
      const temp = c.temperature != null ? c.temperature.toFixed(1) + "°C" : "";
      const time = format(new Date(c.createdAt), "HH:mm");
      lines.push(`${c.studentId},${c.name},${status},${temp},${time}`);
    }

    for (const s of gradeAbsent) {
      lines.push(`${s.studentId},${s.name},Absent,,`);
    }

    lines.push(``);
  }

  const csv = lines.join("\n");
  const filename = `dormcheck-${house ? `house${house}-` : ""}${dateStr}${type ? `-${type}` : ""}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
