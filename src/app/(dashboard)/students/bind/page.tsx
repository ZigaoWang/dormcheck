"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Student {
  studentId: string;
  name: string;
  grade: number;
  house: string;
}

export default function BindPage() {
  const [unbound, setUnbound] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchUnbound = useCallback(async () => {
    const res = await fetch("/api/students/unbound");
    const data = await res.json();
    setUnbound(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUnbound();
  }, [fetchUnbound]);

  async function handleBind(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !uid.trim()) return;

    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/students/bind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: selectedId, uid: uid.trim() }),
    });
    const data = await res.json();

    if (data.ok) {
      setMessage(`Card bound to ${selectedId}`);
      setUnbound((prev) => prev.filter((s) => s.studentId !== selectedId));
      setSelectedId("");
      setUid("");
    } else {
      setMessage(`Error: ${data.error}`);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bind Student Cards</h1>
        <p className="text-sm text-gray-500">
          Select a student, then scan or type their NFC card UID
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-500">
            Students Without a Card ({unbound.length})
          </h2>
          {loading ? (
            <p className="py-12 text-center text-gray-400">Loading...</p>
          ) : unbound.length === 0 ? (
            <div className="rounded-lg border bg-white py-12 text-center shadow-sm">
              <p className="text-gray-400">All students have cards bound</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto rounded-lg border bg-white shadow-sm">
              {unbound.map((s) => (
                <button
                  key={s.studentId}
                  onClick={() => setSelectedId(s.studentId)}
                  className={`w-full border-b px-4 py-3 text-left transition-colors last:border-0 ${
                    selectedId === s.studentId
                      ? "bg-blue-50 ring-1 ring-inset ring-blue-200"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-gray-500">
                    {s.studentId} · Year {s.grade} · House {s.house}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Bind a Card</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBind} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Selected Student</Label>
                <Input
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  placeholder="Select from list or type ID (e.g. s12345)"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Card UID</Label>
                <Input
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  placeholder="Scan card or type UID"
                  className="h-10"
                  autoFocus
                />
              </div>
              {message && (
                <div className={`rounded-lg px-3 py-2 text-sm ${
                  message.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                }`}>
                  {message}
                </div>
              )}
              <Button
                type="submit"
                className="h-10 w-full"
                disabled={saving || !selectedId || !uid.trim()}
              >
                {saving ? "Saving..." : "Bind Card"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
