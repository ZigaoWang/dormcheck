"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CheckType = "morning" | "studyhall";
type Status = "ok" | "late" | "fever" | "missing";

const HOUSES = ["A", "B", "C", "D", "E", "F", "G", "H"];
const GRADES = [9, 10, 11, 12];

interface Checkin {
  id: number;
  studentId: string;
  name: string;
  grade: number;
  temperature: number | null;
  checkType: string;
  isLate: boolean;
  isFever: boolean;
  createdAt: string;
}

interface Student {
  studentId: string;
  name: string;
  grade: number;
  house: string;
}

interface RosterEntry {
  studentId: string;
  name: string;
  grade: number;
  status: Status;
  temperature: number | null;
  time: string | null;
}

interface HouseSummary {
  house: string;
  total: number;
  checkedIn: number;
  missing: number;
  late: number;
  fever: number;
}

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    ok: "bg-green-50 text-green-700",
    late: "bg-yellow-50 text-yellow-700",
    fever: "bg-red-50 text-red-700 font-semibold",
    missing: "bg-red-100 text-red-700 font-semibold",
  };
  const labels: Record<Status, string> = {
    ok: "OK",
    late: "Late",
    fever: "High Temp",
    missing: "Missing",
  };
  return (
    <span className={cn("inline-block rounded px-2 py-0.5 text-xs", styles[status])}>
      {labels[status]}
    </span>
  );
}

