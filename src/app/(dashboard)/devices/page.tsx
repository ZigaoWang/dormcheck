"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { QRCodeSVG } from "qrcode.react";
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

const HOUSES = ["A", "B", "C", "D", "E", "F", "G", "H"];

interface Device {
  id: string;
  name: string;
  house: string | null;
  lastSeen: string | null;
  isActive: boolean;
}

export default function DevicesPage() {
  const { data: session } = useSession();
  const userHouse = (session?.user as unknown as Record<string, unknown>)?.house as string | null;
  const isAdmin = (session?.user as unknown as Record<string, unknown>)?.isAdmin as boolean | undefined;

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHouse, setNewHouse] = useState(userHouse || "");
  const [creating, setCreating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [editName, setEditName] = useState("");
  const [editHouse, setEditHouse] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (userHouse) setNewHouse(userHouse);
  }, [userHouse]);

  const fetchDevices = useCallback(async () => {
    const res = await fetch("/api/devices");
    const data = await res.json();
    setDevices(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, house: newHouse || null }),
    });
    const data = await res.json();
    setNewApiKey(data.apiKey);
    setCreating(false);
    fetchDevices();
  }

  function openEdit(d: Device) {
    setEditDevice(d);
    setEditName(d.name);
    setEditHouse(d.house || "");
    setEditOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editDevice) return;
    setEditSaving(true);
    await fetch("/api/devices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editDevice.id, name: editName, house: editHouse || null }),
    });
    setEditSaving(false);
    setEditOpen(false);
    fetchDevices();
  }

  async function handleRevoke(id: string) {
    await fetch("/api/devices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchDevices();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Devices</h1>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) {
              setNewName("");
              setNewHouse(userHouse || "");
              setNewApiKey(null);
            }
          }}
        >
          <DialogTrigger render={<Button size="sm" />}>
            Add Device
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Device</DialogTitle>
            </DialogHeader>
            {newApiKey ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  Scan this QR code on the PDA, or copy the key.
                </p>
                <div className="flex justify-center p-4">
                  <QRCodeSVG value={newApiKey} size={180} />
                </div>
                <code className="block break-all rounded bg-gray-100 p-3 text-xs text-gray-500">
                  {newApiKey}
                </code>
                <Button
                  className="w-full"
                  onClick={() => navigator.clipboard.writeText(newApiKey)}
                  variant="outline"
                  size="sm"
                >
                  Copy
                </Button>
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => {
                    setCreateOpen(false);
                    setNewApiKey(null);
                    setNewName("");
                    setNewHouse(userHouse || "");
                  }}
                >
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="PDA House A"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>House</Label>
                  {isAdmin ? (
                    <select
                      value={newHouse}
                      onChange={(e) => setNewHouse(e.target.value)}
                      className="h-9 w-full rounded-md border px-3 text-sm"
                    >
                      <option value="">Shared</option>
                      {HOUSES.map((h) => (
                        <option key={h} value={h}>House {h}</option>
                      ))}
                    </select>
                  ) : (
                    <Input value={`House ${userHouse}`} disabled />
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? "Creating..." : "Create"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading...</p>
      ) : devices.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          No devices yet. Add one to get started.
        </p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-400">
                <th className="px-3 py-2 font-normal">Name</th>
                <th className="px-3 py-2 font-normal">House</th>
                <th className="px-3 py-2 font-normal">Last seen</th>
                <th className="px-3 py-2 font-normal">Status</th>
                <th className="px-3 py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className={cn(
                  "border-b last:border-0",
                  !d.isActive && "opacity-40"
                )}>
                  <td className="px-3 py-2 font-medium">{d.name}</td>
                  <td className="px-3 py-2">{d.house ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-400">
                    {d.lastSeen ? new Date(d.lastSeen).toLocaleString() : "Never"}
                  </td>
                  <td className="px-3 py-2">
                    {d.isActive ? (
                      <span className="text-gray-500">Active</span>
                    ) : (
                      <span className="text-gray-400">Revoked</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {d.isActive && (
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(d)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleRevoke(d.id)}>
                          Revoke
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>House</Label>
              {isAdmin ? (
                <select
                  value={editHouse}
                  onChange={(e) => setEditHouse(e.target.value)}
                  className="h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">Shared</option>
                  {HOUSES.map((h) => (
                    <option key={h} value={h}>House {h}</option>
                  ))}
                </select>
              ) : (
                <Input value={`House ${editHouse}`} disabled />
              )}
            </div>
            <Button type="submit" disabled={editSaving} className="w-full">
              {editSaving ? "Saving..." : "Save"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
