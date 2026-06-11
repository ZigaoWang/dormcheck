"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CheckType = "morning" | "studyhall" | "tech_handin";
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
  photoUrl: string | null;
  phoneHandedIn: boolean | null;
  laptopHandedIn: boolean | null;
  ipadHandedIn: boolean | null;
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
  photoUrl: string | null;
  devices: { hasPhone: boolean; hasLaptop: boolean; hasIpad: boolean } | null;
  deviceStatus: { phoneHandedIn: boolean | null; laptopHandedIn: boolean | null; ipadHandedIn: boolean | null } | null;
  exemptions: { phone: Exemption | null; laptop: Exemption | null; ipad: Exemption | null };
}

interface Exemption {
  id: number;
  studentId: string;
  deviceType: "phone" | "laptop" | "ipad";
  startDate: string;
  endDate: string;
  note: string | null;
}

interface HouseSummary {
  house: string;
  total: number;
  checkedIn: number;
  missing: number;
  late: number;
  fever: number;
}

interface LockerInfo {
  studentId: string;
  hasPhone: boolean;
  hasLaptop: boolean;
  hasIpad: boolean;
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

function DeviceChip({
  label,
  handedIn,
  exemption,
}: {
  label: string;
  handedIn: boolean | null | undefined;
  exemption: Exemption | null;
}) {
  if (exemption) {
    return (
      <span
        className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700"
        title={`Exempt ${exemption.startDate} to ${exemption.endDate}${exemption.note ? `: ${exemption.note}` : ""}`}
      >
        {label}: exempt
      </span>
    );
  }
  if (handedIn === undefined || handedIn === null) {
    return <span className="rounded bg-gray-50 px-1.5 py-0.5 text-gray-500">{label}</span>;
  }
  return (
    <span className={cn(
      "rounded px-1.5 py-0.5",
      handedIn === false ? "bg-red-50 text-red-600 line-through" : "bg-green-50 text-green-600"
    )}>
      {label}
    </span>
  );
}

function ExemptionEditor({
  entry,
  today,
  onClose,
  onSaved,
}: {
  entry: RosterEntry;
  today: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [deviceType, setDeviceType] = useState<"phone" | "laptop" | "ipad">(
    entry.devices?.hasPhone ? "phone" : entry.devices?.hasLaptop ? "laptop" : "ipad"
  );
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const active = [
    entry.exemptions.phone,
    entry.exemptions.laptop,
    entry.exemptions.ipad,
  ].filter((e): e is Exemption => e !== null);

  async function add() {
    if (startDate > endDate) { setError("Start date must be before end date"); return; }
    setSubmitting(true); setError("");
    const res = await fetch("/api/exemptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: entry.studentId, deviceType, startDate, endDate, note }),
    });
    setSubmitting(false);
    if (res.ok) onSaved();
    else { const d = await res.json(); setError(d.error || "Failed to save"); }
  }

  async function remove(id: number) {
    setSubmitting(true);
    const res = await fetch("/api/exemptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setSubmitting(false);
    if (res.ok) onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">Device Exemptions</h2>
            <p className="text-sm text-gray-500">{entry.name} · {entry.studentId}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">&times;</button>
        </div>

        {active.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase text-gray-400">Active exemptions</p>
            {active.map((e) => (
              <div key={e.id} className="flex items-start justify-between rounded-lg border bg-blue-50 px-3 py-2">
                <div className="text-sm">
                  <p className="font-medium capitalize">{e.deviceType}</p>
                  <p className="text-xs text-gray-600">{e.startDate} → {e.endDate}</p>
                  {e.note && <p className="text-xs text-gray-700 mt-0.5">{e.note}</p>}
                </div>
                <button
                  onClick={() => remove(e.id)}
                  disabled={submitting}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 space-y-3 border-t pt-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Add new exemption</p>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Device</label>
            <select
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value as "phone" | "laptop" | "ipad")}
              className="h-9 w-full rounded-md border px-3 text-sm"
            >
              {entry.devices?.hasPhone && <option value="phone">Phone</option>}
              {entry.devices?.hasLaptop && <option value="laptop">Laptop</option>}
              {entry.devices?.hasIpad && <option value="ipad">iPad</option>}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">From</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">To</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Reason (optional)</label>
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. confiscated, broken, at home"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={add} disabled={submitting}>
              {submitting ? "Saving..." : "Add Exemption"}
            </Button>
          </div>
        </div>
      </div>
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
  const [lockerData, setLockerData] = useState<LockerInfo[]>([]);
  const [exemptions, setExemptions] = useState<Exemption[]>([]);
  const [allHouses, setAllHouses] = useState<HouseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [exemptionEditor, setExemptionEditor] = useState<RosterEntry | null>(null);

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
      setLockerData(data.lockers || []);
      setExemptions(data.exemptions || []);
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
  const incompleteCount = checkins.filter((c) =>
    c.phoneHandedIn === false || c.laptopHandedIn === false || c.ipadHandedIn === false
  ).length;

  const lockerMap = new Map(lockerData.map((l) => [l.studentId, l]));
  const exemptionMap = new Map<string, { phone: Exemption | null; laptop: Exemption | null; ipad: Exemption | null }>();
  for (const e of exemptions) {
    if (!exemptionMap.has(e.studentId)) exemptionMap.set(e.studentId, { phone: null, laptop: null, ipad: null });
    exemptionMap.get(e.studentId)![e.deviceType] = e;
  }
  const emptyEx = { phone: null, laptop: null, ipad: null };

  const buildRoster = (grade: number): RosterEntry[] => {
    const entries: RosterEntry[] = [
      ...checkins
        .filter((c) => c.grade === grade)
        .map((c) => {
          const locker = lockerMap.get(c.studentId);
          return {
            studentId: c.studentId,
            name: c.name,
            grade: c.grade,
            status: (c.isFever ? "fever" : c.isLate ? "late" : "ok") as Status,
            temperature: c.temperature,
            time: format(new Date(c.createdAt), "HH:mm"),
            photoUrl: c.photoUrl,
            devices: locker ? { hasPhone: locker.hasPhone, hasLaptop: locker.hasLaptop, hasIpad: locker.hasIpad } : null,
            deviceStatus: { phoneHandedIn: c.phoneHandedIn, laptopHandedIn: c.laptopHandedIn, ipadHandedIn: c.ipadHandedIn },
            exemptions: exemptionMap.get(c.studentId) || emptyEx,
          };
        }),
      ...missing
        .filter((s) => s.grade === grade)
        .map((s) => {
          const locker = lockerMap.get(s.studentId);
          return {
            studentId: s.studentId,
            name: s.name,
            grade: s.grade,
            status: "missing" as const,
            temperature: null,
            time: null,
            photoUrl: null,
            devices: locker ? { hasPhone: locker.hasPhone, hasLaptop: locker.hasLaptop, hasIpad: locker.hasIpad } : null,
            deviceStatus: null,
            exemptions: exemptionMap.get(s.studentId) || emptyEx,
          };
        }),
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
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 rounded-lg border bg-gray-50 p-1 w-fit">
        {(["morning", "studyhall", "tech_handin"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t === "morning" ? "Morning" : t === "studyhall" ? "Study Hall" : "Tech Hand-in"}
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
            label={tab === "tech_handin" ? "Handed In" : "Checked In"}
            value={checkins.length}
            total={totalStudents}
            variant={checkins.length === totalStudents ? "ok" : "default"}
          />
          <StatCard
            label="Missing"
            value={missing.length}
            variant={missing.length > 0 ? "danger" : "ok"}
          />
          {tab !== "tech_handin" && (
            <>
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
            </>
          )}
          {tab === "tech_handin" && (
            <StatCard
              label="Incomplete"
              value={incompleteCount}
              variant={incompleteCount > 0 ? "warn" : "default"}
            />
          )}
        </div>
      )}

      {/* Roster by grade */}
      {loading ? (
        <p className="py-12 text-center text-sm text-gray-400">Loading...</p>
      ) : totalStudents === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">No students in this house yet.</p>
      ) : (
        <div className="space-y-6">
          {(tab === "tech_handin" ? [9, 10] : GRADES).map((grade) => {
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
                        {tab === "tech_handin" ? (
                          <>
                            <th className="px-4 py-2.5 font-medium">Devices</th>
                            <th className="px-4 py-2.5 font-medium">Photo</th>
                          </>
                        ) : (
                          <th className="px-4 py-2.5 font-medium">Temp</th>
                        )}
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
                          {tab === "tech_handin" ? (
                            <>
                              <td className="px-4 py-2.5">
                                {r.devices ? (
                                  <span className="flex flex-wrap gap-1.5 text-xs">
                                    {r.devices.hasPhone && (
                                      <DeviceChip
                                        label="Phone"
                                        handedIn={r.deviceStatus?.phoneHandedIn}
                                        exemption={r.exemptions.phone}
                                      />
                                    )}
                                    {r.devices.hasLaptop && (
                                      <DeviceChip
                                        label="Laptop"
                                        handedIn={r.deviceStatus?.laptopHandedIn}
                                        exemption={r.exemptions.laptop}
                                      />
                                    )}
                                    {r.devices.hasIpad && (
                                      <DeviceChip
                                        label="iPad"
                                        handedIn={r.deviceStatus?.ipadHandedIn}
                                        exemption={r.exemptions.ipad}
                                      />
                                    )}
                                    <button
                                      onClick={() => setExemptionEditor(r)}
                                      className="rounded border border-dashed border-gray-300 px-1.5 py-0.5 text-gray-400 hover:border-gray-500 hover:text-gray-700"
                                      title="Manage exemptions"
                                    >
                                      Edit
                                    </button>
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-300">Not set</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                {r.photoUrl ? (
                                  <button
                                    onClick={() => setPhotoPreview(r.photoUrl)}
                                    className="h-8 w-8 overflow-hidden rounded border hover:ring-2 hover:ring-blue-300"
                                  >
                                    <img src={r.photoUrl} alt="" className="h-full w-full object-cover" />
                                  </button>
                                ) : r.status !== "missing" ? (
                                  <span className="text-xs text-gray-300">No photo</span>
                                ) : (
                                  <span className="text-xs text-gray-300">—</span>
                                )}
                              </td>
                            </>
                          ) : (
                            <td className={cn(
                              "px-4 py-2.5 tabular-nums",
                              r.status === "fever" ? "font-semibold text-red-600" : "text-gray-500"
                            )}>
                              {r.temperature != null ? `${r.temperature.toFixed(1)}°` : "—"}
                            </td>
                          )}
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

      {/* Exemption editor */}
      {exemptionEditor && (
        <ExemptionEditor
          entry={exemptionEditor}
          today={date}
          onClose={() => setExemptionEditor(null)}
          onSaved={() => { setExemptionEditor(null); fetchHouse(); }}
        />
      )}

      {/* Photo lightbox */}
      {photoPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPhotoPreview(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img
              src={photoPreview}
              alt="Locker photo"
              className="max-h-[85vh] rounded-lg object-contain"
            />
            <button
              onClick={() => setPhotoPreview(null)}
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-600 shadow-lg hover:bg-gray-100"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
