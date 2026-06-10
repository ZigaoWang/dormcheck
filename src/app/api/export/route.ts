import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkins, students } from "@/lib/db/schema";
import { eq, and, gte, lt, inArray, desc } from "drizzle-orm";
import { getSessionUser, houseFilter } from "@/lib/session";
import { format, addDays, parseISO, eachDayOfInterval } from "date-fns";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const today = new Date().toISOString().split("T")[0];
  const startStr = url.searchParams.get("start") || url.searchParams.get("date") || today;
  const endStr = url.searchParams.get("end") || startStr;
  const type = url.searchParams.get("type") as "morning" | "studyhall" | "tech_handin" | null;
  const requestedHouse = url.searchParams.get("house");
  const house = houseFilter(user, requestedHouse);

  const rangeStart = new Date(startStr + "T00:00:00");
  const rangeEnd = new Date(endStr + "T23:59:59.999");

  const studentConditions = [eq(students.isActive, true)];
  if (house) studentConditions.push(eq(students.house, house));

  const houseStudents = await db
    .select()
    .from(students)
    .where(and(...studentConditions))
    .orderBy(students.grade, students.name);

  const houseStudentIds = houseStudents.map((s) => s.studentId);

  const typeLabel = type === "morning" ? "Morning" : type === "studyhall" ? "Study Hall" : type === "tech_handin" ? "Tech Hand-in" : "All";
  const houseLabel = house ? `House ${house}` : "All Houses";
  const dormLabel = house ? (["A", "B", "C", "D"].includes(house) ? "Girls Dorm" : "Boys Dorm") : "";
  const rangeLabel = startStr === endStr ? startStr : `${startStr} to ${endStr}`;

  const lines: string[] = [];
  lines.push(`tally Report`);
  lines.push(`${houseLabel}${dormLabel ? ` (${dormLabel})` : ""}`);
  lines.push(`${typeLabel} - ${rangeLabel}`);
  lines.push(``);

  if (houseStudentIds.length === 0) {
    lines.push("No students found");
    return csvResponse(lines, house, startStr, endStr, type);
  }

  const checkinConditions = [
    gte(checkins.createdAt, rangeStart),
    lt(checkins.createdAt, rangeEnd),
    inArray(checkins.studentId, houseStudentIds),
  ];
  if (type) checkinConditions.push(eq(checkins.checkType, type));

  const allCheckins = await db
    .select()
    .from(checkins)
    .where(and(...checkinConditions))
    .orderBy(checkins.grade, desc(checkins.createdAt));

  const days = eachDayOfInterval({ start: parseISO(startStr), end: parseISO(endStr) });

  // Summary across full range
  const checkedInIds = new Set(allCheckins.map((c) => c.studentId));
  lines.push(`Total Students,${houseStudents.length}`);
  lines.push(`Days,${days.length}`);
  lines.push(`Total Check-ins,${allCheckins.length}`);
  lines.push(`Late,${allCheckins.filter((c) => c.isLate).length}`);
  lines.push(`High Temperature,${allCheckins.filter((c) => c.isFever).length}`);
  lines.push(``);

  for (const day of days) {
    const dateStr = format(day, "yyyy-MM-dd");
    const dayStart = new Date(dateStr + "T00:00:00");
    const dayEnd = new Date(dateStr + "T23:59:59.999");
    const dayCheckins = allCheckins.filter((c) => {
      const t = new Date(c.createdAt).getTime();
      return t >= dayStart.getTime() && t <= dayEnd.getTime();
    });

    lines.push(`=== ${format(day, "EEEE, MMM d yyyy")} ===`);

    const dayCheckedIds = new Set(dayCheckins.map((c) => c.studentId));
    const absent = houseStudents.filter((s) => !dayCheckedIds.has(s.studentId));
    lines.push(`Present,${dayCheckedIds.size},Late,${dayCheckins.filter((c) => c.isLate).length},Absent,${absent.length}`);
    lines.push(``);

    for (const grade of [9, 10, 11, 12]) {
      const gradeCheckins = dayCheckins.filter((c) => c.grade === grade);
      const gradeAbsent = absent.filter((s) => s.grade === grade);
      if (gradeCheckins.length === 0 && gradeAbsent.length === 0) continue;

      lines.push(`Year ${grade}`);
      lines.push(`Student ID,Name,Status,Temperature,Time`);
      for (const c of gradeCheckins) {
        const status = c.isFever ? "High Temp" : c.isLate ? "Late" : "Present";
        const temp = c.temperature != null ? c.temperature.toFixed(1) + "°C" : "";
        lines.push(`${c.studentId},"${c.name}",${status},${temp},${format(new Date(c.createdAt), "HH:mm")}`);
      }
      for (const s of gradeAbsent) {
        lines.push(`${s.studentId},"${s.name}",Absent,,`);
      }
      lines.push(``);
    }
  }

  return csvResponse(lines, house, startStr, endStr, type);
}

function csvResponse(lines: string[], house: string | null, start: string, end: string, type: string | null) {
  const range = start === end ? start : `${start}-${end}`;
  const filename = `tally-${house ? `house${house}-` : ""}${range}${type ? `-${type}` : ""}.csv`;
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
