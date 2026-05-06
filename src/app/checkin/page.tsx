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
    setTemperature("");
    setResult(null);
    setPhase("scanning");
  }

  function handleBarcodeScan(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 5);
    if (digits.length === 5) {
      setStudentId(digits);
      setPhase("temperature");
      setTimeout(() => temperatureRef.current?.focus(), 100);
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
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-4">
        <div>
          <h1 className="text-lg font-semibold text-white">DormCheck</h1>
          <p className="text-xs text-white/60">
            {device.name}{device.house && ` · House ${device.house}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {successCount > 0 && (
            <span className="rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-medium text-green-300">
              {successCount}
            </span>
          )}
          <div className="flex gap-1">
            <button
              onClick={() => setCheckType("morning")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                checkType === "morning"
                  ? "bg-white text-black"
                  : "bg-white/20 text-white"
              }`}
            >
              Morning
            </button>
            <button
              onClick={() => setCheckType("studyhall")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                checkType === "studyhall"
                  ? "bg-white text-black"
                  : "bg-white/20 text-white"
              }`}
            >
              Study Hall
            </button>
          </div>
        </div>
      </div>

      {/* Bottom bar — recent history */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-4 pt-8 pb-4">
        {phase === "scanning" && history.length > 0 && (
          <div className="space-y-1">
            {history.slice(0, 3).map((h, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-white/80">{h.name} <span className="text-white/40">{h.student_id}</span></span>
                <span className={
                  h.is_fever ? "text-red-400" : h.is_late ? "text-yellow-400" : "text-green-400"
                }>
                  {h.is_fever ? "Fever" : h.is_late ? "Late" : "OK"}
                </span>
              </div>
            ))}
          </div>
        )}
        {phase === "scanning" && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-white/40">Scan student barcode</p>
            <button
              onClick={() => {
                localStorage.removeItem("dormcheck_api_key");
                setApiKey("");
                setDevice(null);
                setHistory([]);
                setSuccessCount(0);
              }}
              className="text-xs text-white/30 hover:text-white/60"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Center scan indicator */}
      {phase === "scanning" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-32 w-64 rounded-lg border-2 border-white/30" />
        </div>
      )}

      {/* Temperature popup */}
      {phase === "temperature" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 text-center">
              <p className="text-sm text-gray-500">Student ID</p>
              <p className="text-2xl font-bold font-mono">{studentId}</p>
            </div>

            <form onSubmit={handleTemperatureSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Temperature (°C)</Label>
                <Input
                  ref={temperatureRef}
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="36.5"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  className="h-14 text-center text-2xl"
                  autoFocus
                  required
                />
              </div>

              <Button
                type="submit"
                className="h-12 w-full text-base"
                disabled={loading || !temperature.trim()}
              >
                {loading ? "Submitting..." : "Submit"}
              </Button>

              <button
                type="button"
                onClick={resetForNext}
                className="block w-full text-center text-sm text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Result popup */}
      {phase === "result" && result && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={resetForNext}
        >
          <div
            className={`mx-4 w-full max-w-sm rounded-2xl p-8 text-center shadow-2xl ${
              result.ok && !result.is_fever && !result.is_late
                ? "bg-green-50"
                : result.ok && result.is_late
                  ? "bg-yellow-50"
                  : "bg-red-50"
            }`}
          >
            {result.ok ? (
              <>
                <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full ${
                  result.is_fever ? "bg-red-100" : result.is_late ? "bg-yellow-100" : "bg-green-100"
                }`}>
                  {result.is_fever ? (
                    <span className="text-2xl">🌡️</span>
                  ) : result.is_late ? (
                    <span className="text-2xl">⏰</span>
                  ) : (
                    <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <p className="text-xl font-bold">{result.name}</p>
                <p className="text-sm text-gray-500">
                  {result.student_id} · Year {result.grade}
                </p>
                <p className={`mt-2 text-sm font-semibold ${
                  result.is_fever ? "text-red-600" : result.is_late ? "text-yellow-700" : "text-green-600"
                }`}>
                  {result.message}
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-red-600">{result.message}</p>
              </>
            )}
            <p className="mt-4 text-xs text-gray-400">Tap anywhere or wait...</p>
          </div>
        </div>
      )}
    </div>
  );
}