function StatCard({
  label,
  value,
  total,
  variant = "default",
}: {
  label: string;
  value: number;
  total?: number;
  variant?: "default" | "warn" | "danger" | "ok";
}) {
  const colors = {
    default: "text-gray-900",
    warn: "text-yellow-600",
    danger: "text-red-600",
    ok: "text-green-600",
  };
  return (
    <div className="rounded-xl border bg-white px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tabular-nums", colors[variant])}>
        {value}
        {total !== undefined && (
          <span className="ml-1 text-base font-normal text-gray-400">/ {total}</span>
        )}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const userHouse = (session?.user as Record<string, unknown>)?.house as string | null;
  const isAdmin = (session?.user as Record<string, unknown>)?.isAdmin as boolean | undefined;

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tab, setTab] = useState<CheckType>("morning");
  const [house, setHouse] = useState("");
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [missing, setMissing] = useState<Student[]>([]);
  const [allHouses, setAllHouses] = useState<HouseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!house) setHouse(isAdmin ? "A" : (userHouse || "A"));
  }, [status, isAdmin, userHouse, house]);

  const fetchHouse = useCallback(async () => {
    if (!house) return;
    try {
      const res = await fetch(`/api/checkins/today?date=${date}&type=${tab}&house=${house}`);
      const data = await res.json();
      setCheckins(data.checkins || []);
      setMissing(data.missing || []);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [date, tab, house]);

  const fetchAllHouses = useCallback(async () => {
    if (!isAdmin) return;
    const results = await Promise.all(
      HOUSES.map((h) =>
        fetch(`/api/checkins/today?date=${date}&type=${tab}&house=${h}`)
          .then((r) => r.json())
          .then((data) => {
            const c: Checkin[] = data.checkins || [];
            const m: Student[] = data.missing || [];
            return {
              house: h,
              total: c.length + m.length,
              checkedIn: c.length,
              missing: m.length,
              late: c.filter((x) => x.isLate).length,
              fever: c.filter((x) => x.isFever).length,
            } satisfies HouseSummary;
          })
      )
    );
    setAllHouses(results);
  }, [date, tab, isAdmin]);

  useEffect(() => {
    setLoading(true);
    fetchHouse();
    fetchAllHouses();
  }, [fetchHouse, fetchAllHouses]);

  useEffect(() => {
    const es = new EventSource("/api/feed/stream");
    es.addEventListener("checkin", () => {
      fetchHouse();
      fetchAllHouses();
    });
    return () => es.close();
  }, [fetchHouse, fetchAllHouses]);

  const totalStudents = checkins.length + missing.length;
  const lateCount = checkins.filter((c) => c.isLate).length;
  const feverCount = checkins.filter((c) => c.isFever).length;

  const buildRoster = (grade: number): RosterEntry[] => {
    const entries: RosterEntry[] = [
      ...checkins
        .filter((c) => c.grade === grade)
        .map((c) => ({
          studentId: c.studentId,
          name: c.name,
          grade: c.grade,
          status: (c.isFever ? "fever" : c.isLate ? "late" : "ok") as Status,
          temperature: c.temperature,
          time: format(new Date(c.createdAt), "HH:mm"),
        })),
      ...missing
        .filter((s) => s.grade === grade)
        .map((s) => ({
          studentId: s.studentId,
          name: s.name,
          grade: s.grade,
          status: "missing" as const,
          temperature: null,
          time: null,
        })),
    ];
    const order: Record<Status, number> = { missing: 0, fever: 1, late: 2, ok: 3 };
    return entries.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {status !== "authenticated" ? "" : isAdmin ? (
              <>
                All Houses
                {house && <span className="ml-2 text-sm font-normal text-gray-400">viewing House {house}</span>}
              </>
            ) : (
              <>
                House {house}
                <span className="ml-2 text-sm font-normal text-gray-400">
                  {["A", "B", "C", "D"].includes(house) ? "Girls Dorm" : "Boys Dorm"}
                </span>
              </>
            )}
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-400">
              {format(new Date(date + "T00:00"), "EEEE, MMMM d")}
            </p>
            {lastUpdated && (
              <span className="flex items-center gap-1 text-xs text-gray-300">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                Live
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/export?date=${date}&type=${tab}&house=${house}`, "_blank")}
          >
            Export
          </Button>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 rounded-lg border bg-gray-50 p-1 w-fit">
        {(["morning", "studyhall"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t === "morning" ? "Morning" : "Study Hall"}
          </button>
        ))}
      </div>

      {/* Admin: all-houses overview */}
      {isAdmin && allHouses.length > 0 && (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
          {allHouses.map((h) => (
            <button
              key={h.house}
              onClick={() => setHouse(h.house)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors hover:border-gray-400",
                house === h.house ? "border-gray-900 bg-gray-900 text-white" : "bg-white",
                h.missing > 0 && house !== h.house && "border-red-200 bg-red-50"
              )}
            >
              <p className={cn("text-xs font-medium", house === h.house ? "text-gray-300" : "text-gray-400")}>
                House {h.house}
              </p>
              <p className={cn("text-xl font-bold tabular-nums", house === h.house ? "text-white" : h.missing > 0 ? "text-red-600" : "text-gray-900")}>
                {h.checkedIn}
                <span className={cn("text-xs font-normal", house === h.house ? "text-gray-400" : "text-gray-400")}>
                  /{h.total}
                </span>
              </p>
              {h.missing > 0 && (
                <p className={cn("text-xs", house === h.house ? "text-red-300" : "text-red-500")}>
                  {h.missing} missing
                </p>
              )}
              {h.fever > 0 && (
                <p className={cn("text-xs", house === h.house ? "text-orange-300" : "text-orange-500")}>
                  {h.fever} fever
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Stat cards */}
      {!loading && totalStudents > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Checked In"
            value={checkins.length}
            total={totalStudents}
            variant={checkins.length === totalStudents ? "ok" : "default"}
          />
          <StatCard
            label="Missing"
            value={missing.length}
            variant={missing.length > 0 ? "danger" : "ok"}
          />
          <StatCard
            label="Late"
            value={lateCount}
            variant={lateCount > 0 ? "warn" : "default"}
          />
          <StatCard
            label="High Temp"
            value={feverCount}
            variant={feverCount > 0 ? "danger" : "default"}
          />
        </div>
      )}

      {/* Roster by grade */}
      {loading ? (
        <p className="py-12 text-center text-sm text-gray-400">Loading...</p>
      ) : totalStudents === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">No students in this house yet.</p>
      ) : (
        <div className="space-y-6">
          {GRADES.map((grade) => {
            const roster = buildRoster(grade);
            if (roster.length === 0) return null;
            const present = roster.filter((r) => r.status !== "missing").length;
            const hasMissing = roster.some((r) => r.status === "missing");
            const hasFever = roster.some((r) => r.status === "fever");

            return (
              <section key={grade}>
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Year {grade}</h2>
                  <span className={cn(
                    "text-xs font-medium",
                    hasMissing ? "text-red-500" : "text-gray-400"
                  )}>
                    {present}/{roster.length}
                  </span>
                  {hasFever && (
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-600">
                      fever alert
                    </span>
                  )}
                </div>

                <div className="rounded-xl border bg-white overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left text-xs text-gray-400">
                        <th className="px-4 py-2.5 font-medium">Name</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Temp</th>
                        <th className="px-4 py-2.5 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((r) => (
                        <tr
                          key={r.studentId}
                          className={cn(
                            "border-b last:border-0 transition-colors",
                            r.status === "missing" && "bg-red-50/50",
                            r.status === "fever" && "bg-orange-50/50",
                          )}
                        >
                          <td className="px-4 py-2.5">
                            <span className="font-medium">{r.name}</span>
                            <span className="ml-2 text-xs text-gray-300">{r.studentId}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className={cn(
                            "px-4 py-2.5 tabular-nums",
                            r.status === "fever" ? "font-semibold text-red-600" : "text-gray-500"
                          )}>
                            {r.temperature != null ? `${r.temperature.toFixed(1)}°` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-gray-400 tabular-nums">
                            {r.time ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
