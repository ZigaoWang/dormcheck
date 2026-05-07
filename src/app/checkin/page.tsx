"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrScanner } from "@/components/qr-scanner";
import { BarcodeScanner } from "@/components/barcode-scanner";

interface CheckinResult {
  ok: boolean;
  student_id?: string;
  name?: string;
  grade?: number;
  is_late?: boolean;
  is_fever?: boolean;
  message?: string;
}

interface DeviceInfo {
  id: string;
  name: string;
  house: string | null;
}

type Phase = "scanning" | "temperature" | "result";

export default function CheckinPage() {
  const [apiKey, setApiKey] = useState("");
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupScanning, setSetupScanning] = useState(false);
  const [checkType, setCheckType] = useState<"morning" | "studyhall">("morning");

  const [phase, setPhase] = useState<Phase>("scanning");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [temperature, setTemperature] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [history, setHistory] = useState<CheckinResult[]>([]);
  const [successCount, setSuccessCount] = useState(0);

  const temperatureRef = useRef<HTMLInputElement>(null);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem("dormcheck_api_key");
    if (savedKey) {
      setApiKey(savedKey);
      verifyKey(savedKey);
    }
  }, []);

  async function verifyKey(key: string) {
    setSetupLoading(true);
    setSetupError(null);
    try {
      const res = await fetch("/api/devices/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json();
      if (data.ok) {
        setDevice(data.device);
        setApiKey(key);
        localStorage.setItem("dormcheck_api_key", key);
      } else {
        setSetupError(data.message || "Invalid API key");
        setDevice(null);
        localStorage.removeItem("dormcheck_api_key");
      }
    } catch {
      setSetupError("Network error");
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    const input = (e.currentTarget as HTMLFormElement).elements.namedItem("key") as HTMLInputElement;
    const key = input.value.trim();
    if (!key) return;
    await verifyKey(key);
  }

  const submitCheckin = useCallback(async (sid: string, temp: string) => {
    if (!sid.trim() || !temp.trim() || !apiKey) return;

    setLoading(true);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-API-Key": apiKey,
        },
        body: JSON.stringify({
          student_id: sid.trim(),
          temperature: parseFloat(temp),
          check_type: checkType,
        }),
      });
      const data = await res.json();
      setResult(data);
      setPhase("result");
      if (data.ok) {
        setHistory((prev) => [data, ...prev].slice(0, 50));
        setSuccessCount((c) => c + 1);
      }

      resultTimeoutRef.current = setTimeout(() => {
        resetForNext();
      }, 2500);
    } catch {
      setResult({ ok: false, message: "Network error" });
      setPhase("result");
      resultTimeoutRef.current = setTimeout(() => {
        resetForNext();
      }, 2500);
    } finally {
      setLoading(false);
    }
  }, [apiKey, checkType]);

  function resetForNext() {
    if (resultTimeoutRef.current) {
      clearTimeout(resultTimeoutRef.current);
    }
    setStudentId("");
    setStudentName("");
    setTemperature("");
    setResult(null);
    setPhase("scanning");
  }

  async function handleBarcodeScan(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 5);
    if (digits.length === 5) {
      setStudentId(digits);
      setStudentName("");
      setPhase("temperature");
      setTimeout(() => temperatureRef.current?.focus(), 100);
      try {
        const res = await fetch(`/api/students/list?search=${digits}`, {
          headers: { "X-Device-API-Key": apiKey },
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setStudentName(data[0].name);
      } catch {}
    }
  }

  function handleTemperatureSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!temperature.trim()) return;
    submitCheckin(studentId, temperature);
  }

  // Device setup screen
  if (!device) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-center text-base">DormCheck Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {setupLoading && (
              <p className="py-4 text-center text-sm text-gray-400">Verifying...</p>
            )}

            {setupError && (
              <p className="text-center text-sm text-red-600">{setupError}</p>
            )}

            {!setupLoading && (
              <form onSubmit={handleSetup} className="space-y-3">
                <div className="space-y-1">
                  <Label>API Key</Label>
                  <Input name="key" placeholder="dk_..." defaultValue={apiKey} autoFocus />
                </div>
                <Button type="submit" className="w-full" disabled={setupLoading}>
                  Connect
                </Button>
              </form>
            )}

            {setupScanning && !setupLoading && (
              <div className="space-y-2">
                <p className="text-center text-sm text-gray-400">
                  Point camera at the QR code from Devices page
                </p>
                <QrScanner
                  onScan={(value) => {
                    setSetupScanning(false);
                    verifyKey(value);
                  }}
                  onError={() => {
                    setSetupScanning(false);
                  }}
                />
              </div>
            )}

            {!setupLoading && (
              <button
                type="button"
                onClick={() => setSetupScanning(!setupScanning)}
                className="block w-full text-center text-xs text-gray-400 hover:text-gray-600"
              >
                {setupScanning ? "Hide QR scanner" : "Or scan QR code"}
              </button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main check-in screen — full screen camera
  return (
    <div className="fixed inset-0 bg-black">
      {/* Camera feed — always running */}
      <BarcodeScanner onScan={handleBarcodeScan} paused={phase !== "scanning"} />

      {/* Top bar overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 pt-[env(safe-area-inset-top,12px)] pb-8 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">DormCheck</h1>
          <p className="text-xs text-white/50">
            {device.name}{device.house && ` · House ${device.house}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {successCount > 0 && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-green-400 backdrop-blur-sm">
              {successCount}
            </span>
          )}
          <div className="flex gap-0.5 rounded-full bg-white/10 p-0.5 backdrop-blur-sm">
            <button
              onClick={() => setCheckType("morning")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                checkType === "morning" ? "bg-white text-black shadow-sm" : "text-white/70"
              }`}
            >
              Morning
            </button>
            <button
              onClick={() => setCheckType("studyhall")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                checkType === "studyhall" ? "bg-white text-black shadow-sm" : "text-white/70"
              }`}
            >
              Study Hall
            </button>
          </div>
        </div>
      </div>

      {/* Bottom bar — recent history */}
      {phase === "scanning" && (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-5 pt-12 pb-[env(safe-area-inset-bottom,16px)]">
          {history.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {history.slice(0, 3).map((h, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-white/80 font-medium">{h.name} <span className="text-white/30 font-normal">{h.student_id}</span></span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    h.is_fever ? "bg-red-500/20 text-red-400" : h.is_late ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"
                  }`}>
                    {h.is_fever ? "Fever" : h.is_late ? "Late" : "OK"}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/30">Scan student barcode</p>
            <button
              onClick={() => {
                localStorage.removeItem("dormcheck_api_key");
                setApiKey("");
                setDevice(null);
                setHistory([]);
                setSuccessCount(0);
              }}
              className="text-xs text-white/20 hover:text-white/50 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Temperature — full screen */}
      {phase === "temperature" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white px-8 animate-in fade-in duration-150">
          <p className="text-5xl font-bold tracking-tight">{studentName || studentId}</p>
          {studentName && <p className="mt-2 text-xl font-mono text-gray-400">{studentId}</p>}
          <form onSubmit={handleTemperatureSubmit} className="mt-10 w-full max-w-xs space-y-5">
            <Input
              ref={temperatureRef}
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder="36.5"
              type="number"
              step="0.1"
              inputMode="decimal"
              className="h-24 w-full text-center font-mono border-0 border-b-4 border-gray-200 rounded-none shadow-none focus-visible:ring-0 focus-visible:border-black placeholder:text-gray-200 bg-transparent"
              style={{ fontSize: "4rem" }}
              autoFocus
              required
            />
            <Button type="submit" className="h-14 w-full rounded-xl text-lg" disabled={loading || !temperature.trim()}>
              {loading ? "Submitting..." : "Check In"}
            </Button>
          </form>
          <button type="button" onClick={resetForNext} className="mt-8 text-sm text-gray-300">Cancel</button>
        </div>
      )}

      {/* Result — same layout as temperature, just colored */}
      {phase === "result" && result && (
        <div
          className={`absolute inset-0 z-30 flex flex-col items-center justify-center px-8 animate-in fade-in duration-150 ${
            result.ok && !result.is_fever && !result.is_late ? "bg-green-600"
            : result.ok && result.is_late ? "bg-orange-600"
            : "bg-red-600"
          }`}
          onClick={resetForNext}
        >
          <p className="text-5xl font-bold tracking-tight text-white">{result.name || result.student_id}</p>
          {result.name && <p className="mt-2 text-xl font-mono text-white/60">{result.student_id}</p>}
          <p className="mt-6 text-2xl font-semibold text-white/90">{result.message}</p>
          <p className="mt-10 text-sm text-white/40">Tap anywhere</p>
        </div>
      )}
    </div>
  );
}
