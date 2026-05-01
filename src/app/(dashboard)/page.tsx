"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CheckType = "morning" | "studyhall";

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
  status: "ok" | "late" | "fever" | "missing";
  temperature: number | null;
  time: string | null;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const userHouse = (session?.user as Record<string, unknown>)?.house as string | null;
  const isAdmin = (session?.user as Record<string, unknown>)?.isAdmin as boolean | undefined;

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tab, setTab] = useState<CheckType>("morning");
  const [house, setHouse] = useState("");
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [missing, setMissing] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userHouse && !house) {
      setHouse(userHouse);
    } else if (!house) {
      setHouse("A");
    }
  }, [userHouse, house]);

  const fetchData = useCallback(async () => {
    if (!house) return;
    try {
      const res = await fetch(
        `/api/checkins/today?date=${date}&type=${tab}&house=${house}`
      );
      const data = await res.json();
      setCheckins(data.checkins || []);
      setMissing(data.missing || []);
    } catch {
      // will retry on next change
    } finally {
      setLoading(false);
    }
  }, [date, tab, house]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const es = new EventSource("/api/feed/stream");
    es.addEventListener("checkin", () => {
      fetchData();
    });
    return () => es.close();
  }, [date, tab, house, fetchData]);

  const totalStudents = checkins.length + missing.length;
  const lateCount = checkins.filter((c) => c.isLate).length;
  const feverCount = checkins.filter((c) => c.isFever).length;

  const buildRoster = (grade: number): RosterEntry[] => {
    const gradeCheckins = checkins.filter((c) => c.grade === grade);
    const gradeMissing = missing.filter((s) => s.grade === grade);

    const entries: RosterEntry[] = [
      ...gradeCheckins.map((c) => ({
        studentId: c.studentId,
        name: c.name,
        grade: c.grade,
        status: (c.isFever ? "fever" : c.isLate ? "late" : "ok") as RosterEntry["status"],
        temperature: c.temperature,
        time: format(new Date(c.createdAt), "HH:mm"),
      })),
      ...gradeMissing.map((s) => ({
        studentId: s.studentId,
        name: s.name,
        grade: s.grade,
        status: "missing" as const,
        temperature: null,
        time: null,
      })),
    ];

    entries.sort((a, b) => {
      const order = { missing: 0, fever: 1, late: 2, ok: 3 };
      return order[a.status] - order[b.status] || a.name.localeCompare(b.name);
    });

    return entries;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            House {house}
            <span className="ml-2 text-sm font-normal text-gray-400">
              {["A", "B", "C", "D"].includes(house) ? "Girls Dorm" : "Boys Dorm"}
            </span>
          </h1>
          <p className="text-sm text-gray-400">
            {format(new Date(date + "T00:00"), "EEEE, MMMM d")}
          </p>
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
            onClick={() =>
              window.open(
                `/api/export?date=${date}&type=${tab}&house=${house}`,
                "_blank"
              )
            }
          >
            Export
          </Button>
        </div>
      </div>

      {/* House selector (admin) */}
      {isAdmin && (
        <div className="flex gap-1">
          {HOUSES.map((h) => (
            <button
              key={h}
              onClick={() => setHouse(h)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                house === h
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              )}
            >
              {h}
            </button>
          ))}
        </div>
      )}

      {/* Summary line */}
      <div className="flex items-center gap-4 text-sm">
        <span>
          <span className="font-medium">{checkins.length}</span>
          <span className="text-gray-400">/{totalStudents} checked in</span>
        </span>
        {lateCount > 0 && (
          <span className="text-gray-500">{lateCount} late</span>
        )}
        {missing.length > 0 && (
          <span className="text-red-600 font-medium">{missing.length} missing</span>
        )}
        {feverCount > 0 && (
          <span className="text-red-600 font-medium">{feverCount} high temp</span>
        )}
        {missing.length === 0 && totalStudents > 0 && (
          <span className="text-gray-400">All present</span>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as CheckType)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="morning">Morning</TabsTrigger>
          <TabsTrigger value="studyhall">Study Hall</TabsTrigger>
        </TabsList>

        {(["morning", "studyhall"] as const).map((t) => (
          <TabsContent key={t} value={t} className="space-y-6 pt-1">
            {loading ? (
              <p className="py-8 text-center text-sm text-gray-400">Loading...</p>
            ) : totalStudents === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No students in this house yet.
              </p>
            ) : (
              GRADES.map((grade) => {
                const roster = buildRoster(grade);
                if (roster.length === 0) return null;

                const gradeCheckedIn = roster.filter((r) => r.status !== "missing").length;
                const gradeTotal = roster.length;

                return (
                  <section key={grade}>
                    <div className="mb-2 flex items-baseline gap-2">
                      <h2 className="text-sm font-semibold">Year {grade}</h2>
                      <span className="text-xs text-gray-400">
                        {gradeCheckedIn}/{gradeTotal}
                      </span>
                    </div>

                    <div className="rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-gray-400">
                            <th className="px-3 py-2 font-normal">Name</th>
                            <th className="px-3 py-2 font-normal">ID</th>
                            <th className="px-3 py-2 font-normal">Status</th>
                            <th className="px-3 py-2 font-normal">Temp</th>
                            <th className="px-3 py-2 font-normal">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roster.map((r) => (
                            <tr
                              key={r.studentId}
                              className={cn(
                                "border-b last:border-0",
                                r.status === "missing" && "bg-red-50/60",
                              )}
                            >
                              <td className="px-3 py-2 font-medium">{r.name}</td>
                              <td className="px-3 py-2 text-gray-400">{r.studentId}</td>
                              <td className="px-3 py-2">
                                <StatusText status={r.status} />
                              </td>
                              <td className={cn(
                                "px-3 py-2",
                                r.status === "fever" && "font-medium text-red-600"
                              )}>
                                {r.temperature?.toFixed(1) ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-gray-400">
                                {r.time ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function StatusText({ status }: { status: RosterEntry["status"] }) {
  switch (status) {
    case "ok":
      return <span className="text-gray-500">OK</span>;
    case "late":
      return <span className="text-yellow-600">Late</span>;
    case "fever":
      return <span className="text-red-600">High Temp</span>;
    case "missing":
      return <span className="font-medium text-red-600">Missing</span>;
  }
}
