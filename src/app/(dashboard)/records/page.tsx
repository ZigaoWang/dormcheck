"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfWeek, endOfWeek, subWeeks, subDays, parseISO, eachDayOfInterval } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

type Preset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "custom";

const TYPE_ORDER = ["morning", "studyhall", "tech_handin"] as const;
const TYPE_LABEL: Record<string, string> = {
  morning: "Morning",
  studyhall: "Study Hall",
  tech_handin: "Tech Hand-in",
};

export default function RecordsPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [preset, setPreset] = useState<Preset>("thisWeek");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [gradeFilter, setGradeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  function applyPreset(p: Preset) {
    setPreset(p);
    const now = new Date();
    if (p === "today") {
      setStartDate(today); setEndDate(today);
    } else if (p === "yesterday") {
      const y = format(subDays(now, 1), "yyyy-MM-dd");
      setStartDate(y); setEndDate(y);
    } else if (p === "thisWeek") {
      setStartDate(format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      setEndDate(format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    } else if (p === "lastWeek") {
      const last = subWeeks(now, 1);
      setStartDate(format(startOfWeek(last, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      setEndDate(format(endOfWeek(last, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    }
  }

  useEffect(() => { applyPreset("thisWeek"); }, []);

  const search = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("start", startDate);
    params.set("end", endDate);
    if (gradeFilter) params.set("grade", gradeFilter);
    if (typeFilter) params.set("type", typeFilter);
    const res = await fetch(`/api/checkins/history?${params}`);
    const data = await res.json();
    setCheckins(data.checkins || []);
    setStudents(data.students || []);
    setLoading(false);
  }, [startDate, endDate, gradeFilter, typeFilter]);

  useEffect(() => {
    if (startDate && endDate) search();
  }, [search, startDate, endDate]);

  const exportUrl = `/api/export?start=${startDate}&end=${endDate}${typeFilter ? `&type=${typeFilter}` : ""}`;
  const rangeLabel = startDate === endDate
    ? format(new Date(startDate + "T00:00"), "EEEE, MMM d")
    : `${format(new Date(startDate + "T00:00"), "MMM d")} – ${format(new Date(endDate + "T00:00"), "MMM d")}`;

  const days = startDate && endDate
    ? eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) })
    : [];

  const typesToShow = typeFilter ? [typeFilter] : (TYPE_ORDER as readonly string[]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Records</h1>
          <p className="text-sm text-gray-400">{rangeLabel}</p>
        </div>
        <Button onClick={() => window.open(exportUrl, "_blank")} size="sm" disabled={!startDate || !endDate}>
          Download CSV
        </Button>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {([
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "thisWeek", label: "This Week" },
            { id: "lastWeek", label: "Last Week" },
            { id: "custom", label: "Custom" },
          ] as { id: Preset; label: string }[]).map((p) => (
            <button
              key={p.id}
              onClick={() => p.id === "custom" ? setPreset("custom") : applyPreset(p.id)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                preset === p.id ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap items-end gap-3 pt-1">
            <div>
              <label className="mb-1 block text-xs text-gray-500">From</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">To</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2 border-t">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Year</label>
            <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="h-9 rounded-md border px-3 text-sm">
              <option value="">All years</option>
              {[9, 10, 11, 12].map((g) => <option key={g} value={g}>Year {g}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 rounded-md border px-3 text-sm">
              <option value="">All types</option>
              <option value="morning">Morning</option>
              <option value="studyhall">Study Hall</option>
              <option value="tech_handin">Tech Hand-in</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading...</p>
      ) : (
        <div className="space-y-8">
          {days.map((day) => {
            const dayStr = format(day, "yyyy-MM-dd");
            const dayCheckins = checkins.filter((c) => format(new Date(c.createdAt), "yyyy-MM-dd") === dayStr);
            if (dayCheckins.length === 0) return null;

            return (
              <section key={dayStr} className="space-y-4">
                <div className="border-b pb-1">
                  <h2 className="text-base font-semibold">{format(day, "EEEE, MMM d yyyy")}</h2>
                  <p className="text-xs text-gray-400">{dayCheckins.length} check-ins</p>
                </div>

                {typesToShow.map((t) => {
                  const tcheckins = dayCheckins.filter((c) => c.checkType === t);
                  if (tcheckins.length === 0) return null;

                  const presentIds = new Set(tcheckins.map((c) => c.studentId));
                  const expected = t === "tech_handin"
                    ? students.filter((s) => s.grade === 9 || s.grade === 10)
                    : students;
                  const absent = expected.filter((s) => !presentIds.has(s.studentId));

                  const lateCount = tcheckins.filter((c) => c.isLate).length;
                  const feverCount = tcheckins.filter((c) => c.isFever).length;

                  return (
                    <div key={t} className="rounded-xl border bg-white overflow-hidden">
                      <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2.5">
                        <h3 className="text-sm font-semibold">{TYPE_LABEL[t]}</h3>
                        <div className="flex gap-3 text-xs">
                          <span className="text-gray-500">{tcheckins.length} present</span>
                          {absent.length > 0 && <span className="font-semibold text-red-600">{absent.length} absent</span>}
                          {lateCount > 0 && <span className="font-medium text-yellow-600">{lateCount} late</span>}
                          {feverCount > 0 && <span className="font-semibold text-red-600">{feverCount} fever</span>}
                        </div>
                      </div>

                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs text-gray-400">
                            <th className="px-4 py-2 font-medium">Name</th>
                            <th className="px-4 py-2 font-medium">ID</th>
                            <th className="px-4 py-2 font-medium">Year</th>
                            <th className="px-4 py-2 font-medium">Time</th>
                            <th className="px-4 py-2 font-medium">Temp</th>
                            <th className="px-4 py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {absent
                            .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name))
                            .map((s) => (
                              <tr key={`absent-${s.studentId}`} className="border-b last:border-0 bg-red-50/40">
                                <td className="px-4 py-2 font-medium text-red-700">{s.name}</td>
                                <td className="px-4 py-2 text-red-500">{s.studentId}</td>
                                <td className="px-4 py-2 text-red-500">Year {s.grade}</td>
                                <td className="px-4 py-2 text-red-400">—</td>
                                <td className="px-4 py-2 text-red-400">—</td>
                                <td className="px-4 py-2">
                                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">ABSENT</span>
                                </td>
                              </tr>
                            ))}
                          {tcheckins
                            .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name))
                            .map((c) => (
                              <tr key={c.id} className={cn(
                                "border-b last:border-0",
                                c.isFever && "bg-orange-50/50",
                                c.isLate && !c.isFever && "bg-yellow-50/50",
                              )}>
                                <td className="px-4 py-2 font-medium">{c.name}</td>
                                <td className="px-4 py-2 text-gray-400">{c.studentId}</td>
                                <td className="px-4 py-2 text-gray-500">Year {c.grade}</td>
                                <td className="px-4 py-2 text-gray-400 tabular-nums">{format(new Date(c.createdAt), "HH:mm")}</td>
                                <td className={cn("px-4 py-2 tabular-nums", c.isFever && "font-semibold text-red-600")}>
                                  {c.temperature?.toFixed(1) ?? "—"}
                                </td>
                                <td className="px-4 py-2">
                                  {c.isFever ? (
                                    <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">High Temp</span>
                                  ) : c.isLate ? (
                                    <span className="rounded bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">Late</span>
                                  ) : (
                                    <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">OK</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </section>
            );
          })}

          {checkins.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">No records found in this range.</p>
          )}
        </div>
      )}
    </div>
  );
}
