"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import Link from "next/link";

const HOUSES = ["A", "B", "C", "D", "E", "F", "G", "H"];

interface Student {
  studentId: string;
  name: string;
  grade: number;
  house: string | null;
  uid: string | null;
  isActive: boolean;
}

export default function StudentsPage() {
  const { data: session } = useSession();
  const userHouse = (session?.user as unknown as Record<string, unknown>)?.house as string | null;
  const isAdmin = (session?.user as unknown as Record<string, unknown>)?.isAdmin as boolean | undefined;

  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewAll, setViewAll] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ studentId: "", name: "", grade: "9", house: userHouse || "A" });
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ name: "", grade: "", house: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userHouse) setAddForm((f) => ({ ...f, house: userHouse }));
  }, [userHouse]);

  const fetchStudents = useCallback(async () => {
    const params = new URLSearchParams();
    if (viewAll) {
      params.set("all", "true");
    } else if (!isAdmin && userHouse) {
      params.set("house", userHouse);
    }
    const res = await fetch(`/api/students/list?${params}`);
    const data = await res.json();
    setStudents(data);
    setLoading(false);
  }, [userHouse, isAdmin, viewAll]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase()) ||
      (s.house ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setImporting(true);
    setImportResult(null);
    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/students/import", { method: "POST", body: formData });
    const data = await res.json();
    if (data.ok) {
      setImportResult(`Imported ${data.imported} students.${data.errors ? ` ${data.errors.length} rows had errors.` : ""}`);
      fetchStudents();
    } else {
      setImportResult(`Error: ${data.error}`);
    }
    setImporting(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    const res = await fetch("/api/students/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: addForm.studentId,
        name: addForm.name,
        grade: parseInt(addForm.grade, 10),
        house: addForm.house,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setAddOpen(false);
      setAddForm({ studentId: "", name: "", grade: "9", house: userHouse || "A" });
      fetchStudents();
    } else {
      setAddError(data.error);
    }
    setAdding(false);
  }

  function openEdit(s: Student) {
    setEditStudent(s);
    setEditForm({ name: s.name, grade: String(s.grade), house: s.house ?? "" });
    setEditError(null);
    setEditOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editStudent) return;
    setSaving(true);
    setEditError(null);
    const res = await fetch("/api/students/list", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: editStudent.studentId,
        name: editForm.name,
        grade: parseInt(editForm.grade, 10),
        house: editForm.house,
      }),
    });
    const data = await res.json();
    if (data.error) {
      setEditError(data.error);
    } else {
      setEditOpen(false);
      fetchStudents();
    }
    setSaving(false);
  }

  async function handleDelete(studentId: string) {
    if (!confirm("Remove this student?")) return;
    await fetch("/api/students/list", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    fetchStudents();
  }

  async function handleAssignToMyHouse(studentId: string) {
    const res = await fetch("/api/students/list", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, house: userHouse }),
    });
    if (res.ok) fetchStudents();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Students</h1>
          <div className="flex rounded-md border text-sm overflow-hidden">
            <button
              onClick={() => setViewAll(false)}
              className={cn("px-3 py-1", !viewAll ? "bg-gray-100 font-medium" : "text-gray-400")}
            >
              My House
            </button>
            <button
              onClick={() => setViewAll(true)}
              className={cn("px-3 py-1 border-l", viewAll ? "bg-gray-100 font-medium" : "text-gray-400")}
            >
              All Students
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogTrigger render={<Button variant="outline" size="sm" />}>
                  Import CSV
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Students (TSV or CSV)</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleImport} className="space-y-4">
                    <p className="text-sm text-gray-500">
                      Accepts TSV (student_id, name, grade) or CSV (student_id, name, grade, house).
                    </p>
                    <Input type="file" name="file" accept=".csv,.tsv,.txt" required />
                    {importResult && (
                      <p className={cn("text-sm", importResult.startsWith("Error") ? "text-red-600" : "text-gray-600")}>
                        {importResult}
                      </p>
                    )}
                    <Button type="submit" disabled={importing} className="w-full">
                      {importing ? "Importing..." : "Upload & Import"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger render={<Button size="sm" />}>
                  Add Student
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Student</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAdd} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Student ID</Label>
                      <Input
                        value={addForm.studentId}
                        onChange={(e) => setAddForm({ ...addForm, studentId: e.target.value })}
                        placeholder="22341"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={addForm.name}
                        onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Grade</Label>
                        <select
                          value={addForm.grade}
                          onChange={(e) => setAddForm({ ...addForm, grade: e.target.value })}
                          className="h-9 w-full rounded-md border px-3 text-sm"
                        >
                          {[9, 10, 11, 12].map((g) => (
                            <option key={g} value={g}>Year {g}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>House</Label>
                        <select
                          value={addForm.house}
                          onChange={(e) => setAddForm({ ...addForm, house: e.target.value })}
                          className="h-9 w-full rounded-md border px-3 text-sm"
                        >
                          {HOUSES.map((h) => (
                            <option key={h} value={h}>House {h}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {addError && <p className="text-sm text-red-600">{addError}</p>}
                    <Button type="submit" disabled={adding} className="w-full">
                      {adding ? "Adding..." : "Add Student"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Link href="/students/bind">
            <Button variant="outline" size="sm">Bind Cards</Button>
          </Link>
        </div>
      </div>

      <Input
        placeholder="Search by name, ID, or house..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading...</p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-400">
                <th className="px-3 py-2 font-normal">ID</th>
                <th className="px-3 py-2 font-normal">Name</th>
                <th className="px-3 py-2 font-normal">Year</th>
                <th className="px-3 py-2 font-normal">House</th>
                <th className="px-3 py-2 font-normal">Card</th>
                <th className="px-3 py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.studentId} className="border-b last:border-0">
                  <td className="px-3 py-2 text-gray-400">{s.studentId}</td>
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2">Y{s.grade}</td>
                  <td className="px-3 py-2">
                    {s.house ? `House ${s.house}` : <span className="text-amber-500 text-xs">Unassigned</span>}
                  </td>
                  <td className="px-3 py-2">
                    {s.uid ? (
                      <span className="text-green-600 text-xs">Bound</span>
                    ) : (
                      <span className="text-gray-300 text-xs">No card</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {viewAll && !isAdmin && s.house !== userHouse ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAssignToMyHouse(s.studentId)}
                          disabled={s.house !== null && s.house !== userHouse}
                          title={s.house && s.house !== userHouse ? "Already assigned to another house" : ""}
                        >
                          {s.house && s.house !== userHouse ? "Other House" : "Add to My House"}
                        </Button>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                            Edit
                          </Button>
                          {isAdmin && (
                            <Button variant="outline" size="sm" onClick={() => handleDelete(s.studentId)}>
                              Delete
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-400">
                    {search ? "No students match your search." : "No students found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student — {editStudent?.studentId}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Grade</Label>
                <select
                  value={editForm.grade}
                  onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                  className="h-9 w-full rounded-md border px-3 text-sm"
                >
                  {[9, 10, 11, 12].map((g) => (
                    <option key={g} value={g}>Year {g}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>House</Label>
                {isAdmin ? (
                  <select
                    value={editForm.house}
                    onChange={(e) => setEditForm({ ...editForm, house: e.target.value })}
                    className="h-9 w-full rounded-md border px-3 text-sm"
                  >
                    {HOUSES.map((h) => (
                      <option key={h} value={h}>House {h}</option>
                    ))}
                  </select>
                ) : (
                  <Input value={`House ${editForm.house}`} disabled />
                )}
              </div>
            </div>
            {editError && <p className="text-sm text-red-600">{editError}</p>}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
