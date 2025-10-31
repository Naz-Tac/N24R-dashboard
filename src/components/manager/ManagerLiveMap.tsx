"use client";
import React, { useEffect, useRef, useState } from 'react';

type AgentMarker = {
  id: string;
  name: string;
  status: string;
  lat: number;
  lng: number;
  last_seen?: string;
};

const STATUS_COLORS: Record<string, string> = {
  on_duty: '#22c55e', // green
  en_route: '#eab308', // yellow
  idle: '#d1d5db', // gray/white
  offline: '#ef4444', // red
};

export function ManagerLiveMap({
  agents,
  onMarkerClick,
}: {
  agents: AgentMarker[];
  onMarkerClick?: (agentId: string, agentName?: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimensions, setDimensions] = useState({ w: 600, h: 400 });

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#f9fafb';
    if (document.documentElement.classList.contains('dark')) {
      ctx.fillStyle = '#111827';
    }
    ctx.fillRect(0, 0, c.width, c.height);

    // Draw simplified map grid (mock world map)
    ctx.strokeStyle = '#9ca3af40';
    ctx.lineWidth = 1;
    for (let i = 0; i < c.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, c.height);
      ctx.stroke();
    }
    for (let i = 0; i < c.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(c.width, i);
      ctx.stroke();
    }

    // Map lat/lng to canvas coords (simple linear projection)
    // Assume SF centered: lat ~37.77, lng ~-122.42
    const baseLat = 37.77;
    const baseLng = -122.42;
    const latRange = 0.2; // ±0.1 deg
    const lngRange = 0.2;
    const toX = (lng: number) => ((lng - (baseLng - lngRange / 2)) / lngRange) * c.width;
    const toY = (lat: number) => (1 - (lat - (baseLat - latRange / 2)) / latRange) * c.height;

    // Draw agent markers
    agents.forEach((a) => {
      const x = toX(a.lng);
      const y = toY(a.lat);
      const color = STATUS_COLORS[a.status.toLowerCase()] || STATUS_COLORS.idle;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [agents]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const parent = c.parentElement;
    if (!parent) return;
    const obs = new ResizeObserver(() => {
      const w = parent.clientWidth || 600;
      const h = parent.clientHeight || 400;
      setDimensions({ w, h });
    });
    obs.observe(parent);
    return () => obs.disconnect();
  }, []);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    if (!c || !onMarkerClick) return;
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const baseLat = 37.77;
    const baseLng = -122.42;
    const latRange = 0.2;
    const lngRange = 0.2;
    const toX = (lng: number) => ((lng - (baseLng - lngRange / 2)) / lngRange) * c.width;
    const toY = (lat: number) => (1 - (lat - (baseLat - latRange / 2)) / latRange) * c.height;

    for (const a of agents) {
      const mx = toX(a.lng);
      const my = toY(a.lat);
      const dist = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
      if (dist < 12) {
        onMarkerClick(a.id, a.name);
        return;
      }
    }
  }

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={dimensions.w}
        height={dimensions.h}
        className="w-full h-full cursor-pointer"
        onClick={handleClick}
      />
      <div className="absolute bottom-2 right-2 bg-white dark:bg-gray-900 rounded px-2 py-1 text-[10px] flex gap-2 border border-gray-300 dark:border-gray-700">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
