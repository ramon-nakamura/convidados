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
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  FloorItemInputType,
  FloorItemInput,
  type ListFloorItemsResponseItem,
} from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, GripHorizontal, Users, Map as MapIcon, X, ZoomIn, ZoomOut, Maximize2, RotateCw, RotateCcw } from "lucide-react";
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
  { type: "round-table", label: "Mesa Redonda (8)", capacity: 8, w: 110, h: 110 },
  { type: "round-table", label: "Mesa Redonda (10)", capacity: 10, w: 130, h: 130 },
  { type: "rectangle-table", label: "Mesa Retangular (8)", capacity: 8, w: 170, h: 80 },
  { type: "couple-table", label: "Mesa dos Noivos", capacity: 2, w: 200, h: 70 },
  { type: "buffet-table", label: "Buffet", capacity: 0, w: 200, h: 60 },
  { type: "stage", label: "Palco", capacity: 0, w: 280, h: 90 },
  { type: "dj-booth", label: "DJ Booth", capacity: 0, w: 100, h: 80 },
  { type: "bathroom", label: "Banheiro", capacity: 0, w: 80, h: 80 },
];

const ROTATION_PRESETS = [0, 45, 90, 135, 180, 225, 270, 315];

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

const CANVAS_PRESETS = [
  { label: "P", width: 800, height: 600 },
  { label: "M", width: 1100, height: 780 },
  { label: "G", width: 1440, height: 960 },
  { label: "XG", width: 1800, height: 1200 },
];

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

