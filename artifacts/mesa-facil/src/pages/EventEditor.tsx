import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetEvent,
  useGetEventStats,
  useListFloorItems,
  useCreateFloorItem,
  useUpdateFloorItem,
  useDeleteFloorItem,
  useListGuests,
  useUpdateGuest,
  useCreateGuest,
  getGetEventQueryKey,
  getGetEventStatsQueryKey,
  getListFloorItemsQueryKey,
  getListGuestsQueryKey,
  FloorItemInputType,
  FloorItemInput,
  type FloorItem as ListFloorItemsResponseItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, GripHorizontal, Users, Map as MapIcon, X, ZoomIn, ZoomOut, Maximize2, RotateCw, RotateCcw, FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Loader2, Crosshair } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const ITEM_TYPES = [
  { type: "round-table",      label: "Mesa Redonda",        capacity: 10, w: 130, h: 130 },
  { type: "rectangle-table",  label: "Mesa Retangular",     capacity: 8,  w: 170, h: 80  },
  { type: "square-table",     label: "Mesa Quadrada",       capacity: 8,  w: 110, h: 110 },
  { type: "couple-table",     label: "Mesa dos Noivos",     capacity: 2,  w: 200, h: 70  },
  { type: "buffet-table",     label: "Buffet",              capacity: 0,  w: 200, h: 60  },
  { type: "stage",            label: "Palco",               capacity: 0,  w: 280, h: 90  },
  { type: "dj-booth",         label: "DJ Booth",            capacity: 0,  w: 100, h: 80  },
  { type: "bathroom",         label: "Banheiro",            capacity: 0,  w: 70,  h: 40  },
  { type: "entrance",         label: "Entrada do Salão",    capacity: 0,  w: 80,  h: 40  },
  { type: "emergency-exit",   label: "Saída de Emergência", capacity: 0,  w: 80,  h: 40  },
];

// Items that must be snapped to the canvas border (wall-mounted items)
const WALL_ITEM_TYPES = new Set(["bathroom", "entrance", "emergency-exit"]);
const WALL_SNAP_THRESHOLD = 80; // px — magnetic pull zone near each wall

// ── Room-aware wall snap helpers ─────────────────────────────────────────────
// These replace the old canvas-bounding-box approach and snap items to the
// wall of whichever individual room is nearest to the item.

function findNearestRoom(cx: number, cy: number, rooms: Room[]): Room {
  // Prefer a room that actually contains the point
  const inside = rooms.find(
    r => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h
  );
  if (inside) return inside;
  // Otherwise, use distance from point to the closest room edge
  let best = rooms[0];
  let bestDist = Infinity;
  for (const r of rooms) {
    const clampedX = Math.max(r.x, Math.min(cx, r.x + r.w));
    const clampedY = Math.max(r.y, Math.min(cy, r.y + r.h));
    const d = Math.hypot(cx - clampedX, cy - clampedY);
    if (d < bestDist) { bestDist = d; best = r; }
  }
  return best;
}

function snapToRoomWall(
  x: number, y: number, w: number, h: number,
  rooms: Room[],
  threshold = 0
): { x: number; y: number } {
  const room = findNearestRoom(x + w / 2, y + h / 2, rooms);
  const cx = x + w / 2, cy = y + h / 2;
  const dL = cx - room.x;
  const dR = (room.x + room.w) - cx;
  const dT = cy - room.y;
  const dB = (room.y + room.h) - cy;
  const nearest = Math.min(dL, dR, dT, dB);
  if (threshold > 0 && nearest >= threshold) return { x, y };
  const clampY = Math.max(room.y, Math.min(y, room.y + room.h - h));
  const clampX = Math.max(room.x, Math.min(x, room.x + room.w - w));
  if (nearest === dL) return { x: room.x - w / 2,          y: clampY };
  if (nearest === dR) return { x: room.x + room.w - w / 2, y: clampY };
  if (nearest === dT) return { x: clampX,                  y: room.y - h / 2 };
  return                     { x: clampX,                  y: room.y + room.h - h / 2 };
}

function getRoomWallSide(
  x: number, y: number, w: number, h: number,
  rooms: Room[]
): { side: "left" | "right" | "top" | "bottom"; room: Room } {
  const room = findNearestRoom(x + w / 2, y + h / 2, rooms);
  const cx = x + w / 2, cy = y + h / 2;
  const dL = Math.abs(cx - room.x);
  const dR = Math.abs((room.x + room.w) - cx);
  const dT = Math.abs(cy - room.y);
  const dB = Math.abs((room.y + room.h) - cy);
  const nearest = Math.min(dL, dR, dT, dB);
  if (nearest === dL) return { side: "left",   room };
  if (nearest === dR) return { side: "right",  room };
  if (nearest === dT) return { side: "top",    room };
  return                     { side: "bottom", room };
}

function snapToRoomWallSide(
  side: "left" | "right" | "top" | "bottom",
  x: number, y: number, w: number, h: number,
  room: Room
): { x: number; y: number } {
  const clampY = Math.max(room.y, Math.min(y, room.y + room.h - h));
  const clampX = Math.max(room.x, Math.min(x, room.x + room.w - w));
  if (side === "left")   return { x: room.x - w / 2,          y: clampY };
  if (side === "right")  return { x: room.x + room.w - w / 2, y: clampY };
  if (side === "top")    return { x: clampX,                  y: room.y - h / 2 };
  return                        { x: clampX,                  y: room.y + room.h - h / 2 };
}

const ROTATION_PRESETS = [0, 45, 90, 135, 180, 225, 270, 315];

// ── Floor item visual helpers ─────────────────────────────────────────────

const CHAIR_W = 46;
const CHAIR_H = 15;
const CHAIR_GAP = 5;
const CHAIR_SLOT = CHAIR_W + 6; // minimum arc/linear space per chair (no overlap + 6px gap)

function computeTableSize(type: string, capacity: number): { w: number; h: number } {
  if (type === "buffet-table")    return { w: 200, h: 60 };
  if (type === "stage")           return { w: 280, h: 90 };
  if (type === "dj-booth")        return { w: 100, h: 80 };
  if (type === "bathroom")        return { w: 70,  h: 40 };
  if (type === "entrance")        return { w: 80,  h: 40 };
  if (type === "emergency-exit")  return { w: 80,  h: 40 };
  if (type === "couple-table")    return { w: 160, h: 65 };
  if (capacity === 0)          return { w: 120, h: 70 };

  if (type === "round-table") {
    const r = Math.max(40, (capacity * CHAIR_SLOT) / (2 * Math.PI));
    const tableR = r - CHAIR_GAP - CHAIR_H / 2;
    const size = Math.max(70, Math.ceil(tableR * 2 / 5) * 5);
    return { w: size, h: size };
  }

  if (type === "square-table") {
    const perSide = Math.ceil(capacity / 4);
    const size = Math.max(80, (perSide + 1) * CHAIR_SLOT);
    return { w: size, h: size };
  }

  // rectangle-table: ~2:1 ratio
  const topCount = Math.max(1, Math.round(capacity / 3));
  const sideCount = Math.max(0, Math.round((capacity - topCount * 2) / 2));
  const w = Math.max(120, (topCount + 1) * CHAIR_SLOT);
  const h = sideCount > 0
    ? Math.max(70, (sideCount + 1) * CHAIR_SLOT)
    : Math.max(70, CHAIR_H * 4);
  return { w, h };
}

function getChairPositions(
  type: string,
  w: number,
  h: number,
  capacity: number,
): { left: number; top: number; width: number; height: number; transform?: string }[] {
  if (capacity === 0) return [];

  const cW = CHAIR_W;
  const cH = CHAIR_H;
  const gap = CHAIR_GAP;

  if (type === "round-table") {
    const r = w / 2 + gap + cH / 2;
    return Array.from({ length: capacity }, (_, i) => {
      const angle = (i / capacity) * Math.PI * 2 - Math.PI / 2;
      const cx = w / 2 + Math.cos(angle) * r;
      const cy = h / 2 + Math.sin(angle) * r;
      const deg = (angle * 180) / Math.PI + 90;
      return { left: cx - cW / 2, top: cy - cH / 2, width: cW, height: cH, transform: `rotate(${deg}deg)` };
    });
  }

  if (type === "couple-table") {
    return [
      { left: w / 2 - cW / 2, top: -(gap + cH), width: cW, height: cH },
      { left: w / 2 - cW / 2, top: h + gap, width: cW, height: cH },
    ];
  }

  // Rectangular / square — distribute chairs proportionally around all 4 sides
  const perimeter = 2 * (w + h);
  const topCount = Math.max(1, Math.round(capacity * w / perimeter));
  const sideCount = Math.max(0, Math.round((capacity - topCount * 2) / 2));

  const chairs: { left: number; top: number; width: number; height: number }[] = [];
  const topSpacing = w / (topCount + 1);
  for (let i = 1; i <= topCount; i++) {
    chairs.push({ left: i * topSpacing - cW / 2, top: -(gap + cH), width: cW, height: cH });
    chairs.push({ left: i * topSpacing - cW / 2, top: h + gap, width: cW, height: cH });
  }
  if (sideCount > 0) {
    const sideSpacing = h / (sideCount + 1);
    for (let i = 1; i <= sideCount; i++) {
      chairs.push({ left: -(gap + cH), top: i * sideSpacing - cW / 2, width: cH, height: cW });
      chairs.push({ left: w + gap, top: i * sideSpacing - cW / 2, width: cH, height: cW });
    }
  }
  return chairs;
}

function getTableColor(type: string, isFull: boolean, isNonSeating: boolean) {
  // Project palette: tan #C9A990, light beige #D9C4B5, cream #FBF0E4,
  //                 sage light #B5C2B0, sage medium #9BA89A, olive #727A68
  if (isFull) return { bg: "#C9A990", text: "#5A3E2E" };
  if (isNonSeating) return { bg: "#D9C4B5", text: "#6B5445" };
  switch (type) {
    case "round-table":
      return { bg: "#B5C2B0", text: "#3A4A38" };
    case "rectangle-table":
      return { bg: "#9BA89A", text: "#2E3C2D" };
    case "square-table":
      return { bg: "#B5C2B0", text: "#3A4A38" };
    case "couple-table":
      return { bg: "#FBF0E4", text: "#7A5A42" };
    default:
      return { bg: "#D9C4B5", text: "#6B5445" };
  }
}

// ── Priority mapping for guest groups ───────────────────────────────────────
const GROUP_PRIORITY: Record<string, number> = {
  "noivos": 0,
  "casal": 0,
  "família": 1,
  "familia": 1,
  "family": 1,
  "familiares": 1,
  "amigos próximos": 2,
  "amigos proximos": 2,
  "melhores amigos": 2,
  "amigos": 3,
  "colegas": 4,
  "trabalho": 4,
  "conhecidos": 5,
};

function getGroupPriority(group: string | null | undefined): number {
  if (!group) return 99;
  return GROUP_PRIORITY[group.trim().toLowerCase()] ?? 50;
}

function getLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : parts[0].toLowerCase();
}

type GuestRow = { id: number; name: string; group?: string | null; floorItemId?: number | null; seatNumber?: number | null };
type TableRow = { id: number; capacity: number };

function computeAutoAssignments(
  allGuests: GuestRow[],
  floorItems: TableRow[],
  onlyUnassigned: boolean
): Array<{ guestId: number; floorItemId: number; seatNumber: number }> {
  const seatableTables = floorItems.filter((t) => t.capacity > 0);

  // Seed current occupancy per table (from already-assigned guests, unless clearing all)
  const occupied = new Map<number, Set<number>>();
  for (const t of seatableTables) {
    const seats = new Set<number>();
    if (onlyUnassigned) {
      allGuests
        .filter((g) => g.floorItemId === t.id && g.seatNumber != null)
        .forEach((g) => seats.add(g.seatNumber!));
    }
    occupied.set(t.id, seats);
  }

  const targets = onlyUnassigned
    ? allGuests.filter((g) => g.floorItemId == null)
    : allGuests;

  // Group by last name
  const byLastName = new Map<string, GuestRow[]>();
  for (const g of targets) {
    const key = getLastName(g.name);
    if (!byLastName.has(key)) byLastName.set(key, []);
    byLastName.get(key)!.push(g);
  }

  // Sort groups: best relationship first, then larger groups first
  const sortedGroups = [...byLastName.values()].sort((a, b) => {
    const pa = Math.min(...a.map((g) => getGroupPriority(g.group)));
    const pb = Math.min(...b.map((g) => getGroupPriority(g.group)));
    if (pa !== pb) return pa - pb;
    return b.length - a.length;
  });

  // Sort tables: largest capacity first
  const tables = [...seatableTables].sort((a, b) => b.capacity - a.capacity);

  const assignments: Array<{ guestId: number; floorItemId: number; seatNumber: number }> = [];

  for (const group of sortedGroups) {
    let remaining = [...group];
    for (const table of tables) {
      if (remaining.length === 0) break;
      const seats = occupied.get(table.id)!;
      const avail = table.capacity - seats.size;
      if (avail <= 0) continue;
      const toSeat = remaining.splice(0, avail);
      for (const guest of toSeat) {
        let seat = 1;
        while (seats.has(seat)) seat++;
        seats.add(seat);
        assignments.push({ guestId: guest.id, floorItemId: table.id, seatNumber: seat });
      }
    }
  }

  return assignments;
}

type Room = { id: string; x: number; y: number; w: number; h: number };
const VIRTUAL_W = 4000;
const VIRTUAL_H = 2800;
const ROOM_MIN_SIZE = 200;

