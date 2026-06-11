"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Exemption {
  id: number;
  studentId: string;
  deviceType: "phone" | "laptop" | "ipad";
  startDate: string;
  endDate: string;
  note: string | null;
}

interface LockerStudent {
  studentId: string;
  name: string;
  grade: number;
  house: string | null;
  locker: {
    id: number;
    hasPhone: boolean;
    hasLaptop: boolean;
    hasIpad: boolean;
  } | null;
  exemptions: Exemption[];
}

export default function LockersPage() {
  const { data: session } = useSession();
  const userHouse = (session?.user as Record<string, unknown>)?.house as string | null;
  const isAdmin = (session?.user as Record<string, unknown>)?.isAdmin as boolean | undefined;

  const [students, setStudents] = useState<LockerStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editStudent, setEditStudent] = useState<LockerStudent | null>(null);
  const [exemptStudent, setExemptStudent] = useState<LockerStudent | null>(null);
  const [formPhone, setFormPhone] = useState(true);
  const [formLaptop, setFormLaptop] = useState(true);
  const [formIpad, setFormIpad] = useState(false);

  const fetchLockers = useCallback(async () => {
    const house = isAdmin ? "" : userHouse || "";
    const params = house ? `?house=${house}` : "";
    const res = await fetch(`/api/lockers${params}`);
    const data = await res.json();
    setStudents(data);
    setLoading(false);
  }, [isAdmin, userHouse]);

  useEffect(() => { fetchLockers(); }, [fetchLockers]);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId.includes(search)
  );

  const openAssign = (student: LockerStudent) => {
    setEditStudent(student);
    setFormPhone(student.locker?.hasPhone ?? true);
    setFormLaptop(student.locker?.hasLaptop ?? true);
    setFormIpad(student.locker?.hasIpad ?? false);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!editStudent) return;
    await fetch("/api/lockers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: editStudent.studentId,
        hasPhone: formPhone,
        hasLaptop: formLaptop,
        hasIpad: formIpad,
      }),
    });
    setShowDialog(false);
    setEditStudent(null);
    fetchLockers();
  };

  const handleDelete = async (id: number) => {
    await fetch("/api/lockers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchLockers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Lockers</h1>
        <Button variant="outline" size="sm" onClick={() => window.location.href = "/lockers/labels"}>
          Print Labels
        </Button>
      </div>

      <Input
        placeholder="Search by name or ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No Year 9/10 students found.</p>
      ) : (
        <div className="rounded-xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-400">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">ID</th>
                <th className="px-4 py-2.5 font-medium">Year</th>
                <th className="px-4 py-2.5 font-medium">Devices</th>
                <th className="px-4 py-2.5 font-medium">Exemptions</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.studentId} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-gray-400">{s.studentId}</td>
                  <td className="px-4 py-2.5">{s.grade}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {s.locker?.hasPhone && <span className="rounded bg-gray-100 px-1.5 py-0.5">Phone</span>}
                      {s.locker?.hasLaptop && <span className="rounded bg-gray-100 px-1.5 py-0.5">Laptop</span>}
                      {s.locker?.hasIpad && <span className="rounded bg-gray-100 px-1.5 py-0.5">iPad</span>}
                      {!s.locker && <span className="text-gray-300">Not set</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {s.exemptions.length === 0 ? (
                      <span className="text-xs text-gray-300">None</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 text-xs">
                        {s.exemptions.map((e) => (
                          <span
                            key={e.id}
                            className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700"
                            title={`${e.startDate} → ${e.endDate}${e.note ? `\n${e.note}` : ""}`}
                          >
                            {e.deviceType}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-3">
                      <button
                        onClick={() => openAssign(s)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {s.locker ? "Edit" : "Set Devices"}
                      </button>
                      {s.locker && (
                        <button
                          onClick={() => setExemptStudent(s)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Exempt
                        </button>
                      )}
                      {s.locker && (
                        <button
                          onClick={() => handleDelete(s.locker!.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDialog && editStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">{editStudent.locker ? "Edit Devices" : "Set Devices"}</h2>
            <p className="mb-4 text-sm text-gray-500">{editStudent.name} ({editStudent.studentId})</p>
            <div className="space-y-2">
              <label className="block text-sm text-gray-500">Devices to hand in</label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formPhone} onChange={(e) => setFormPhone(e.target.checked)} />
                Phone
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formLaptop} onChange={(e) => setFormLaptop(e.target.checked)} />
                Laptop
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formIpad} onChange={(e) => setFormIpad(e.target.checked)} />
                iPad
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {exemptStudent && (
        <ExemptionEditor
          student={exemptStudent}
          onClose={() => setExemptStudent(null)}
          onSaved={() => { setExemptStudent(null); fetchLockers(); }}
        />
      )}
    </div>
  );
}

function ExemptionEditor({
  student,
  onClose,
  onSaved,
}: {
  student: LockerStudent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [deviceType, setDeviceType] = useState<"phone" | "laptop" | "ipad">(
    student.locker?.hasPhone ? "phone" : student.locker?.hasLaptop ? "laptop" : "ipad"
  );
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    if (startDate > endDate) { setError("Start date must be before end date"); return; }
    setSubmitting(true); setError("");
    const res = await fetch("/api/exemptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: student.studentId, deviceType, startDate, endDate, note }),
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
            <p className="text-sm text-gray-500">{student.name} · {student.studentId}</p>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-700">&times;</button>
        </div>

        {student.exemptions.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase text-gray-400">Active</p>
            {student.exemptions.map((e) => (
              <div key={e.id} className="flex items-start justify-between rounded-lg border bg-blue-50 px-3 py-2">
                <div className="text-sm">
                  <p className="font-medium capitalize">{e.deviceType}</p>
                  <p className="text-xs text-gray-600">{e.startDate} → {e.endDate}</p>
                  {e.note && <p className="text-xs text-gray-700 mt-0.5">{e.note}</p>}
                </div>
                <button onClick={() => remove(e.id)} disabled={submitting} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 space-y-3 border-t pt-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Add new</p>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Device</label>
            <select
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value as "phone" | "laptop" | "ipad")}
              className="h-9 w-full rounded-md border px-3 text-sm"
            >
              {student.locker?.hasPhone && <option value="phone">Phone</option>}
              {student.locker?.hasLaptop && <option value="laptop">Laptop</option>}
              {student.locker?.hasIpad && <option value="ipad">iPad</option>}
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
              {submitting ? "Saving..." : "Add"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
