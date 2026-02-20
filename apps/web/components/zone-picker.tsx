"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

interface Zone {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
}

interface ZonePickerProps {
  value: string;
  onChange: (zoneId: string) => void;
  className?: string;
  id?: string;
}

export function ZonePicker({ value, onChange, className, id }: ZonePickerProps) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: Zone[] }>("/zones")
      .then((res) => setZones(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className || "w-full rounded-md border bg-background px-3 py-2 text-sm"}
      disabled={loading}
    >
      <option value="">{loading ? "Loading zones..." : "Select a zone..."}</option>
      {zones.map((zone) => (
        <option key={zone.id} value={zone.id}>
          {zone.name} — {zone.city}, {zone.state}
        </option>
      ))}
    </select>
  );
}
