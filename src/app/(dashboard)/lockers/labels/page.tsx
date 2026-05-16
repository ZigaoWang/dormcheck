"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface LockerStudent {
  studentId: string;
  name: string;
  grade: number;
  house: string | null;
  locker: {
    hasPhone: boolean;
    hasLaptop: boolean;
    hasIpad: boolean;
  } | null;
}

export default function LabelsPage() {
  const { data: session } = useSession();
  const userHouse = (session?.user as Record<string, unknown>)?.house as string | null;
  const isAdmin = (session?.user as Record<string, unknown>)?.isAdmin as boolean | undefined;

  const [students, setStudents] = useState<LockerStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLockers = useCallback(async () => {
    const house = isAdmin ? "" : userHouse || "";
    const params = house ? `?house=${house}` : "";
    const res = await fetch(`/api/lockers${params}`);
    const data = await res.json();
    setStudents(data.filter((s: LockerStudent) => s.locker));
    setLoading(false);
  }, [isAdmin, userHouse]);

  useEffect(() => {
    fetchLockers();
  }, [fetchLockers]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-gray-400">Loading...</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">Locker Labels</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.history.back()}>
            Back
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            Print All
          </Button>
        </div>
      </div>

      {students.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400 print:hidden">
          No locker assignments found. Assign lockers first.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
          {students.map((s) => (
            <div
              key={s.studentId}
              className="break-inside-avoid rounded-lg border border-gray-300 p-4 print:rounded-none print:border-black print:p-3"
            >
              <div className="mb-2 text-center">
                <p className="text-lg font-bold leading-tight">{s.name}</p>
                <p className="text-xs text-gray-500">
                  Year {s.grade}
                </p>
              </div>

              <div className="mb-2 flex justify-center gap-2">
                {s.locker!.hasPhone && (
                  <span className="rounded border px-2 py-0.5 text-xs font-medium">Phone</span>
                )}
                {s.locker!.hasLaptop && (
                  <span className="rounded border px-2 py-0.5 text-xs font-medium">Laptop</span>
                )}
                {s.locker!.hasIpad && (
                  <span className="rounded border px-2 py-0.5 text-xs font-medium">iPad</span>
                )}
              </div>

              <div className="flex flex-col items-center">
                <BarcodeDisplay value={s.studentId} />
                <p className="mt-1 text-xs font-mono tracking-wider">{s.studentId}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BarcodeDisplay({ value }: { value: string }) {
  const bars = encodeCode128(value);
  const barWidth = 1.5;
  const height = 40;
  const width = bars.length * barWidth;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {bars.map((bar, i) => (
        bar === "1" ? (
          <rect key={i} x={i * barWidth} y={0} width={barWidth} height={height} fill="black" />
        ) : null
      ))}
    </svg>
  );
}

const CODE128_PATTERNS: Record<number, string> = {
  0: "11011001100", 1: "11001101100", 2: "11001100110", 3: "10010011000",
  4: "10010001100", 5: "10001001100", 6: "10011001000", 7: "10011000100",
  8: "10001100100", 9: "11001001000", 10: "11001000100", 11: "11000100100",
  12: "10110011100", 13: "10011011100", 14: "10011001110", 15: "10111001100",
  16: "10011101100", 17: "10011100110", 18: "11001110010", 19: "11001011100",
  20: "11001001110", 21: "11011100100", 22: "11001110100", 23: "11101101110",
  24: "11101001100", 25: "11100101100", 26: "11100100110", 27: "11101100100",
  28: "11100110100", 29: "11100110010", 30: "11011011000", 31: "11011000110",
  32: "11000110110", 33: "10100011000", 34: "10001011000", 35: "10001000110",
  36: "10110001000", 37: "10001101000", 38: "10001100010", 39: "11010001000",
  40: "11000101000", 41: "11000100010", 42: "10110111000", 43: "10110001110",
  44: "10001101110", 45: "10111011000", 46: "10111000110", 47: "10001110110",
  48: "11101110110", 49: "11010001110", 50: "11000101110", 51: "11011101000",
  52: "11011100010", 53: "11011101110", 54: "11101011000", 55: "11101000110",
  56: "11100010110", 57: "11101101000", 58: "11101100010", 59: "11100011010",
  60: "11101111010", 61: "11001000010", 62: "11110001010", 63: "10100110000",
  64: "10100001100", 65: "10010110000", 66: "10010000110", 67: "10000101100",
  68: "10000100110", 69: "10110010000", 70: "10110000100", 71: "10011010000",
  72: "10011000010", 73: "10000110100", 74: "10000110010", 75: "11000010010",
  76: "11001010000", 77: "11110111010", 78: "11000010100", 79: "10001111010",
  80: "10100111100", 81: "10010111100", 82: "10010011110", 83: "10111100100",
  84: "10011110100", 85: "10011110010", 86: "11110100100", 87: "11110010100",
  88: "11110010010", 89: "11011011110", 90: "11011110110", 91: "11110110110",
  92: "10101111000", 93: "10100011110", 94: "10001011110", 95: "10111101000",
  96: "10111100010", 97: "11110101000", 98: "11110100010", 99: "10111011110",
  100: "10111101110", 101: "11101011110", 102: "11110101110",
  103: "11010000100", 104: "11010010000", 105: "11010011100",
};

const STOP = "1100011101011";

function encodeCode128(text: string): string[] {
  const startCode = 104; // Start Code B
  let checksum = startCode;
  let result = CODE128_PATTERNS[startCode];

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    checksum += code * (i + 1);
    result += CODE128_PATTERNS[code];
  }

  result += CODE128_PATTERNS[checksum % 103];
  result += STOP;

  return result.split("");
}
