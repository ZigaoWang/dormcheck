"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerProps {
  onScan: (value: string) => void;
  onError?: (error: string) => void;
}

export function QrScanner({ onScan, onError }: QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const scannerId = "qr-scanner-" + Math.random().toString(36).slice(2);
    containerRef.current.id = scannerId;

    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          scanner.stop().catch(() => {});
          onScan(decodedText);
        },
        () => {}
      )
      .then(() => setStarted(true))
      .catch((err) => {
        onError?.(typeof err === "string" ? err : "Camera access denied");
      });

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan, onError]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg"
        style={{ minHeight: started ? undefined : 250 }}
      />
      {!started && (
        <p className="text-center text-sm text-gray-500">Starting camera...</p>
      )}
    </div>
  );
}
