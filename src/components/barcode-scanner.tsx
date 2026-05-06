"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface BarcodeScannerProps {
  onScan: (value: string) => void;
  paused?: boolean;
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playBeep() {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = "square";
    oscillator.frequency.value = 1800;
    gain.gain.value = 0.4;
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    oscillator.stop(ctx.currentTime + 0.12);
  } catch {
    // Audio not available
  }
}

function warmUpAudio() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0;
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
  } catch {
    // ignore
  }
}

export function BarcodeScanner({ onScan, paused = false }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const lastScanRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const handleDecode = useCallback((value: string) => {
    if (pausedRef.current) return;
    const now = Date.now();
    if (value === lastScanRef.current && now - lastScanTimeRef.current < 3000) {
      return;
    }
    lastScanRef.current = value;
    lastScanTimeRef.current = now;
    playBeep();
    if (navigator.vibrate) navigator.vibrate(100);
    onScanRef.current(value);
  }, []);

  useEffect(() => {
    const handler = () => warmUpAudio();
    document.addEventListener("touchstart", handler, { once: true });
    document.addEventListener("click", handler, { once: true });

    const isSecureContext =
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!isSecureContext) {
      setError("Camera requires HTTPS or localhost. Open http://localhost:3000/checkin instead.");
      return;
    }

    if (!("BarcodeDetector" in window)) {
      setError("BarcodeDetector not supported. Use Chrome, Edge, or Safari.");
      return;
    }

    let cancelled = false;

    // @ts-expect-error BarcodeDetector is not in all TS libs
    const detector = new BarcodeDetector({
      formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "codabar", "itf"],
    });

    async function startScanning() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStarted(true);
          setError(null);
          detect();
        }
      } catch (err: unknown) {
        const msg = (err as Error)?.message ?? "";
        if (msg.includes("Permission") || msg.includes("NotAllowed")) {
          setError("Camera permission denied. Allow camera access and reload.");
        } else if (msg.includes("NotFound")) {
          setError("No camera found.");
        } else {
          setError(`Camera error: ${msg || "Unknown"}`);
        }
      }
    }

    async function detect() {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          handleDecode(barcodes[0].rawValue);
        }
      } catch {
        // continue
      }

      animFrameRef.current = requestAnimationFrame(detect);
    }

    startScanning();

    return () => {
      cancelled = true;
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("click", handler);
      cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [handleDecode, retryCount]);

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gray-900 px-4 text-center text-sm text-gray-400">
        <p>{error}</p>
        <button
          onClick={() => {
            setError(null);
            setStarted(false);
            setRetryCount((c) => c + 1);
          }}
          className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        playsInline
        muted
      />
      {!started && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Starting camera...
          </div>
        </div>
      )}
    </>
  );
}
