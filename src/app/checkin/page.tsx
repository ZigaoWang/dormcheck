"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { QrScanner } from "@/components/qr-scanner";

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
  const [manualId, setManualId] = useState("");

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
      resultTimeoutRef.current = setTimeout(resetForNext, 2500);
    } catch {
      setResult({ ok: false, message: "Network error" });
      setPhase("result");
      resultTimeoutRef.current = setTimeout(resetForNext, 2500);
    } finally {
      setLoading(false);
    }
  }, [apiKey, checkType]);

  function resetForNext() {
    if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
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

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = manualId.trim().replace(/\D/g, "").slice(0, 5);
    if (val.length === 5) {
      handleBarcodeScan(val);
      setManualId("");
    }
  }

  // Setup screen
  if (!device) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gray-50 px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">DormCheck</h1>
            <p className="mt-1 text-sm text-gray-500">Enter your device key to connect</p>
          </div>

          {setupError && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-600">
              {setupError}
            </div>
          )}

          {!setupLoading ? (
            <form onSubmit={handleSetup} className="space-y-3">
              <input
                name="key"
                placeholder="dk_..."
                defaultValue={apiKey}
                autoFocus
                className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-center text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <button type="submit" className="h-12 w-full rounded-xl bg-blue-500 font-semibold text-white active:bg-blue-600">
                Connect
              </button>
            </form>
          ) : (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
            </div>
          )}

          {setupScanning && !setupLoading && (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <QrScanner
                onScan={(value) => { setSetupScanning(false); verifyKey(value); }}
                onError={() => setSetupScanning(false)}
              />
            </div>
          )}

          {!setupLoading && (
            <button
              type="button"
              onClick={() => setSetupScanning(!setupScanning)}
              className="block w-full text-center text-sm text-blue-500"
            >
              {setupScanning ? "Hide scanner" : "Scan QR code instead"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Main screen
  return (
    <div className="fixed inset-0 bg-black">
      <BarcodeScanner onScan={handleBarcodeScan} paused={phase !== "scanning"} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 px-5 pt-[env(safe-area-inset-top,12px)] pb-6 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">{device.name}</p>
            {successCount > 0 && (
              <p className="text-xs text-white/50">{successCount} checked in</p>
            )}
          </div>
          <div className="flex rounded-full bg-white/15 p-0.5 backdrop-blur">
            <button
              onClick={() => setCheckType("morning")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                checkType === "morning" ? "bg-white text-black" : "text-white/70"
              }`}
            >
              Morning
            </button>
            <button
              onClick={() => setCheckType("studyhall")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                checkType === "studyhall" ? "bg-white text-black" : "text-white/70"
              }`}
            >
              Study Hall
            </button>
          </div>
        </div>
      </div>

      {/* Scanning — bottom input */}
      {phase === "scanning" && (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center px-5 pb-[env(safe-area-inset-bottom,20px)]">
          <form onSubmit={handleManualSubmit}>
            <input
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="Student ID"
              inputMode="numeric"
              maxLength={5}
              className="h-11 w-44 rounded-full bg-black/50 px-4 text-center text-sm font-mono text-white placeholder:text-white/40 outline-none backdrop-blur focus:ring-2 focus:ring-white/30"
            />
          </form>
          <div className="mt-2 flex items-center gap-4">
            <span className="text-[11px] text-white/30">or scan barcode</span>
            <button
              onClick={() => {
                localStorage.removeItem("dormcheck_api_key");
                setApiKey("");
                setDevice(null);
                setHistory([]);
                setSuccessCount(0);
              }}
              className="text-[11px] text-white/20 active:text-white/40"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Temperature */}
      {phase === "temperature" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white px-8 animate-in fade-in duration-150">
          <div className="text-center">
            <p className="text-4xl font-bold text-gray-900 tracking-tight">
              {studentName || studentId}
            </p>
            {studentName && (
              <p className="mt-2 text-lg font-mono text-gray-400">{studentId}</p>
            )}
          </div>

          <form onSubmit={handleTemperatureSubmit} className="mt-12 w-full max-w-[280px] space-y-6">
            <div className="relative">
              <input
                ref={temperatureRef}
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                placeholder="36.5"
                type="number"
                step="0.1"
                inputMode="decimal"
                required
                className="h-24 w-full bg-transparent text-center font-mono text-gray-900 outline-none placeholder:text-gray-200 border-b-2 border-gray-200 focus:border-blue-500 transition-colors"
                style={{ fontSize: "4rem" }}
              />
              <span className="absolute right-0 bottom-4 text-2xl text-gray-300">°C</span>
            </div>
            <button
              type="submit"
              disabled={loading || !temperature.trim()}
              className="h-14 w-full rounded-2xl bg-blue-500 font-semibold text-white text-lg disabled:opacity-30 active:bg-blue-600 transition-colors"
            >
              {loading ? "..." : "Check In"}
            </button>
          </form>

          <button type="button" onClick={resetForNext} className="mt-8 text-sm text-gray-400 active:text-gray-600">
            Cancel
          </button>
        </div>
      )}

      {/* Result */}
      {phase === "result" && result && (
        <div
          className={`absolute inset-0 z-30 flex flex-col items-center justify-center px-8 ${
            result.ok && !result.is_fever && !result.is_late ? "bg-green-600"
            : result.ok && result.is_late ? "bg-orange-600"
            : "bg-red-600"
          }`}
          onClick={resetForNext}
        >
          <p className="text-5xl font-bold text-white tracking-tight">
            {result.name || result.student_id}
          </p>
          {result.name && (
            <p className="mt-3 text-xl font-mono text-white/60">{result.student_id}</p>
          )}
          <p className="mt-6 text-2xl text-white/90">{result.message}</p>
        </div>
      )}
    </div>
  );
}
