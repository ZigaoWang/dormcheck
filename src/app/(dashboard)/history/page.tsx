"use client";

import { useState } from "react";
import { format } from "date-fns";
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

export default function HistoryPage() {
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [gradeFilter, setGradeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    setLoading(true);
    setSearched(true);
    const params = new URLSearchParams();
    params.set("start", startDate);
    params.set("end", endDate);
    if (gradeFilter) params.set("grade", gradeFilter);
    if (typeFilter) params.set("type", typeFilter);

    const res = await fetch(`/api/checkins/history?${params}`);
    const data = await res.json();
    setCheckins(data);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">History</h1>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm text-gray-500">From</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-500">To</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-500">Year</label>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="h-9 rounded-md border px-3 text-sm"
          >
            <option value="">All</option>
            {[9, 10, 11, 12].map((g) => (
              <option key={g} value={g}>Year {g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-500">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-md border px-3 text-sm"
          >
            <option value="">All</option>
            <option value="morning">Morning</option>
            <option value="studyhall">Study Hall</option>
            <option value="tech_handin">Tech Hand-in</option>
          </select>
        </div>
        <Button onClick={handleSearch} size="sm">Search</Button>
        {checkins.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(
                `/api/export?date=${startDate}&type=${typeFilter}`,
                "_blank"
              )
            }
          >
            Export
          </Button>
        )}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading...</p>
      ) : !searched ? (
        <p className="py-8 text-center text-sm text-gray-400">
          Select a date range and click Search.
        </p>
      ) : checkins.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No records found.</p>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-gray-400">{checkins.length} records</p>
          {[9, 10, 11, 12].map((grade) => {
            const rows = checkins.filter((c) => c.grade === grade);
            if (rows.length === 0) return null;
            return (
              <section key={grade}>
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Year {grade}</h2>
                  <span className="text-xs text-gray-400">{rows.length} records</span>
                </div>
                <div className="rounded-xl border bg-white overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left text-xs text-gray-400">
                        <th className="px-4 py-2.5 font-medium">Date</th>
                        <th className="px-4 py-2.5 font-medium">Time</th>
                        <th className="px-4 py-2.5 font-medium">Name</th>
                        <th className="px-4 py-2.5 font-medium">ID</th>
                        <th className="px-4 py-2.5 font-medium">Type</th>
                        <th className="px-4 py-2.5 font-medium">Temp</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => (
                        <tr key={c.id} className={cn(
                          "border-b last:border-0",
                          c.isFever && "bg-orange-50/50",
                          c.isLate && !c.isFever && "bg-yellow-50/50",
                        )}>
                          <td className="px-4 py-2.5">{format(new Date(c.createdAt), "MMM d")}</td>
                          <td className="px-4 py-2.5 text-gray-400 tabular-nums">{format(new Date(c.createdAt), "HH:mm")}</td>
                          <td className="px-4 py-2.5 font-medium">{c.name}</td>
                          <td className="px-4 py-2.5 text-gray-400">{c.studentId}</td>
                          <td className="px-4 py-2.5">{c.checkType === "studyhall" ? "Study Hall" : c.checkType === "tech_handin" ? "Tech Hand-in" : "Morning"}</td>
                          <td className={cn("px-4 py-2.5 tabular-nums", c.isFever && "font-semibold text-red-600")}>
                            {c.temperature?.toFixed(1) ?? "—"}
                          </td>
                          <td className="px-4 py-2.5">
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
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
