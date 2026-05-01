"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const HOUSES = ["A", "B", "C", "D", "E", "F", "G", "H"];

interface Config {
  feverThreshold: number;
  lateGraceMinutes: number;
  morningStart: string;
  morningEnd: string;
  morningDeadlineJunior: string;
  morningDeadlineSenior: string;
  studyhallEnd: string;
}

const DEFAULTS: Config = {
  feverThreshold: 37.3,
  lateGraceMinutes: 5,
  morningStart: "06:30",
  morningEnd: "08:00",
  morningDeadlineJunior: "07:15",
  morningDeadlineSenior: "07:30",
  studyhallEnd: "19:15",
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const userHouse = (session?.user as unknown as Record<string, unknown>)?.house as string | null;
  const isAdmin = (session?.user as unknown as Record<string, unknown>)?.isAdmin as boolean | undefined;

  const [house, setHouse] = useState(userHouse || "A");
  const [config, setConfig] = useState<Config>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userHouse && !isAdmin) setHouse(userHouse);
  }, [userHouse, isAdmin]);

  useEffect(() => {
    setLoading(true);
    setMessage(null);
    fetch(`/api/config?house=${house}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.feverThreshold) {
          setConfig({
            feverThreshold: data.feverThreshold,
            lateGraceMinutes: data.lateGraceMinutes,
            morningStart: data.morningStart,
            morningEnd: data.morningEnd,
            morningDeadlineJunior: data.morningDeadlineJunior ?? "07:15",
            morningDeadlineSenior: data.morningDeadlineSenior ?? "07:30",
            studyhallEnd: data.studyhallEnd ?? "19:15",
          });
        } else {
          setConfig(DEFAULTS);
        }
        setLoading(false);
      });
  }, [house]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ house, ...config }),
    });

    if (res.ok) {
      setMessage("Settings saved.");
    } else {
      const data = await res.json();
      setMessage(`Error: ${data.error}`);
    }
    setSaving(false);
  }

  function update(field: keyof Config, value: string | number) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">
        Settings
        <span className="ml-2 text-sm font-normal text-gray-400">
          House {house} · {["A", "B", "C", "D"].includes(house) ? "Girls Dorm" : "Boys Dorm"}
        </span>
      </h1>

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

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading...</p>
      ) : (
        <form onSubmit={handleSave} className="max-w-md space-y-6">
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-gray-500">Thresholds</h2>
            <div className="space-y-1">
              <Label>High temperature (°C)</Label>
              <Input
                type="number"
                step="0.1"
                value={config.feverThreshold}
                onChange={(e) => update("feverThreshold", parseFloat(e.target.value))}
                className="max-w-[120px]"
              />
            </div>
            <div className="space-y-1">
              <Label>Late grace period (minutes)</Label>
              <Input
                type="number"
                value={config.lateGraceMinutes}
                onChange={(e) => update("lateGraceMinutes", parseInt(e.target.value, 10))}
                className="max-w-[120px]"
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-medium text-gray-500">Morning check-out</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Window opens</Label>
                <Input
                  type="time"
                  value={config.morningStart}
                  onChange={(e) => update("morningStart", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Window closes</Label>
                <Input
                  type="time"
                  value={config.morningEnd}
                  onChange={(e) => update("morningEnd", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Year 9-10 deadline</Label>
                <Input
                  type="time"
                  value={config.morningDeadlineJunior}
                  onChange={(e) => update("morningDeadlineJunior", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Year 11-12 deadline</Label>
                <Input
                  type="time"
                  value={config.morningDeadlineSenior}
                  onChange={(e) => update("morningDeadlineSenior", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-medium text-gray-500">Study hall</h2>
            <div className="space-y-1">
              <Label>Deadline</Label>
              <Input
                type="time"
                value={config.studyhallEnd}
                onChange={(e) => update("studyhallEnd", e.target.value)}
                className="max-w-[160px]"
              />
              <p className="text-xs text-gray-400">All students must check in before this time.</p>
            </div>
          </section>

          {message && (
            <p className={cn("text-sm", message.startsWith("Error") ? "text-red-600" : "text-gray-600")}>
              {message}
            </p>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </form>
      )}
    </div>
  );
}
