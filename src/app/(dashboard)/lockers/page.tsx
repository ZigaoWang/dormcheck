"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    fetchLockers();
  }, [fetchLockers]);

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
        placeholder="Search by name, ID, or locker number..."
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
                <th className="px-4 py-2.5 font-medium">Phone</th>
                <th className="px-4 py-2.5 font-medium">Laptop</th>
                <th className="px-4 py-2.5 font-medium">iPad</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.studentId} className="border-b last:border-0">
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-gray-400">{s.studentId}</td>
                  <td className="px-4 py-2.5">{s.grade}</td>
                  <td className="px-4 py-2.5">{s.locker?.hasPhone ? <Check /> : <Cross />}</td>
                  <td className="px-4 py-2.5">{s.locker?.hasLaptop ? <Check /> : <Cross />}</td>
                  <td className="px-4 py-2.5">{s.locker?.hasIpad ? <Check /> : <Cross />}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openAssign(s)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {s.locker ? "Edit" : "Set Devices"}
                      </button>
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

      {/* Assign/Edit dialog */}
      {showDialog && editStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">
              {editStudent.locker ? "Edit Devices" : "Set Devices"}
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              {editStudent.name} ({editStudent.studentId})
            </p>
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
              <Button variant="outline" size="sm" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Check() {
  return <span className="text-green-500">&#10003;</span>;
}

function Cross() {
  return <span className="text-gray-200">&#10005;</span>;
}