function isPointInAnyRoom(px: number, py: number, rooms: Room[]): boolean {
  return rooms.some(r => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
}

const GRID_SIZE = 10; // px — dot grid spacing & snap unit

function snapToGrid(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

type DragState = {
  id: number;
  startPointerX: number;
  startPointerY: number;
  itemOriginX: number;
  itemOriginY: number;
};

type ResizeState = {
  id: number;
  edge: "left" | "right" | "top" | "bottom";
  wallSide: "left" | "right" | "top" | "bottom";
  room: Room;
  startPointerX: number;
  startPointerY: number;
  origW: number;
  origH: number;
  origX: number;
  origY: number;
};

// ── RoomRect: a white floor-area rectangle with 8 resize handles ─────────────
const ROOM_HANDLES = ["n","s","e","w","ne","nw","se","sw"] as const;
type RoomHandle = (typeof ROOM_HANDLES)[number];

function getHandleStyle(handle: RoomHandle): React.CSSProperties {
  const S = 10;
  const half = -S / 2;
  const base: React.CSSProperties = {
    position: "absolute", width: S, height: S,
    background: "white", border: "1.5px solid #6366f1", borderRadius: 2, zIndex: 25,
  };
  if (handle === "n")  return { ...base, top: half, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" };
  if (handle === "s")  return { ...base, bottom: half, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" };
  if (handle === "e")  return { ...base, right: half, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" };
  if (handle === "w")  return { ...base, left: half, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" };
  if (handle === "ne") return { ...base, top: half, right: half, cursor: "nesw-resize" };
  if (handle === "nw") return { ...base, top: half, left: half, cursor: "nwse-resize" };
  if (handle === "se") return { ...base, bottom: half, right: half, cursor: "nwse-resize" };
  return                        { ...base, bottom: half, left: half, cursor: "nesw-resize" }; // sw
}

function RoomRect({
  room, mode, canDelete, merged, onDelete, onResizeDown, onResizeMove, onResizeUp,
}: {
  room: Room;
  mode: "layout" | "assignment";
  canDelete: boolean;
  merged?: boolean;
  onDelete: (id: string) => void;
  onResizeDown: (e: React.PointerEvent<HTMLDivElement>, id: string, handle: string) => void;
  onResizeMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onResizeUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const showControls = hovered && mode === "layout";
  return (
    <div
      data-room-bg="true"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute"
      style={{
        left: room.x, top: room.y, width: room.w, height: room.h,
        background: merged ? "transparent" : "white",
        border: merged
          ? (showControls ? "1.5px dashed #6366f1" : "none")
          : (showControls ? "1.5px solid #6366f1" : "1px solid rgba(0,0,0,0.08)"),
        boxShadow: merged ? "none" : "0 1px 6px rgba(0,0,0,0.07)",
        zIndex: 1,
      }}
    >
      {showControls && canDelete && (
        <button
          className="absolute top-1 right-1 z-30 w-5 h-5 rounded bg-red-50 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center text-xs font-bold transition-colors"
          onClick={(e) => { e.stopPropagation(); onDelete(room.id); }}
          title="Remover sala"
          style={{ lineHeight: 1 }}
        >
          ×
        </button>
      )}
      {showControls && ROOM_HANDLES.map(handle => (
        <div
          key={handle}
          style={getHandleStyle(handle)}
          onPointerDown={(e) => onResizeDown(e, room.id, handle)}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          onPointerCancel={onResizeUp}
        />
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function roomsOverlap(a: Room, b: Room): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ── MergedRoomsLayer: SVG that renders the visual union of all rooms ──────────
// Computes the exterior boundary of the union: for each edge of each room,
// subtracts the portions that are shared with (adjacent to or inside) other
// rooms, then draws only the remaining exterior segments. This guarantees that
// internal lines at junctions disappear completely — no clipping artifacts.

/** Subtract a list of intervals from a base interval [lo, hi].
 *  Returns the remaining sub-intervals after removing all [a,b] in subs. */
function subtractIntervals(
  lo: number, hi: number,
  subs: Array<[number, number]>,
): Array<[number, number]> {
  let result: Array<[number, number]> = [[lo, hi]];
  for (const [a, b] of subs) {
    const next: Array<[number, number]> = [];
    for (const [r0, r1] of result) {
      if (b <= r0 || a >= r1) {
        next.push([r0, r1]);
      } else {
        if (r0 < a) next.push([r0, a]);
        if (b < r1) next.push([b, r1]);
      }
    }
    result = next;
  }
  return result;
}

function MergedRoomsLayer({ rooms }: { rooms: Room[] }) {
  const snap = (v: number) => Math.round(v);

  const linePaths: string[] = [];

  for (const room of rooms) {
    const { x: rx, y: ry, w: rw, h: rh } = room;
    const others = rooms.filter(r => r !== room);

    // Top edge (y = ry): exterior where no other room covers the area just above.
    // Room B covers just above this edge if B.y < ry AND ry <= B.y + B.h.
    {
      const subs = others
        .filter(b => b.y < ry && ry <= b.y + b.h)
        .map(b => [Math.max(b.x, rx), Math.min(b.x + b.w, rx + rw)] as [number, number])
        .filter(([a, b]) => a < b);
      for (const [x1, x2] of subtractIntervals(rx, rx + rw, subs)) {
        linePaths.push(`M${snap(x1)},${snap(ry)} H${snap(x2)}`);
      }
    }

    // Bottom edge (y = ry + rh): exterior where no other room covers just below.
    // Room B covers just below if B.y <= ry+rh AND ry+rh < B.y + B.h.
    {
      const subs = others
        .filter(b => b.y <= ry + rh && ry + rh < b.y + b.h)
        .map(b => [Math.max(b.x, rx), Math.min(b.x + b.w, rx + rw)] as [number, number])
        .filter(([a, b]) => a < b);
      for (const [x1, x2] of subtractIntervals(rx, rx + rw, subs)) {
        linePaths.push(`M${snap(x1)},${snap(ry + rh)} H${snap(x2)}`);
      }
    }

    // Left edge (x = rx): exterior where no other room covers just to the left.
    // Room B covers just left if B.x < rx AND rx <= B.x + B.w.
    {
      const subs = others
        .filter(b => b.x < rx && rx <= b.x + b.w)
        .map(b => [Math.max(b.y, ry), Math.min(b.y + b.h, ry + rh)] as [number, number])
        .filter(([a, b]) => a < b);
      for (const [y1, y2] of subtractIntervals(ry, ry + rh, subs)) {
        linePaths.push(`M${snap(rx)},${snap(y1)} V${snap(y2)}`);
      }
    }

    // Right edge (x = rx + rw): exterior where no other room covers just to the right.
    // Room B covers just right if B.x <= rx+rw AND rx+rw < B.x + B.w.
    {
      const subs = others
        .filter(b => b.x <= rx + rw && rx + rw < b.x + b.w)
        .map(b => [Math.max(b.y, ry), Math.min(b.y + b.h, ry + rh)] as [number, number])
        .filter(([a, b]) => a < b);
      for (const [y1, y2] of subtractIntervals(ry, ry + rh, subs)) {
        linePaths.push(`M${snap(rx + rw)},${snap(y1)} V${snap(y2)}`);
      }
    }
  }

  return (
    <svg
      style={{
        position: "absolute", top: 0, left: 0,
        width: VIRTUAL_W, height: VIRTUAL_H,
        overflow: "visible", pointerEvents: "none", zIndex: 1,
      }}
    >
      {/* White fills — overlapping rooms merge into a solid white area */}
      {rooms.map(room => (
        <rect key={`mf-${room.id}`} x={room.x} y={room.y} width={room.w} height={room.h} fill="white" />
      ))}
      {/* Only exterior border segments — internal junction lines are omitted */}
      {linePaths.length > 0 && (
        <path
          d={linePaths.join(" ")}
          fill="none"
          stroke="rgba(0,0,0,0.12)"
          strokeWidth={1}
          shapeRendering="crispEdges"
        />
      )}
    </svg>
  );
}

export default function EventEditor({ clientMode = false }: { clientMode?: boolean }) {
  const { eventId: eventIdStr } = useParams();
  const eventId = parseInt(eventIdStr || "0", 10);
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"layout" | "assignment">(clientMode ? "assignment" : "layout");
  const [rooms, setRooms] = useState<Room[]>(() => {
    try {
      const stored = localStorage.getItem(`canvas-rooms-${eventId}`);
      if (stored) { const p = JSON.parse(stored); if (Array.isArray(p) && p.length) return p; }
      const oldSize = localStorage.getItem(`canvas-size-${eventId}`);
      if (oldSize) { const p = JSON.parse(oldSize); if (p.w && p.h) return [{ id: 'r0', x: 0, y: 0, w: p.w, h: p.h }]; }
    } catch { /* ignore */ }
    return [{ id: 'r0', x: 0, y: 0, w: 800, h: 600 }];
  });
  const [drawMode, setDrawMode] = useState(false);
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [mergedView, setMergedView] = useState<boolean>(() => {
    try { return localStorage.getItem(`canvas-merged-${eventId}`) === "1"; } catch { return false; }
  });
  // Derived bounding-box for wall-snap and backwards-compat with existing handlers
  const canvasWidth  = rooms.reduce((m, r) => Math.max(m, r.x + r.w), 800);
  const canvasHeight = rooms.reduce((m, r) => Math.max(m, r.y + r.h), 600);

  // Smooth pointer-drag state (for moving existing items)
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [localPos, setLocalPos] = useState<Record<number, { x: number; y: number }>>({});
  const dragRef = useRef<DragState | null>(null);

  // Wall item resize state
  const [localSize, setLocalSize] = useState<Record<number, { w: number; h: number }>>({});
  const resizeRef = useRef<ResizeState | null>(null);

  // Stable refs so canvas-resize effect can read current values without stale closures
  const floorItemsRef = useRef<typeof floorItems>([]);
  const localPosRef   = useRef<Record<number, { x: number; y: number }>>({});
  const localSizeRef  = useRef<Record<number, { w: number; h: number }>>({});
  const prevCanvasRef = useRef({ w: canvasWidth, h: canvasHeight });

  // Hover state for showing delete button (layout) and guest tooltip (assignment)
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);
  const [hoveredTableId, setHoveredTableId] = useState<number | null>(null);

  // Rotation (optimistic local override)
  const [localRotation, setLocalRotation] = useState<Record<number, number>>({});

  // Auto-assign
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);
  const [autoAssignOnlyUnassigned, setAutoAssignOnlyUnassigned] = useState(true);
  const [autoAssignRunning, setAutoAssignRunning] = useState(false);
  const [autoAssignResult, setAutoAssignResult] = useState<{ placed: number; skipped: number } | null>(null);

  // Per-item-type capacity overrides in the sidebar (index → capacity)
  const [seatOverrides, setSeatOverrides] = useState<Record<number, number>>(() =>
    Object.fromEntries(ITEM_TYPES.map((it, i) => [i, it.capacity]))
  );

  // Pan state (transform-based, infinite canvas)
  const isPanningRef = useRef(false);
  const [pan, setPan] = useState({ x: 32, y: 32 });
  const panStateRef = useRef({ x: 32, y: 32 });
  const panRef = useRef<{
    startPanX: number;
    startPanY: number;
    startPointerX: number;
    startPointerY: number;
  } | null>(null);

  // Zoom
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 2.0;
  const ZOOM_STEP = 0.1;
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1); // always-fresh ref for pointer handlers

  const applyZoom = useCallback((delta: number) => {
    setZoom((prev) => {
      const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev + delta)) * 100) / 100;
      zoomRef.current = next;
      return next;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    zoomRef.current = 1;
  }, []);

  const viewportRef = useRef<HTMLDivElement>(null);

  const recenter = useCallback(() => {
    if (!viewportRef.current) return;
    const vp = viewportRef.current.getBoundingClientRect();
    const rms = roomsRef.current;
    if (!rms.length) return;
    const minX = rms.reduce((m, r) => Math.min(m, r.x), Infinity);
    const minY = rms.reduce((m, r) => Math.min(m, r.y), Infinity);
    const maxX = rms.reduce((m, r) => Math.max(m, r.x + r.w), -Infinity);
    const maxY = rms.reduce((m, r) => Math.max(m, r.y + r.h), -Infinity);
    const z = zoomRef.current;
    const p = {
      x: (vp.width  - (maxX - minX) * z) / 2 - minX * z,
      y: (vp.height - (maxY - minY) * z) / 2 - minY * z,
    };
    setPan(p);
    panStateRef.current = p;
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const roomsRef = useRef<Room[]>(rooms);
  const drawModeRef = useRef(false);
  const roomResizeRef = useRef<{
    id: string; handle: string;
    startPointerX: number; startPointerY: number;
    origX: number; origY: number; origW: number; origH: number;
  } | null>(null);
  const drawingRef = useRef<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const isFirstRoomsLoad = useRef(true);

  const { data: event, isLoading: isLoadingEvent } = useGetEvent(eventId, {
    query: { enabled: !!eventId, queryKey: getGetEventQueryKey(eventId) },
  });
  const { data: stats } = useGetEventStats(eventId, {
    query: { enabled: !!eventId, queryKey: getGetEventStatsQueryKey(eventId) },
  });
  const { data: floorItems = [] } = useListFloorItems(eventId, {
    query: { enabled: !!eventId, queryKey: getListFloorItemsQueryKey(eventId) },
  });
  const { data: guests = [] } = useListGuests(eventId, {
    query: { enabled: !!eventId, queryKey: getListGuestsQueryKey(eventId) },
  });

  const createFloorItem = useCreateFloorItem();
  const updateFloorItem = useUpdateFloorItem();
  const deleteFloorItem = useDeleteFloorItem();
  const updateGuest = useUpdateGuest();

  // ── Persist rooms & mergedView to localStorage ────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    try { localStorage.setItem(`canvas-rooms-${eventId}`, JSON.stringify(rooms)); } catch { /* ignore */ }
  }, [eventId, rooms]);
  useEffect(() => {
    if (!eventId) return;
    try { localStorage.setItem(`canvas-merged-${eventId}`, mergedView ? "1" : "0"); } catch { /* ignore */ }
  }, [eventId, mergedView]);
  // Reload rooms when navigating between events (same component instance, eventId changes)
  useEffect(() => {
    if (isFirstRoomsLoad.current) { isFirstRoomsLoad.current = false; return; }
    if (!eventId) return;
    try {
      const stored = localStorage.getItem(`canvas-rooms-${eventId}`);
      if (stored) { const p = JSON.parse(stored); if (Array.isArray(p) && p.length) { setRooms(p); return; } }
      const oldSize = localStorage.getItem(`canvas-size-${eventId}`);
      if (oldSize) { const p = JSON.parse(oldSize); if (p?.w && p?.h) { setRooms([{ id: 'r0', x: 0, y: 0, w: p.w, h: p.h }]); return; } }
    } catch { /* ignore */ }
    setRooms([{ id: 'r0', x: 0, y: 0, w: 800, h: 600 }]);
  }, [eventId]);

  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  useEffect(() => { drawingRef.current = drawing; }, [drawing]);
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);

  // ── Keep stable refs in sync ─────────────────────────────────────────────
  useEffect(() => { floorItemsRef.current = floorItems; }, [floorItems]);
  useEffect(() => { localPosRef.current   = localPos;   }, [localPos]);
  useEffect(() => { localSizeRef.current  = localSize;  }, [localSize]);

  // ── Stable guest display order (freeze on first appearance, never resort) ──
  // guestOrderRef: guest id → stable position index
  // groupAnchorRef: vocativo → minimum position of ANY member (even if already assigned)
  //   This keeps a group's slot in the list fixed even when its first member is moved to a table.
  const guestOrderRef = useRef<Map<number, number>>(new Map());
  const groupAnchorRef = useRef<Map<string, number>>(new Map());
  {
    let maxPos = guestOrderRef.current.size > 0
      ? Math.max(...guestOrderRef.current.values())
      : -1;
    for (const g of guests) {
      if (!guestOrderRef.current.has(g.id)) {
        guestOrderRef.current.set(g.id, ++maxPos);
      }
      if (g.vocativo) {
        const gPos = guestOrderRef.current.get(g.id)!;
        const prev = groupAnchorRef.current.get(g.vocativo);
        if (prev === undefined || gPos < prev) {
          groupAnchorRef.current.set(g.vocativo, gPos);
        }
      }
    }
  }

  // ── Re-snap wall items when canvas is resized ────────────────────────────
  useEffect(() => {
    const prevW = prevCanvasRef.current.w;
    const prevH = prevCanvasRef.current.h;
    if (prevW === canvasWidth && prevH === canvasHeight) return;
    prevCanvasRef.current = { w: canvasWidth, h: canvasHeight };

    const wallItems = floorItemsRef.current.filter((fi) => WALL_ITEM_TYPES.has(fi.type));
    if (wallItems.length === 0) return;

    const updates: Array<{ id: number; x: number; y: number }> = [];
    const posPatches: Record<number, { x: number; y: number }> = {};

    for (const item of wallItems) {
      const pos  = localPosRef.current[item.id]  ?? { x: item.x,    y: item.y     };
      const size = localSizeRef.current[item.id] ?? { w: item.width, h: item.height };
      // Determine which room wall the item was on, then re-snap to it
      const { side: wallSide, room: wallRoom } = getRoomWallSide(pos.x, pos.y, size.w, size.h, roomsRef.current);
      const newPos = snapToRoomWallSide(wallSide, pos.x, pos.y, size.w, size.h, wallRoom);
      posPatches[item.id] = newPos;
      updates.push({ id: item.id, x: newPos.x, y: newPos.y });
    }

    setLocalPos((prev) => ({ ...prev, ...posPatches }));

    for (const u of updates) {
      updateFloorItem.mutate(
        { eventId, floorItemId: u.id, data: { x: u.x, y: u.y } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFloorItemsQueryKey(eventId) }) }
      );
    }
  }, [canvasWidth, canvasHeight, eventId, updateFloorItem, queryClient]);

  // ── Ctrl+Wheel zoom ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      setZoom((prev) => {
        const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev + delta)) * 100) / 100;
        zoomRef.current = next;
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Auto-assign handler ──────────────────────────────────────────────────
  const handleAutoAssign = useCallback(async () => {
    setAutoAssignRunning(true);
    setAutoAssignResult(null);
    const assignments = computeAutoAssignments(guests, floorItems, autoAssignOnlyUnassigned);
    let placed = 0;
    let skipped = 0;
    for (const a of assignments) {
      try {
        await new Promise<void>((resolve, reject) => {
          updateGuest.mutate(
            { eventId, guestId: a.guestId, data: { floorItemId: a.floorItemId, seatNumber: a.seatNumber } },
            { onSuccess: () => resolve(), onError: () => reject() }
          );
        });
        placed++;
      } catch {
        skipped++;
      }
    }
    await queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(eventId) });
    await queryClient.invalidateQueries({ queryKey: getGetEventStatsQueryKey(eventId) });
    setAutoAssignRunning(false);
    setAutoAssignResult({ placed, skipped });
  }, [guests, floorItems, autoAssignOnlyUnassigned, updateGuest, eventId, queryClient]);

  // ── Pan / draw-room handlers ─────────────────────────────────────────────
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const isBackground =
        target === containerRef.current || target.dataset.roomBg === 'true';
      if (!isBackground) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      if (drawModeRef.current) {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const z = zoomRef.current;
        const sx = snapToGrid((e.clientX - rect.left) / z);
        const sy = snapToGrid((e.clientY - rect.top) / z);
        const init = { startX: sx, startY: sy, endX: sx, endY: sy };
        drawingRef.current = init;
        setDrawing(init);
      } else {
        isPanningRef.current = true;
        panRef.current = {
          startPanX: panStateRef.current.x,
          startPanY: panStateRef.current.y,
          startPointerX: e.clientX,
          startPointerY: e.clientY,
        };
      }
    },
    [] // refs handle drawMode — no stale closure
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (drawingRef.current) {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const z = zoomRef.current;
        const ex = snapToGrid((e.clientX - rect.left) / z);
        const ey = snapToGrid((e.clientY - rect.top) / z);
        setDrawing(prev => prev ? { ...prev, endX: ex, endY: ey } : null);
        return;
      }
      if (!isPanningRef.current || !panRef.current) return;
      const dx = e.clientX - panRef.current.startPointerX;
      const dy = e.clientY - panRef.current.startPointerY;
      const np = { x: panRef.current.startPanX + dx, y: panRef.current.startPanY + dy };
      setPan(np);
      panStateRef.current = np;
    },
    []
  );

  const handleCanvasPointerUp = useCallback(() => {
    const d = drawingRef.current;
    if (d) {
      const x = Math.min(d.startX, d.endX);
      const y = Math.min(d.startY, d.endY);
      const w = Math.abs(d.endX - d.startX);
      const h = Math.abs(d.endY - d.startY);
      if (w >= ROOM_MIN_SIZE && h >= ROOM_MIN_SIZE) {
        setRooms(prev => [...prev, { id: `r${Date.now()}`, x, y, w, h }]);
      }
      drawingRef.current = null;
      setDrawing(null);
      setDrawMode(false);
      drawModeRef.current = false;
    }
    isPanningRef.current = false;
    panRef.current = null;
  }, []);

  // ── Rotation handler ─────────────────────────────────────────────────────
  const handleRotate = useCallback(
    (e: React.MouseEvent, item: ListFloorItemsResponseItem, direction: 1 | -1) => {
      e.stopPropagation();
      const current = localRotation[item.id] ?? item.rotation ?? 0;
      const idx = ROTATION_PRESETS.indexOf(current);
      const nextIdx =
        idx === -1
          ? direction === 1 ? 1 : ROTATION_PRESETS.length - 1
          : (idx + direction + ROTATION_PRESETS.length) % ROTATION_PRESETS.length;
      const next = ROTATION_PRESETS[nextIdx];
      setLocalRotation((prev) => ({ ...prev, [item.id]: next }));
      updateFloorItem.mutate(
        { eventId, floorItemId: item.id, data: { rotation: next } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFloorItemsQueryKey(eventId) }) }
      );
    },
    [localRotation, updateFloorItem, eventId, queryClient]
  );

  // ── Pointer-based drag (smooth, real-time) ──────────────────────────────
  const handleItemPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, item: ListFloorItemsResponseItem) => {
      if (mode !== "layout") return;
      if ((e.target as HTMLElement).closest("button,[data-resize-handle]")) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        id: item.id,
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        itemOriginX: item.x,
        itemOriginY: item.y,
      };
      setDraggingId(item.id);
      setLocalPos((prev) => ({ ...prev, [item.id]: { x: item.x, y: item.y } }));
    },
    [mode]
  );

  const handleItemPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, item: ListFloorItemsResponseItem) => {
      if (resizeRef.current?.id === item.id) return; // resize is handling it
      if (!dragRef.current || dragRef.current.id !== item.id) return;
      const z = zoomRef.current;
      const dx = (e.clientX - dragRef.current.startPointerX) / z;
      const dy = (e.clientY - dragRef.current.startPointerY) / z;
      const rawX = dragRef.current.itemOriginX + dx;
      const rawY = dragRef.current.itemOriginY + dy;
      const { w: dW, h: dH } = WALL_ITEM_TYPES.has(item.type)
        ? (localSize[item.id] ?? { w: item.width, h: item.height })
        : computeTableSize(item.type, item.capacity);
      if (WALL_ITEM_TYPES.has(item.type)) {
        const snapped = snapToRoomWall(snapToGrid(rawX), snapToGrid(rawY), dW, dH, roomsRef.current, WALL_SNAP_THRESHOLD);
        setLocalPos((prev) => ({ ...prev, [item.id]: snapped }));
      } else {
        const newX = Math.max(0, Math.min(snapToGrid(rawX), VIRTUAL_W - dW));
        const newY = Math.max(0, Math.min(snapToGrid(rawY), VIRTUAL_H - dH));
        setLocalPos((prev) => ({ ...prev, [item.id]: { x: newX, y: newY } }));
      }
    },
    [canvasWidth, canvasHeight, localSize]
  );

  const handleItemPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, item: ListFloorItemsResponseItem) => {
      if (resizeRef.current?.id === item.id) return; // resize is handling it
      if (!dragRef.current || dragRef.current.id !== item.id) return;
      const raw = localPos[item.id] ?? { x: item.x, y: item.y };
      let pos = { x: snapToGrid(raw.x), y: snapToGrid(raw.y) };
      const { w: dW, h: dH } = WALL_ITEM_TYPES.has(item.type)
        ? (localSize[item.id] ?? { w: item.width, h: item.height })
        : computeTableSize(item.type, item.capacity);
      if (WALL_ITEM_TYPES.has(item.type)) {
        pos = snapToRoomWall(pos.x, pos.y, dW, dH, roomsRef.current);
      } else {
        // Revert to origin if item center landed outside every room
        if (!isPointInAnyRoom(pos.x + dW / 2, pos.y + dH / 2, roomsRef.current)) {
          const origPos = { x: dragRef.current!.itemOriginX, y: dragRef.current!.itemOriginY };
          setLocalPos((prev) => ({ ...prev, [item.id]: origPos }));
          dragRef.current = null;
          setDraggingId(null);
          return;
        }
      }
      setLocalPos((prev) => ({ ...prev, [item.id]: pos }));
      updateFloorItem.mutate(
        { eventId, floorItemId: item.id, data: { x: pos.x, y: pos.y } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFloorItemsQueryKey(eventId) }) }
      );
      dragRef.current = null;
      setDraggingId(null);
    },
    [localPos, localSize, eventId, updateFloorItem, queryClient, canvasWidth, canvasHeight]
  );

  // ── Resize handlers for wall items ──────────────────────────────────────
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, item: ListFloorItemsResponseItem, edge: "left" | "right" | "top" | "bottom") => {
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const pos  = localPos[item.id]  ?? { x: item.x,    y: item.y     };
      const size = localSize[item.id] ?? { w: item.width, h: item.height };
      const { side: wallSide, room: wallRoom } = getRoomWallSide(pos.x, pos.y, size.w, size.h, roomsRef.current);
      resizeRef.current = {
        id: item.id, edge, wallSide, room: wallRoom,
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        origW: size.w, origH: size.h,
        origX: pos.x,  origY: pos.y,
      };
    },
    [localPos, localSize, canvasWidth, canvasHeight]
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, item: ListFloorItemsResponseItem) => {
      if (!resizeRef.current || resizeRef.current.id !== item.id) return;
      const z = zoomRef.current;
      const { edge, wallSide, startPointerX, startPointerY, origW, origH, origX, origY } = resizeRef.current;
      const dx = (e.clientX - startPointerX) / z;
      const dy = (e.clientY - startPointerY) / z;
      const MIN_SIZE = 30;
      let newW = origW;
      let newH = origH;
      if (edge === "right")  newW = Math.max(MIN_SIZE, snapToGrid(origW + dx));
      if (edge === "left")   newW = Math.max(MIN_SIZE, snapToGrid(origW - dx));
      if (edge === "bottom") newH = Math.max(MIN_SIZE, snapToGrid(origH + dy));
      if (edge === "top")    newH = Math.max(MIN_SIZE, snapToGrid(origH - dy));
      setLocalSize((prev) => ({ ...prev, [item.id]: { w: newW, h: newH } }));
      const newPos = snapToRoomWallSide(wallSide, origX, origY, newW, newH, resizeRef.current!.room);
      setLocalPos((prev) => ({ ...prev, [item.id]: newPos }));
    },
    []
  );

  const handleResizePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, item: ListFloorItemsResponseItem) => {
      if (!resizeRef.current || resizeRef.current.id !== item.id) return;
      const size = localSize[item.id] ?? { w: item.width, h: item.height };
      const pos  = localPos[item.id]  ?? { x: item.x,    y: item.y     };
      updateFloorItem.mutate(
        { eventId, floorItemId: item.id, data: { x: pos.x, y: pos.y, width: size.w, height: size.h } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFloorItemsQueryKey(eventId) }) }
      );
      resizeRef.current = null;
    },
    [localSize, localPos, eventId, updateFloorItem, queryClient]
  );

  // ── Room resize handlers ─────────────────────────────────────────────────
  const handleRoomResizeDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, roomId: string, handle: string) => {
      e.stopPropagation();
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const room = roomsRef.current.find(r => r.id === roomId);
      if (!room) return;
      roomResizeRef.current = {
        id: roomId, handle,
        startPointerX: e.clientX, startPointerY: e.clientY,
        origX: room.x, origY: room.y, origW: room.w, origH: room.h,
      };
    },
    []
  );

  const handleRoomResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = roomResizeRef.current;
      if (!state) return;
      e.stopPropagation();
      const z = zoomRef.current;
      const dx = (e.clientX - state.startPointerX) / z;
      const dy = (e.clientY - state.startPointerY) / z;
      const { handle, origX, origY, origW, origH } = state;
      let newX = origX, newY = origY, newW = origW, newH = origH;
      if (handle.includes('e')) newW = Math.max(ROOM_MIN_SIZE, snapToGrid(origW + dx));
      if (handle.includes('w')) { newW = Math.max(ROOM_MIN_SIZE, snapToGrid(origW - dx)); newX = snapToGrid(origX + origW - newW); }
      if (handle.includes('s')) newH = Math.max(ROOM_MIN_SIZE, snapToGrid(origH + dy));
      if (handle.includes('n')) { newH = Math.max(ROOM_MIN_SIZE, snapToGrid(origH - dy)); newY = snapToGrid(origY + origH - newH); }
      setRooms(prev => prev.map(r => r.id === state.id ? { ...r, x: newX, y: newY, w: newW, h: newH } : r));
    },
    []
  );

  const handleRoomResizeUp = useCallback(() => {
    roomResizeRef.current = null;
  }, []);

  // ── HTML5 DnD: drop NEW items from toolbar onto canvas ──────────────────
  const handleDragStartNewItem = (
    e: React.DragEvent,
    itemType: (typeof ITEM_TYPES)[0],
    idx: number
  ) => {
    const overridden = { ...itemType, capacity: seatOverrides[idx] ?? itemType.capacity };
    e.dataTransfer.setData("application/json", JSON.stringify(overridden));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOverCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDropCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data.type) return;
    const rect = containerRef.current.getBoundingClientRect();
    const z = zoomRef.current;
    const { w: cW, h: cH } = computeTableSize(data.type, data.capacity);
    const rawX = (e.clientX - rect.left) / z - cW / 2;
    const rawY = (e.clientY - rect.top) / z - cH / 2;
    let x = Math.max(0, Math.min(snapToGrid(rawX), VIRTUAL_W - cW));
    let y = Math.max(0, Math.min(snapToGrid(rawY), VIRTUAL_H - cH));
    if (WALL_ITEM_TYPES.has(data.type)) {
      ({ x, y } = snapToRoomWall(x, y, cW, cH, roomsRef.current));
    } else if (!isPointInAnyRoom(x + cW / 2, y + cH / 2, roomsRef.current)) {
      return; // Reject drop outside any room
    }
    const newItem: FloorItemInput = {
      type: data.type as FloorItemInputType,
      label: data.label,
      x,
      y,
      width: cW,
      height: cH,
      rotation: 0,
      capacity: data.capacity,
    };
    createFloorItem.mutate(
      { eventId, data: newItem },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFloorItemsQueryKey(eventId) });
          queryClient.invalidateQueries({ queryKey: getGetEventStatsQueryKey(eventId) });
        },
      }
    );
  };

  // ── HTML5 DnD: guest assignment ─────────────────────────────────────────
  const handleDragStartGuest = (e: React.DragEvent, guestId: number) => {
    e.stopPropagation();
    e.dataTransfer.setData("guestId", guestId.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragStartGroup = (e: React.DragEvent, guestIds: number[]) => {
    e.stopPropagation();
    e.dataTransfer.setData("guestIds", JSON.stringify(guestIds));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverTable = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOnTable = (
    e: React.DragEvent,
    floorItemId: number,
    capacity: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(eventId) });
      queryClient.invalidateQueries({ queryKey: getGetEventStatsQueryKey(eventId) });
    };

    // ── Group drop ──────────────────────────────────────────────────────────
    const guestIdsStr = e.dataTransfer.getData("guestIds");
    if (guestIdsStr) {
      const guestIds: number[] = JSON.parse(guestIdsStr);
      const assignedGuests = guests.filter((g) => g.floorItemId === floorItemId);
      const freeCount = capacity > 0 ? capacity - assignedGuests.length : Infinity;
      if (freeCount < guestIds.length) return; // not enough seats for whole group
      const occupied = new Set(assignedGuests.map((g) => g.seatNumber).filter(Boolean));
      const freeSeats: number[] = [];
      for (let i = 1; i <= capacity && freeSeats.length < guestIds.length; i++) {
        if (!occupied.has(i)) freeSeats.push(i);
      }
      guestIds.forEach((guestId, idx) => {
        updateGuest.mutate(
          { eventId, guestId, data: { floorItemId, seatNumber: freeSeats[idx] } },
          idx === guestIds.length - 1 ? { onSuccess: invalidate } : {}
        );
      });
      return;
    }

    // ── Single guest drop ───────────────────────────────────────────────────
    const guestIdStr = e.dataTransfer.getData("guestId");
    if (!guestIdStr) return;
    const guestId = parseInt(guestIdStr, 10);
    const assignedGuests = guests.filter((g) => g.floorItemId === floorItemId);
    if (capacity > 0 && assignedGuests.length >= capacity) return;
    const occupied = new Set(assignedGuests.map((g) => g.seatNumber).filter(Boolean));
    let nextSeat = 1;
    for (let i = 1; i <= capacity; i++) {
      if (!occupied.has(i)) { nextSeat = i; break; }
    }
    updateGuest.mutate(
      { eventId, guestId, data: { floorItemId, seatNumber: nextSeat } },
      { onSuccess: invalidate }
    );
  };

  const handleDropUnassign = (e: React.DragEvent) => {
    e.preventDefault();
    const guestIdStr = e.dataTransfer.getData("guestId");
    if (!guestIdStr) return;
    const guestId = parseInt(guestIdStr, 10);
    updateGuest.mutate(
      { eventId, guestId, data: { floorItemId: null, seatNumber: null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(eventId) });
          queryClient.invalidateQueries({ queryKey: getGetEventStatsQueryKey(eventId) });
        },
      }
    );
  };

  const handleDeleteItem = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    deleteFloorItem.mutate(
      { eventId, floorItemId: id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFloorItemsQueryKey(eventId) });
          queryClient.invalidateQueries({ queryKey: getGetEventStatsQueryKey(eventId) });
          setHoveredItemId(null);
        },
      }
    );
  };

  if (isLoadingEvent) return <div className="p-8 text-center">Carregando...</div>;
  if (!event) return <div className="p-8 text-center">Evento não encontrado</div>;

  return (
    <div className="h-screen bg-background flex flex-col select-none overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b py-3 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href={clientMode ? "/client" : "/app"}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-primary leading-tight">{event.name}</h1>
            <p className="text-xs text-muted-foreground">{clientMode ? "Área do Cliente" : "Editor de Mapa"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode toggle — hidden in client mode */}
          {!clientMode && (
            <div className="flex rounded-lg border bg-muted p-0.5 gap-0.5" role="tablist">
              <button
                role="tab"
                aria-selected={mode === "layout"}
                onClick={() => setMode("layout")}
                data-testid="tab-layout"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  mode === "layout"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                Layout
              </button>
              <button
                role="tab"
                aria-selected={mode === "assignment"}
                onClick={() => setMode("assignment")}
                data-testid="tab-assignment"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  mode === "assignment"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Atribuição
              </button>
            </div>
          )}

          <Link href={clientMode ? `/client/events/${eventId}/guests` : `/events/${eventId}/guests`}>
            <Button variant="outline" size="sm" data-testid="button-guests-page">
              <Users className="w-3.5 h-3.5 mr-1.5" />
              Convidados
            </Button>
          </Link>

          <Link href={clientMode ? `/client/events/${eventId}/checkin` : `/events/${eventId}/checkin`}>
            <Button variant="outline" size="sm" data-testid="button-checkin-mode">
              Modo Check-in
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-72 bg-card border-r flex flex-col overflow-hidden shrink-0">
          {mode === "layout" ? (
            <div className="p-4 overflow-y-auto flex flex-col gap-4">
              <div>
                <h2 className="font-semibold text-sm text-foreground mb-3">Itens do Espaço</h2>
                <p className="text-xs text-muted-foreground mb-3">
                  Arraste um item para o mapa
                </p>
                {/* ── Seating & decor items ─────────────────────────────── */}
                <div className="grid grid-cols-2 gap-2">
                  {ITEM_TYPES.filter((it) => !WALL_ITEM_TYPES.has(it.type)).map((item, _i) => {
                    const idx = ITEM_TYPES.indexOf(item);
                    const capacity = seatOverrides[idx] ?? item.capacity;
                    const isSeating = item.capacity > 0;
                    return (
                      <div
                        key={item.type}
                        draggable
                        onDragStart={(e) => handleDragStartNewItem(e, item, idx)}
                        data-testid={`toolbar-item-${item.type}-${idx}`}
                        className="border bg-background rounded-lg px-2 pt-2.5 pb-2 text-center cursor-grab active:cursor-grabbing hover:border-primary hover:shadow-sm transition-all flex flex-col items-center gap-1.5 select-none"
                      >
                        <span className="text-[11px] font-medium leading-tight text-center">
                          {item.label.replace(/ \(\d+\)$/, "")}
                        </span>
                        {isSeating ? (
                          <div className="flex items-center gap-1 cursor-default" draggable={false} onDragStart={(e) => e.stopPropagation()}>
                            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setSeatOverrides((prev) => ({ ...prev, [idx]: Math.max(1, (prev[idx] ?? item.capacity) - 1) })); }} className="w-5 h-5 flex items-center justify-center rounded bg-muted hover:bg-primary hover:text-primary-foreground text-muted-foreground text-xs font-bold transition-colors">−</button>
                            <span className="text-[11px] font-semibold text-foreground min-w-[22px] text-center tabular-nums">{capacity}</span>
                            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setSeatOverrides((prev) => ({ ...prev, [idx]: Math.min(30, (prev[idx] ?? item.capacity) + 1) })); }} className="w-5 h-5 flex items-center justify-center rounded bg-muted hover:bg-primary hover:text-primary-foreground text-muted-foreground text-xs font-bold transition-colors">+</button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">decoração</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── Wall items ────────────────────────────────────────── */}
                <div className="pt-3 border-t border-border/60">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Fixos na parede
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {ITEM_TYPES.filter((it) => WALL_ITEM_TYPES.has(it.type)).map((item) => {
                      const idx = ITEM_TYPES.indexOf(item);
                      const wallColors: Record<string, string> = {
                        bathroom:        "#E8EEF8",
                        entrance:        "#D4F0D0",
                        "emergency-exit":"#FFF0D4",
                      };
                      return (
                        <div
                          key={item.type}
                          draggable
                          onDragStart={(e) => handleDragStartNewItem(e, item, idx)}
                          data-testid={`toolbar-item-${item.type}-${idx}`}
                          className="border rounded-lg px-2 pt-2.5 pb-2 text-center cursor-grab active:cursor-grabbing hover:border-primary hover:shadow-sm transition-all flex flex-col items-center gap-1 select-none"
                          style={{ backgroundColor: wallColors[item.type] ?? "#F5F5F5" }}
                        >
                          <span className="text-[11px] font-medium leading-tight text-center">{item.label}</span>
                          <span className="text-[10px] text-muted-foreground">parede</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Room drawing tool */}
              <div className="border-t pt-4">
                <h2 className="font-semibold text-sm text-foreground mb-2">Espaço do Evento</h2>
                <button
                  onClick={() => { setDrawMode(d => !d); drawModeRef.current = !drawModeRef.current; }}
                  className={`w-full py-1.5 rounded border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    drawMode
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground"
                  }`}
                >
                  {drawMode ? '✕ Cancelar desenho' : '+ Desenhar sala'}
                </button>
                {rooms.length > 1 && !drawMode && (
                  <button
                    onClick={() => setMergedView(v => !v)}
                    className={`mt-1.5 w-full py-1.5 rounded border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      mergedView
                        ? "bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100"
                        : "bg-background text-muted-foreground border-border hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    {mergedView ? '⬡ Mesclar: ativo' : '⬡ Mesclar áreas'}
                  </button>
                )}
                {drawMode && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
                    Clique e arraste no mapa para desenhar
                  </p>
                )}
                {!drawMode && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {rooms.length} sala{rooms.length !== 1 ? 's' : ''} · hover para redimensionar
                    {mergedView && " · bordas internas ocultas"}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b shrink-0 space-y-3">
                <div>
                  <h2 className="font-semibold text-sm text-foreground">Convidados não alocados</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stats?.unassignedGuests ?? 0} restantes — arraste para uma mesa
                  </p>
                </div>

                {/* Auto-assign button */}
                <Dialog open={autoAssignOpen} onOpenChange={(o) => { setAutoAssignOpen(o); if (!o) setAutoAssignResult(null); }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full gap-1.5" variant="secondary">
                      ⚡ Atribuição Automática
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Atribuição Automática</DialogTitle>
                    </DialogHeader>

                    {!autoAssignResult ? (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          O sistema distribui os convidados nas mesas agrupando por <strong>sobrenome</strong> e priorizando por <strong>nível de relação</strong> (grupo).
                        </p>

                        {/* Option */}
                        <div className="border rounded-lg divide-y">
                          <label className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                            <input
                              type="radio"
                              name="autoMode"
                              checked={autoAssignOnlyUnassigned}
                              onChange={() => setAutoAssignOnlyUnassigned(true)}
                              className="mt-0.5 shrink-0"
                            />
                            <div>
                              <p className="text-sm font-medium">Apenas não alocados</p>
                              <p className="text-xs text-muted-foreground">Preserva atribuições manuais existentes</p>
                            </div>
                          </label>
                          <label className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                            <input
                              type="radio"
                              name="autoMode"
                              checked={!autoAssignOnlyUnassigned}
                              onChange={() => setAutoAssignOnlyUnassigned(false)}
                              className="mt-0.5 shrink-0"
                            />
                            <div>
                              <p className="text-sm font-medium">Realocar todos</p>
                              <p className="text-xs text-muted-foreground">Limpa e redistribui todos os convidados</p>
                            </div>
                          </label>
                        </div>

                        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 space-y-1">
                          <p className="font-semibold text-foreground">Ordem de prioridade dos grupos:</p>
                          <p>1. Noivos / Casal</p>
                          <p>2. Família / Familiares</p>
                          <p>3. Amigos próximos</p>
                          <p>4. Amigos</p>
                          <p>5. Colegas / Trabalho</p>
                          <p>6. Conhecidos / sem grupo</p>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1" onClick={() => setAutoAssignOpen(false)}>
                            Cancelar
                          </Button>
                          <Button
                            className="flex-1"
                            disabled={autoAssignRunning}
                            onClick={handleAutoAssign}
                          >
                            {autoAssignRunning ? "Alocando..." : "Executar"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center space-y-1">
                          <p className="text-2xl font-bold text-green-700">{autoAssignResult.placed}</p>
                          <p className="text-sm text-green-600">convidados alocados</p>
                          {autoAssignResult.skipped > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">{autoAssignResult.skipped} não alocados (sem mesa disponível)</p>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground text-center">
                          Arraste convidados individualmente para ajustar.
                        </p>
                        <Button className="w-full" onClick={() => { setAutoAssignOpen(false); setAutoAssignResult(null); }}>
                          Concluir
                        </Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
              <div
                className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                onDrop={handleDropUnassign}
                data-testid="unassigned-drop-zone"
              >
                {(() => {
                  const unassigned = guests
                    .filter((g) => g.floorItemId == null)
                    .sort((a, b) => (guestOrderRef.current.get(a.id) ?? 0) - (guestOrderRef.current.get(b.id) ?? 0));
                  if (unassigned.length === 0) {
                    return (
                      <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                        Todos os convidados alocados!
                      </div>
                    );
                  }

                  // Group by vocativo; guests without vocativo get their own entry
                  const grouped: Array<{ vocativo?: string | null; guests: typeof unassigned }> = [];
                  const seen = new Map<string, number>();
                  for (const g of unassigned) {
                    if (g.vocativo) {
                      const existing = seen.get(g.vocativo);
                      if (existing !== undefined) {
                        grouped[existing].guests.push(g);
                      } else {
                        seen.set(g.vocativo, grouped.length);
                        grouped.push({ vocativo: g.vocativo, guests: [g] });
                      }
                    } else {
                      grouped.push({ vocativo: null, guests: [g] });
                    }
                  }

                  // Sort groups by their stable anchor position so removing a member
                  // never causes the group to jump to a different slot in the list.
                  grouped.sort((a, b) => {
                    const posA = a.vocativo
                      ? (groupAnchorRef.current.get(a.vocativo) ?? guestOrderRef.current.get(a.guests[0]?.id) ?? 0)
                      : (guestOrderRef.current.get(a.guests[0]?.id) ?? 0);
                    const posB = b.vocativo
                      ? (groupAnchorRef.current.get(b.vocativo) ?? guestOrderRef.current.get(b.guests[0]?.id) ?? 0)
                      : (guestOrderRef.current.get(b.guests[0]?.id) ?? 0);
                    return posA - posB;
                  });

                  return grouped.map((group, gi) => (
                    <div
                      key={group.vocativo ?? `solo-${group.guests[0]?.id ?? gi}`}
                      draggable={!!group.vocativo}
                      onDragStart={group.vocativo ? (e) => handleDragStartGroup(e, group.guests.map((g) => g.id)) : undefined}
                      className={group.vocativo ? "rounded-lg border border-border/70 bg-muted/30 p-2 space-y-1.5 cursor-grab active:cursor-grabbing" : ""}
                    >
                      {group.vocativo && (
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 truncate flex items-center gap-1.5" title={`Arrastar grupo: ${group.vocativo}`}>
                          <GripHorizontal className="w-3 h-3 shrink-0 opacity-50" />
                          👨‍👩‍👧 {group.vocativo}
                          <span className="ml-auto text-[9px] font-normal opacity-60 normal-case tracking-normal">{group.guests.length} pessoas</span>
                        </p>
                      )}
                      {group.guests.map((guest) => (
                        <div
                          key={guest.id}
                          draggable
                          onDragStart={(e) => handleDragStartGuest(e, guest.id)}
                          data-testid={`guest-card-${guest.id}`}
                          className="bg-background border rounded-md px-3 py-2 cursor-grab active:cursor-grabbing hover:border-primary hover:shadow-sm transition-all flex items-center gap-2"
                        >
                          <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{guest.name}</p>
                            <div className="flex flex-wrap gap-x-2 gap-y-0 mt-0.5">
                              {guest.group && (
                                <span className="text-[10px] text-muted-foreground truncate">{guest.group}</span>
                              )}
                              {guest.ageRange && (
                                <span className="text-[10px] text-blue-500/80 truncate">{guest.ageRange}</span>
                              )}
                            </div>
                            {guest.notes && (
                              <p className="text-[10px] text-amber-600/80 truncate mt-0.5" title={guest.notes}>
                                {guest.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </aside>

        {/* Center Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <div
            ref={viewportRef}
            className="absolute inset-0 overflow-hidden"
            style={{
              backgroundColor: "hsl(84,8%,92%)",
              backgroundImage: `radial-gradient(circle, hsl(84,8%,55%) 0.7px, transparent 0.7px)`,
              backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
              backgroundPosition: `${((pan.x % (GRID_SIZE * zoom)) + GRID_SIZE * zoom) % (GRID_SIZE * zoom)}px ${((pan.y % (GRID_SIZE * zoom)) + GRID_SIZE * zoom) % (GRID_SIZE * zoom)}px`,
            }}
          >
          <div
            ref={containerRef}
            data-testid="floor-canvas"
            className="relative"
            style={{
              width: VIRTUAL_W,
              height: VIRTUAL_H,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              cursor: drawMode ? 'crosshair' : isPanningRef.current ? "grabbing" : "grab",
            }}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            onDragOver={handleDragOverCanvas}
            onDrop={handleDropCanvas}
          >
            {/* Room floor areas — merged SVG layer or individual rects */}
            {mergedView && rooms.length > 1
              ? <MergedRoomsLayer rooms={rooms} />
              : null}
            {rooms.map(room => (
              <RoomRect
                key={room.id}
                room={room}
                mode={mode}
                merged={mergedView && rooms.length > 1}
                canDelete={rooms.length > 1}
                onDelete={(id) => setRooms(prev => prev.filter(r => r.id !== id))}
                onResizeDown={handleRoomResizeDown}
                onResizeMove={handleRoomResizeMove}
                onResizeUp={handleRoomResizeUp}
              />
            ))}
            {/* In-progress drawing preview */}
            {drawing && (() => {
              const dx = Math.min(drawing.startX, drawing.endX);
              const dy = Math.min(drawing.startY, drawing.endY);
              const dw = Math.abs(drawing.endX - drawing.startX);
              const dh = Math.abs(drawing.endY - drawing.startY);
              return (
                <div
                  className="absolute border-2 border-dashed border-primary bg-primary/10 pointer-events-none"
                  style={{ left: dx, top: dy, width: dw, height: dh, zIndex: 100 }}
                />
              );
            })()}
            {(() => {
              const seatingTypes = ["round-table", "rectangle-table", "square-table", "couple-table"];
              const tableNumberMap = new Map(
                [...floorItems]
                  .filter((fi) => seatingTypes.includes(fi.type))
                  .sort((a, b) => a.id - b.id)
                  .map((fi, i) => [fi.id, i + 1])
              );
              return floorItems.map((item) => {
              const assignedToTable = guests.filter((g) => g.floorItemId === item.id);
              const isFull = item.capacity > 0 && assignedToTable.length >= item.capacity;
              const isRound = item.type === "round-table";
              const isNonSeating = item.capacity === 0;
              const isWallItem = WALL_ITEM_TYPES.has(item.type);
              const isDraggingThis = draggingId === item.id;
              const tableNum = tableNumberMap.get(item.id);
              const displayLabel = tableNum != null ? `Mesa ${tableNum}` : (item.label ?? item.type);

              const wallItemStyle: Record<string, { bg: string; border: string; text: string }> = {
                bathroom:        { bg: "#E8EEF8", border: "#6080C0", text: "#2A4080" },
                entrance:        { bg: "#D4F0D0", border: "#4A9A4A", text: "#1A5A1A" },
                "emergency-exit":{ bg: "#FFF0CC", border: "#D07020", text: "#7A3A00" },
              };

              const pos = localPos[item.id] ?? { x: item.x, y: item.y };
              const { w: displayW, h: displayH } = isWallItem
                ? (localSize[item.id] ?? { w: item.width, h: item.height })
                : computeTableSize(item.type, item.capacity);

              return (
                <div
                  key={item.id}
                  data-testid={`floor-item-${item.id}`}
                  onPointerDown={(e) => handleItemPointerDown(e, item)}
                  onPointerMove={(e) => handleItemPointerMove(e, item)}
                  onPointerUp={(e) => handleItemPointerUp(e, item)}
                  onPointerCancel={(e) => handleItemPointerUp(e, item)}
                  onMouseEnter={() => {
                    if (mode === "layout") setHoveredItemId(item.id);
                    if (mode === "assignment") setHoveredTableId(item.id);
                  }}
                  onMouseLeave={() => { setHoveredItemId(null); setHoveredTableId(null); }}
                  onDragOver={
                    mode === "assignment" && !isFull
                      ? handleDragOverTable
                      : undefined
                  }
                  onDrop={
                    mode === "assignment" && !isFull
                      ? (e) => handleDropOnTable(e, item.id, item.capacity)
                      : undefined
                  }
                  className="absolute overflow-visible"
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: displayW,
                    height: displayH,
                    touchAction: "none",
                    userSelect: "none",
                    transform: `rotate(${localRotation[item.id] ?? item.rotation ?? 0}deg)`,
                    transformOrigin: "center",
                    zIndex: isDraggingThis ? 50 : 10,
                  }}
                >
                  {/* Wall item resize handles */}
                  {isWallItem && mode === "layout" && (() => {
                    const { side: wallSide } = getRoomWallSide(pos.x, pos.y, displayW, displayH, roomsRef.current);
                    return (["top", "bottom", "left", "right"] as const).map((edge) => {
                      if (edge === wallSide) return null;
                      const isHorz = edge === "top" || edge === "bottom";
                      const isHovered = hoveredItemId === item.id;
                      const edgeStyle: React.CSSProperties = {
                        position: "absolute",
                        zIndex: 60,
                        cursor: isHorz ? "ns-resize" : "ew-resize",
                        backgroundColor: isHovered ? "rgba(80,110,200,0.45)" : "rgba(80,110,200,0.15)",
                        borderRadius: 3,
                        transition: "background-color 0.15s ease",
                        ...(edge === "top"    && { top: -4, left: 6, right: 6, height: 8 }),
                        ...(edge === "bottom" && { bottom: -4, left: 6, right: 6, height: 8 }),
                        ...(edge === "left"   && { left: -4, top: 6, bottom: 6, width: 8 }),
                        ...(edge === "right"  && { right: -4, top: 6, bottom: 6, width: 8 }),
                      };
                      return (
                        <div
                          key={edge}
                          data-resize-handle="true"
                          style={edgeStyle}
                          onPointerDown={(e) => handleResizePointerDown(e, item, edge)}
                          onPointerMove={(e) => handleResizePointerMove(e, item)}
                          onPointerUp={(e) => handleResizePointerUp(e, item)}
                          onPointerCancel={(e) => handleResizePointerUp(e, item)}
                        />
                      );
                    });
                  })()}

                  {/* Chairs */}
                  {getChairPositions(item.type, displayW, displayH, item.capacity).map((ch, i) => {
                    const seatNum = i + 1;
                    const guestInSeat = mode === "assignment"
                      ? assignedToTable.find((g) => g.seatNumber === seatNum) ?? null
                      : null;
                    return (
                      <div
                        key={i}
                        draggable={!!guestInSeat}
                        onDragStart={guestInSeat ? (e) => { e.stopPropagation(); handleDragStartGuest(e, guestInSeat.id); } : undefined}
                        className={`absolute flex items-center justify-center overflow-hidden select-none
                          ${mode === "assignment" ? "rounded-[4px]" : "rounded-[3px]"}
                          ${guestInSeat ? "border-[#727A68] cursor-grab" : "bg-white border-[#C9A990] cursor-default"}
                        `}
                        style={{
                          left: ch.left,
                          top: ch.top,
                          width: ch.width,
                          height: ch.height,
                          transform: ch.transform,
                          backgroundColor: guestInSeat ? "#B5C2B0" : "#FFFFFF",
                          borderWidth: 1,
                          borderStyle: "solid",
                          transition: "background-color 0.25s ease",
                          pointerEvents: guestInSeat ? "auto" : "none",
                        }}
                      >
                        {guestInSeat && (
                          <span
                            className="text-[7px] font-semibold leading-none truncate px-0.5 pointer-events-none"
                            style={{ color: "#2E3C2D" }}
                          >
                            {guestInSeat.name.split(" ")[0]}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Table body */}
                  <div
                    className={`absolute inset-0 flex flex-col items-center justify-center border-2 transition-colors overflow-visible
                      ${mode === "layout" ? "cursor-grab active:cursor-grabbing" : "cursor-default"}
                      ${isDraggingThis ? "shadow-xl border-primary" : "shadow-sm"}
                      ${mode === "assignment" && !isFull && !isNonSeating ? "hover:border-primary/60" : ""}
                    `}
                    style={{
                      backgroundColor: isWallItem
                        ? wallItemStyle[item.type]?.bg ?? "#F5F5F5"
                        : isFull ? "#F8FAFC" : "#FFFFFF",
                      borderColor: isWallItem
                        ? wallItemStyle[item.type]?.border ?? "#888"
                        : isDraggingThis ? undefined : "#C9A990",
                      borderRadius: isRound ? "50%" : isWallItem ? "6px" : "12px",
                    }}
                  >
                    {/* Controls — visible on hover in layout mode */}
                    {mode === "layout" && hoveredItemId === item.id && (
                      <>
                        {/* Delete */}
                        <button
                          onClick={(e) => handleDeleteItem(e, item.id)}
                          data-testid={`delete-item-${item.id}`}
                          className="absolute -top-3 -right-3 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md hover:bg-destructive/80 transition-colors z-50"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {/* Rotate CCW */}
                        <button
                          onClick={(e) => handleRotate(e, item, -1)}
                          data-testid={`rotate-ccw-${item.id}`}
                          className="absolute -bottom-3 -left-3 w-6 h-6 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center shadow-md hover:bg-secondary/80 transition-colors z-50"
                          title="Girar -45°"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                        {/* Angle badge */}
                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-semibold bg-card border rounded px-1 shadow-sm z-50 whitespace-nowrap pointer-events-none">
                          {localRotation[item.id] ?? item.rotation ?? 0}°
                        </div>
                        {/* Rotate CW */}
                        <button
                          onClick={(e) => handleRotate(e, item, 1)}
                          data-testid={`rotate-cw-${item.id}`}
                          className="absolute -bottom-3 -right-3 w-6 h-6 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center shadow-md hover:bg-secondary/80 transition-colors z-50"
                          title="Girar +45°"
                        >
                          <RotateCw className="w-3 h-3" />
                        </button>
                      </>
                    )}

                    {/* Center label — no circle, just text */}
                    <div className="flex flex-col items-center justify-center pointer-events-none">
                      <span
                        className="text-[10px] font-bold text-center leading-tight px-1"
                        style={{ color: isWallItem ? (wallItemStyle[item.type]?.text ?? "#333") : isFull ? "#5A3E2E" : isNonSeating ? "#6B5445" : "#3A4A38" }}
                      >
                        {displayLabel}
                      </span>
                      {item.capacity > 0 && (
                        <span
                          className="text-[9px] font-medium leading-none mt-0.5"
                          style={{ color: isFull ? "#C9A990" : "#9BA89A" }}
                        >
                          {assignedToTable.length}/{item.capacity}
                        </span>
                      )}
                    </div>

                    {/* Guest tooltip — assignment mode hover */}
                    {mode === "assignment" && hoveredTableId === item.id && assignedToTable.length > 0 && (
                      <div
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-[100] pointer-events-none"
                        style={{ minWidth: 140 }}
                      >
                        <div className="bg-white border border-slate-200 rounded-lg shadow-xl px-3 py-2">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                            {displayLabel} · {assignedToTable.length}/{item.capacity}
                          </p>
                          {[...assignedToTable]
                            .sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0))
                            .map((g) => (
                              <p key={g.id} className="text-[11px] text-slate-700 leading-[1.6] flex items-center gap-1.5">
                                <span className="text-[9px] text-slate-300 font-mono w-3 text-right shrink-0">
                                  {g.seatNumber ?? "·"}
                                </span>
                                {g.name}
                              </p>
                            ))}
                        </div>
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
                          style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid #fff", filter: "drop-shadow(0 1px 0 #e2e8f0)" }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
              });
            })()}
          </div>
          </div>
          {/* Floating zoom controls — always fixed to bottom-right of map area */}
          <div className="absolute bottom-5 right-5 z-30 flex items-center gap-1 bg-card border shadow-lg rounded-lg px-2 py-1.5">
            <button
              onClick={() => applyZoom(-ZOOM_STEP)}
              disabled={zoom <= ZOOM_MIN}
              data-testid="zoom-out"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted disabled:opacity-40 transition-colors"
              title="Diminuir zoom (Ctrl + Scroll)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={resetZoom}
              data-testid="zoom-reset"
              className="min-w-[48px] text-center text-xs font-semibold tabular-nums hover:bg-muted rounded px-1 py-0.5 transition-colors"
              title="Resetar zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => applyZoom(ZOOM_STEP)}
              disabled={zoom >= ZOOM_MAX}
              data-testid="zoom-in"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted disabled:opacity-40 transition-colors"
              title="Aumentar zoom (Ctrl + Scroll)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-border mx-0.5" />
            <button
              onClick={recenter}
              data-testid="recenter"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors"
              title="Centralizar composição"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetZoom}
              data-testid="zoom-fit"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors"
              title="Zoom 100%"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Sidebar - Stats */}
        <aside className="w-60 bg-card border-l flex flex-col shrink-0">
          <div className="p-4 border-b">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Estatísticas</p>

            {/* Big numbers */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                <p className="text-2xl font-bold text-foreground leading-none">{stats?.totalGuests ?? 0}</p>
                <p className="text-[10px] text-muted-foreground mt-1">convidados</p>
              </div>
              <div
                className="rounded-lg p-2.5 text-center"
                style={{
                  backgroundColor: (stats?.totalGuests ?? 0) > (stats?.totalSeats ?? 0)
                    ? "#FEF3C7"
                    : "hsl(var(--muted) / 0.5)",
                }}
              >
                <p
                  className="text-2xl font-bold leading-none"
                  style={{ color: (stats?.totalGuests ?? 0) > (stats?.totalSeats ?? 0) ? "#B45309" : undefined }}
                >
                  {stats?.totalSeats ?? 0}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">lugares</p>
              </div>
            </div>

            {/* Shortage warning */}
            {(stats?.totalGuests ?? 0) > (stats?.totalSeats ?? 0) && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                <span className="mt-0.5 text-amber-500 shrink-0">⚠</span>
                <p className="text-[11px] leading-snug text-amber-800 font-medium">
                  Faltam <strong>{(stats?.totalGuests ?? 0) - (stats?.totalSeats ?? 0)}</strong> lugar{(stats?.totalGuests ?? 0) - (stats?.totalSeats ?? 0) !== 1 ? "es" : ""} no mapa para acomodar todos os convidados.
                </p>
              </div>
            )}

            {/* Allocation bar */}
            {(stats?.totalGuests ?? 0) > 0 && (
              <div className="mb-3">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Alocados</span>
                  <span>{stats?.assignedGuests ?? 0} / {stats?.totalGuests ?? 0}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.round(((stats?.assignedGuests ?? 0) / (stats?.totalGuests ?? 1)) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Detail rows */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                  Alocados
                </span>
                <span className="text-xs font-semibold text-foreground">{stats?.assignedGuests ?? 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-destructive/60 inline-block" />
                  Não alocados
                </span>
                <span className="text-xs font-semibold text-foreground">{stats?.unassignedGuests ?? 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent/80 inline-block" />
                  Lugares livres
                </span>
                <span className="text-xs font-semibold text-foreground">{stats?.availableSeats ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="p-4">
            <Link href={clientMode ? `/client/events/${eventId}/guests` : `/events/${eventId}/guests`}>
              <Button variant="outline" className="w-full" size="sm">
                <Users className="w-4 h-4 mr-2" />
                Convidados
              </Button>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Guest Import Dialog ───────────────────────────────────────────────────

type ParsedRow = { name: string; group?: string; phone?: string; gender?: string; ageRange?: string; notes?: string; vocativo?: string };

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function detectColumn(headers: string[], candidates: string[]): number {
  const norms = headers.map(normalizeHeader);
  // Score each header against every candidate; pick the highest-scoring one.
  // Exact match: 1000 + candidate.length (longer exact match beats shorter exact match)
  // Partial match (header contains candidate): candidate.length
  let bestIdx = -1;
  let bestScore = -1;
  norms.forEach((norm, i) => {
    for (const c of candidates) {
      let score = -1;
      if (norm === c) score = 1000 + c.length;
      else if (norm.includes(c)) score = c.length;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
  });
  return bestIdx;
}

// All candidate sets used to score rows and find the best header row
const COLUMN_CANDIDATES = {
  name:     ["nome dos convidados", "nome do convidado", "nome", "name", "convidado", "guest"],
  group:    ["grupo do convite", "grupo", "group", "familia"],
  phone:    ["fone para confirmacao", "telefone", "phone", "cel", "celular", "fone"],
  gender:   ["genero", "gender", "sexo"],
  ageRange: ["faixa etaria", "faixa_etaria", "faixaetaria", "age range", "age_range", "agerange", "faixa", "idade"],
  notes:    ["observacao do convite", "observacoes do convite", "observacao", "observacoes", "obs", "notes", "nota", "notas"],
  vocativo: ["vocativo para convite", "vocativo"],
} as const;

// Find which row index is most likely the header row (checks first 5 rows)
function findHeaderRowIndex(rows: string[][]): number {
  const sets = Object.values(COLUMN_CANDIDATES);
  let bestRow = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const rowStrs = rows[i].map(String);
    const score = sets.filter((candidates) => detectColumn(rowStrs, [...candidates]) !== -1).length;
    if (score > bestScore) { bestScore = score; bestRow = i; }
  }
  return bestRow;
}

async function parseFile(file: File): Promise<ParsedRow[]> {
  const xlsx = await import("xlsx");
  const data = await file.arrayBuffer();
  const workbook = xlsx.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: string[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][];
  if (rows.length < 2) return [];

  const headerRowIdx = findHeaderRowIndex(rows);
  const headers = rows[headerRowIdx].map(String);

  const nameIdx     = detectColumn(headers, [...COLUMN_CANDIDATES.name]);
  const groupIdx    = detectColumn(headers, [...COLUMN_CANDIDATES.group]);
  const phoneIdx    = detectColumn(headers, [...COLUMN_CANDIDATES.phone]);
  const genderIdx   = detectColumn(headers, [...COLUMN_CANDIDATES.gender]);
  const ageRangeIdx = detectColumn(headers, [...COLUMN_CANDIDATES.ageRange]);
  const notesIdx    = detectColumn(headers, [...COLUMN_CANDIDATES.notes]);
  const vocativoIdx = detectColumn(headers, [...COLUMN_CANDIDATES.vocativo]);

  if (nameIdx === -1) throw new Error("Coluna 'Nome' não encontrada. Use um cabeçalho: nome, name ou convidado.");

  // Track the current vocativo group — when a row has a vocativo, all following
  // rows without one (but with a name) belong to the same family group.
  let currentVocativo: string | undefined = undefined;
  // Also carry the group/phone from the vocativo row down to grouped rows
  let currentGroup: string | undefined = undefined;
  let currentPhone: string | undefined = undefined;

  return rows.slice(headerRowIdx + 1)
    .map((row) => {
      const name     = String(row[nameIdx] ?? "").trim();
      const rawVoc   = vocativoIdx >= 0 ? String(row[vocativoIdx] ?? "").trim() : "";
      const rawGroup = groupIdx    >= 0 ? String(row[groupIdx]    ?? "").trim() : "";
      const rawPhone = phoneIdx    >= 0 ? String(row[phoneIdx]    ?? "").trim() : "";

      if (rawVoc) {
        currentVocativo = rawVoc;
        currentGroup    = rawGroup || undefined;
        currentPhone    = rawPhone || undefined;
      }

      return {
        name,
        vocativo: currentVocativo,
        group:    rawGroup || currentGroup || undefined,
        phone:    rawPhone || currentPhone || undefined,
        gender:   genderIdx   >= 0 ? String(row[genderIdx]   ?? "").trim() || undefined : undefined,
        ageRange: ageRangeIdx >= 0 ? String(row[ageRangeIdx] ?? "").trim() || undefined : undefined,
        notes:    notesIdx    >= 0 ? String(row[notesIdx]     ?? "").trim() || undefined : undefined,
      };
    })
    .filter((r) => r.name.length > 0);
}

function GuestImportDialog({ eventId }: { eventId: number }) {
  const queryClient = useQueryClient();
  const createGuest = useCreateGuest();

  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "importing" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]);
    setParseError(null);
    setFileName(null);
    setStatus("idle");
    setProgress(0);
    setFailCount(0);
  };

  const handleFile = async (file: File) => {
    setParseError(null);
    setRows([]);
    setFileName(file.name);
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) {
        setParseError("Nenhuma linha válida encontrada na planilha.");
        return;
      }
      setRows(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Erro ao ler o arquivo.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    setStatus("importing");
    setProgress(0);
    setFailCount(0);
    let fails = 0;
    for (let i = 0; i < rows.length; i++) {
      try {
        await new Promise<void>((resolve, reject) => {
          createGuest.mutate(
            { eventId, data: rows[i] },
            { onSuccess: () => resolve(), onError: () => reject() }
          );
        });
      } catch {
        fails++;
      }
      setProgress(i + 1);
    }
    setFailCount(fails);
    setStatus("done");
    queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(eventId) });
    queryClient.invalidateQueries({ queryKey: getGetEventStatsQueryKey(eventId) });
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    setOpen(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" size="sm" data-testid="button-import-guests">
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Importar Planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Convidados via Planilha</DialogTitle>
        </DialogHeader>

        {status === "done" ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <div className="text-center">
              <p className="text-lg font-semibold">
                {progress - failCount} convidado{progress - failCount !== 1 ? "s" : ""} importado{progress - failCount !== 1 ? "s" : ""}
              </p>
              {failCount > 0 && (
                <p className="text-sm text-destructive mt-1">{failCount} falha{failCount > 1 ? "s" : ""} ao importar</p>
              )}
            </div>
            <Button onClick={() => handleClose(false)} className="w-full">Fechar</Button>
          </div>
        ) : status === "importing" ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Importando {progress} de {rows.length}...
            </p>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(progress / rows.length) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Drop zone */}
            {rows.length === 0 && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors
                  ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/40"}`}
              >
                <Upload className="w-8 h-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Arraste um arquivo ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mt-1">Suporta .xlsx, .xls e .csv</p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>
            )}

            {/* Format hint */}
            {rows.length === 0 && !parseError && (
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Formato esperado:</p>
                <p>A primeira linha deve ter cabeçalhos. Colunas reconhecidas:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><span className="font-mono">nome</span> / <span className="font-mono">name</span> — <span className="text-foreground font-medium">obrigatório</span></li>
                  <li><span className="font-mono">genero</span> / <span className="font-mono">gender</span> / <span className="font-mono">sexo</span></li>
                  <li><span className="font-mono">faixa etaria</span> / <span className="font-mono">idade</span></li>
                  <li><span className="font-mono">telefone</span> / <span className="font-mono">phone</span></li>
                  <li><span className="font-mono">grupo</span> / <span className="font-mono">group</span></li>
                </ul>
                <p className="pt-0.5 text-[10px]">O cabeçalho não precisa ser exato — basta conter o termo.</p>
              </div>
            )}

            {/* Error */}
            {parseError && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{parseError}</p>
              </div>
            )}

            {/* Preview table */}
            {rows.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {rows.length} convidado{rows.length !== 1 ? "s" : ""} encontrado{rows.length !== 1 ? "s" : ""}
                    <span className="text-muted-foreground font-normal"> em <span className="font-mono text-xs">{fileName}</span></span>
                  </p>
                  <button
                    onClick={reset}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Trocar arquivo
                  </button>
                </div>
                <div className="border rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nome</th>
                        {rows.some((r) => r.gender   !== undefined) && <th className="text-left px-3 py-2 font-medium text-muted-foreground">Gênero</th>}
                        {rows.some((r) => r.ageRange !== undefined) && <th className="text-left px-3 py-2 font-medium text-muted-foreground">Faixa Etária</th>}
                        {rows.some((r) => r.phone    !== undefined) && <th className="text-left px-3 py-2 font-medium text-muted-foreground">Telefone</th>}
                        {rows.some((r) => r.group    !== undefined) && <th className="text-left px-3 py-2 font-medium text-muted-foreground">Grupo</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-t border-border/50 odd:bg-muted/20">
                          <td className="px-3 py-1.5 font-medium">{r.name}</td>
                          {rows.some((r) => r.gender   !== undefined) && <td className="px-3 py-1.5 text-muted-foreground">{r.gender   ?? "—"}</td>}
                          {rows.some((r) => r.ageRange !== undefined) && <td className="px-3 py-1.5 text-muted-foreground">{r.ageRange ?? "—"}</td>}
                          {rows.some((r) => r.phone    !== undefined) && <td className="px-3 py-1.5 text-muted-foreground">{r.phone    ?? "—"}</td>}
                          {rows.some((r) => r.group    !== undefined) && <td className="px-3 py-1.5 text-muted-foreground">{r.group    ?? "—"}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button onClick={handleImport} className="w-full">
                  Importar {rows.length} convidado{rows.length !== 1 ? "s" : ""}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GuestManagementDialog({ eventId }: { eventId: number }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const createGuest = useCreateGuest();

  const formSchema = z.object({
    name: z.string().min(1, "Nome obrigatório"),
    group: z.string().optional(),
    phone: z.string().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", group: "", phone: "" },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createGuest.mutate(
      { eventId, data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(eventId) });
          queryClient.invalidateQueries({ queryKey: getGetEventStatsQueryKey(eventId) });
          form.reset();
          setOpen(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" size="sm" data-testid="button-add-guest">
          Adicionar Convidado
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Convidado</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Maria Oliveira" {...field} data-testid="input-guest-name" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="group"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grupo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Família da Noiva" {...field} data-testid="input-guest-group" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="(11) 99999-9999" {...field} data-testid="input-guest-phone" />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={createGuest.isPending}
              data-testid="button-save-guest"
            >
              {createGuest.isPending ? "Salvando..." : "Salvar Convidado"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