export default function EventEditor() {
  const { eventId: eventIdStr } = useParams();
  const eventId = parseInt(eventIdStr || "0", 10);
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"layout" | "assignment">("layout");
  const [canvasWidth, setCanvasWidth] = useState(800);
  const [canvasHeight, setCanvasHeight] = useState(600);

  // Smooth pointer-drag state (for moving existing items)
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [localPos, setLocalPos] = useState<Record<number, { x: number; y: number }>>({});
  const dragRef = useRef<DragState | null>(null);

  // Hover state for showing delete button
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);

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

  // Pan state
  const isPanningRef = useRef(false);
  const panRef = useRef<{
    startScrollX: number;
    startScrollY: number;
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

  const canvasScrollRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

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

  // ── Ctrl+Wheel zoom ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = canvasScrollRef.current;
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

  // ── Pan handlers (drag canvas background to scroll) ─────────────────────
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.target !== containerRef.current) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      isPanningRef.current = true;
      panRef.current = {
        startScrollX: canvasScrollRef.current?.scrollLeft ?? 0,
        startScrollY: canvasScrollRef.current?.scrollTop ?? 0,
        startPointerX: e.clientX,
        startPointerY: e.clientY,
      };
    },
    []
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanningRef.current || !panRef.current || !canvasScrollRef.current) return;
      const dx = e.clientX - panRef.current.startPointerX;
      const dy = e.clientY - panRef.current.startPointerY;
      canvasScrollRef.current.scrollLeft = panRef.current.startScrollX - dx;
      canvasScrollRef.current.scrollTop = panRef.current.startScrollY - dy;
    },
    []
  );

  const handleCanvasPointerUp = useCallback(() => {
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
      if ((e.target as HTMLElement).closest("button")) return;
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
      if (!dragRef.current || dragRef.current.id !== item.id) return;
      const z = zoomRef.current;
      const dx = (e.clientX - dragRef.current.startPointerX) / z;
      const dy = (e.clientY - dragRef.current.startPointerY) / z;
      const rawX = dragRef.current.itemOriginX + dx;
      const rawY = dragRef.current.itemOriginY + dy;
      const newX = Math.max(0, Math.min(snapToGrid(rawX), canvasWidth - item.width));
      const newY = Math.max(0, Math.min(snapToGrid(rawY), canvasHeight - item.height));
      setLocalPos((prev) => ({ ...prev, [item.id]: { x: newX, y: newY } }));
    },
    [canvasWidth, canvasHeight]
  );

  const handleItemPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, item: ListFloorItemsResponseItem) => {
      if (!dragRef.current || dragRef.current.id !== item.id) return;
      const raw = localPos[item.id] ?? { x: item.x, y: item.y };
      const pos = { x: snapToGrid(raw.x), y: snapToGrid(raw.y) };
      setLocalPos((prev) => ({ ...prev, [item.id]: pos }));
      updateFloorItem.mutate(
        { eventId, floorItemId: item.id, data: { x: pos.x, y: pos.y } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFloorItemsQueryKey(eventId) }) }
      );
      dragRef.current = null;
      setDraggingId(null);
    },
    [localPos, eventId, updateFloorItem, queryClient]
  );

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
    const rawX = (e.clientX - rect.left) / z - data.w / 2;
    const rawY = (e.clientY - rect.top) / z - data.h / 2;
    const x = Math.max(0, Math.min(snapToGrid(rawX), canvasWidth - data.w));
    const y = Math.max(0, Math.min(snapToGrid(rawY), canvasHeight - data.h));
    const newItem: FloorItemInput = {
      type: data.type as FloorItemInputType,
      label: data.label,
      x,
      y,
      width: data.w,
      height: data.h,
      rotation: 0,
      capacity: data.capacity,
    };
    createFloorItem.mutate(
      { eventId, data: newItem },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFloorItemsQueryKey(eventId) }) }
    );
  };

  // ── HTML5 DnD: guest assignment ─────────────────────────────────────────
  const handleDragStartGuest = (e: React.DragEvent, guestId: number) => {
    e.dataTransfer.setData("guestId", guestId.toString());
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
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(eventId) });
          queryClient.invalidateQueries({ queryKey: getGetEventStatsQueryKey(eventId) });
        },
      }
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
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-primary leading-tight">{event.name}</h1>
            <p className="text-xs text-muted-foreground">Editor de Mapa</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode toggle */}
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

          <Link href={`/events/${eventId}/checkin`}>
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
                <div className="grid grid-cols-2 gap-2">
                  {ITEM_TYPES.map((item, idx) => {
                    const capacity = seatOverrides[idx] ?? item.capacity;
                    const isSeating = item.capacity > 0;
                    return (
                      <div
                        key={idx}
                        draggable
                        onDragStart={(e) => handleDragStartNewItem(e, item, idx)}
                        data-testid={`toolbar-item-${item.type}-${idx}`}
                        className="border bg-background rounded-lg px-2 pt-2.5 pb-2 text-center cursor-grab active:cursor-grabbing hover:border-primary hover:shadow-sm transition-all flex flex-col items-center gap-1.5 select-none"
                      >
                        <span className="text-[11px] font-medium leading-tight text-center">
                          {item.label.replace(/ \(\d+\)$/, "")}
                        </span>

                        {isSeating ? (
                          <div
                            className="flex items-center gap-1 cursor-default"
                            draggable={false}
                            onDragStart={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSeatOverrides((prev) => ({
                                  ...prev,
                                  [idx]: Math.max(1, (prev[idx] ?? item.capacity) - 1),
                                }));
                              }}
                              className="w-5 h-5 flex items-center justify-center rounded bg-muted hover:bg-primary hover:text-primary-foreground text-muted-foreground text-xs font-bold transition-colors"
                            >
                              −
                            </button>
                            <span className="text-[11px] font-semibold text-foreground min-w-[22px] text-center tabular-nums">
                              {capacity}
                            </span>
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSeatOverrides((prev) => ({
                                  ...prev,
                                  [idx]: Math.min(30, (prev[idx] ?? item.capacity) + 1),
                                }));
                              }}
                              className="w-5 h-5 flex items-center justify-center rounded bg-muted hover:bg-primary hover:text-primary-foreground text-muted-foreground text-xs font-bold transition-colors"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">decoração</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Canvas size controls */}
              <div className="border-t pt-4">
                <h2 className="font-semibold text-sm text-foreground mb-2">Tamanho do Espaço</h2>
                <div className="flex gap-1.5">
                  {CANVAS_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setCanvasWidth(preset.width);
                        setCanvasHeight(preset.height);
                      }}
                      data-testid={`canvas-preset-${preset.label}`}
                      className={`flex-1 py-1.5 rounded border text-xs font-semibold transition-all ${
                        canvasWidth === preset.width && canvasHeight === preset.height
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {canvasWidth} × {canvasHeight} px
                </p>
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
                {guests
                  .filter((g) => g.floorItemId == null)
                  .map((guest) => (
                    <div
                      key={guest.id}
                      draggable
                      onDragStart={(e) => handleDragStartGuest(e, guest.id)}
                      data-testid={`guest-card-${guest.id}`}
                      className="bg-background border rounded-md px-3 py-2 cursor-grab active:cursor-grabbing hover:border-primary hover:shadow-sm transition-all flex items-center gap-2"
                    >
                      <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{guest.name}</p>
                        {guest.group && (
                          <p className="text-[10px] text-muted-foreground truncate">{guest.group}</p>
                        )}
                      </div>
                    </div>
                  ))}
                {guests.filter((g) => g.floorItemId == null).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                    Todos os convidados alocados!
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Center Canvas */}
        <div
          ref={canvasScrollRef}
          className="flex-1 bg-muted/40 overflow-auto relative"
        >
          {/* Floating zoom controls */}
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
              onClick={resetZoom}
              data-testid="zoom-fit"
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors"
              title="Zoom 100%"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scrollable zoom wrapper */}
          <div className="p-8 inline-block min-w-full min-h-full">
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                width: canvasWidth,
                height: canvasHeight,
              }}
            >
          <div
            ref={containerRef}
            data-testid="floor-canvas"
            className="relative bg-white border shadow-lg"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              backgroundImage: `radial-gradient(circle, hsl(84,8%,72%) 1.2px, transparent 1.2px)`,
              backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
              backgroundPosition: "0 0",
              cursor: isPanningRef.current ? "grabbing" : "grab",
            }}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            onDragOver={handleDragOverCanvas}
            onDrop={handleDropCanvas}
          >
            {floorItems.map((item) => {
              const assignedToTable = guests.filter((g) => g.floorItemId === item.id);
              const isFull = item.capacity > 0 && assignedToTable.length >= item.capacity;
              const isRound = item.type === "round-table";
              const isNonSeating = item.capacity === 0;
              const isDraggingThis = draggingId === item.id;

              const pos = localPos[item.id] ?? { x: item.x, y: item.y };

              return (
                <div
                  key={item.id}
                  data-testid={`floor-item-${item.id}`}
                  onPointerDown={(e) => handleItemPointerDown(e, item)}
                  onPointerMove={(e) => handleItemPointerMove(e, item)}
                  onPointerUp={(e) => handleItemPointerUp(e, item)}
                  onPointerCancel={(e) => handleItemPointerUp(e, item)}
                  onMouseEnter={() => mode === "layout" && setHoveredItemId(item.id)}
                  onMouseLeave={() => setHoveredItemId(null)}
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
                  className={`absolute flex flex-col items-center justify-center border-2 transition-colors overflow-visible
                    ${mode === "layout" ? "cursor-grab active:cursor-grabbing" : ""}
                    ${mode === "assignment" && !isFull && !isNonSeating ? "hover:border-primary hover:bg-primary/5 cursor-default" : "cursor-default"}
                    ${isFull ? "bg-muted/70 border-muted-foreground/30" : "bg-card border-border"}
                    ${isDraggingThis ? "shadow-xl border-primary z-50" : "shadow-sm z-10"}
                    ${mode === "assignment" && !isFull && !isNonSeating ? "hover:z-20" : ""}
                  `}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: item.width,
                    height: item.height,
                    borderRadius: isRound ? "50%" : "8px",
                    touchAction: "none",
                    userSelect: "none",
                    transform: `rotate(${localRotation[item.id] ?? item.rotation ?? 0}deg)`,
                    transformOrigin: "center",
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

                  <span className="text-[11px] font-semibold text-center px-2 leading-tight pointer-events-none">
                    {item.label}
                  </span>
                  {item.capacity > 0 && (
                    <span
                      className={`text-[10px] mt-0.5 pointer-events-none ${
                        isFull ? "text-destructive font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      {assignedToTable.length}/{item.capacity}
                    </span>
                  )}

                  {/* Guest tags in assignment mode */}
                  {mode === "assignment" && assignedToTable.length > 0 && (
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-wrap gap-1 justify-center w-max max-w-[200px] pointer-events-none z-30">
                      {assignedToTable.map((g) => (
                        <div
                          key={g.id}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            handleDragStartGuest(e, g.id);
                          }}
                          data-testid={`assigned-guest-${g.id}`}
                          className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-sm max-w-[90px] truncate pointer-events-auto cursor-grab hover:bg-primary/80 transition-colors"
                          title={g.name}
                        >
                          {g.name.split(" ")[0]}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            </div>
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
              <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                <p className="text-2xl font-bold text-foreground leading-none">{stats?.totalSeats ?? 0}</p>
                <p className="text-[10px] text-muted-foreground mt-1">lugares</p>
              </div>
            </div>

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
            <GuestManagementDialog eventId={eventId} />
          </div>
        </aside>
      </div>
    </div>
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
