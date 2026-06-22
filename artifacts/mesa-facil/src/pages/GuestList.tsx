import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import {
  useGetEvent,
  useListGuests,
  useCreateGuest,
  useDeleteGuest,
  useUpdateGuest,
  getListGuestsQueryKey,
  getGetEventStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileSpreadsheet,
  Search,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  ChevronDown,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// ── Status metadata ───────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  confirmado:     { label: "Confirmado",       bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500" },
  nao_respondeu:  { label: "Não respondeu",    bg: "bg-gray-100",    text: "text-gray-600",    dot: "bg-gray-400"   },
  nao_comparecera:{ label: "Não comparecerá",  bg: "bg-red-50",      text: "text-red-600",     dot: "bg-red-400"    },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.nao_respondeu;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ── Spreadsheet parsing (same logic as EventEditor) ───────────────────────────
type ParsedRow = {
  name: string;
  group?: string;
  phone?: string;
  gender?: string;
  ageRange?: string;
  notes?: string;
  vocativo?: string;
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function detectColumn(headers: string[], candidates: string[]): number {
  const norms = headers.map(normalizeHeader);
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

const COLUMN_CANDIDATES = {
  name:     ["nome dos convidados", "nome do convidado", "nome", "name", "convidado", "guest"],
  group:    ["grupo do convite", "grupo", "group", "familia"],
  phone:    ["fone para confirmacao", "telefone", "phone", "cel", "celular", "fone"],
  gender:   ["genero", "gender", "sexo"],
  ageRange: ["faixa etaria", "faixa_etaria", "faixaetaria", "age range", "age_range", "agerange", "faixa", "idade"],
  notes:    ["observacao do convite", "observacoes do convite", "observacao", "observacoes", "obs", "notes", "nota", "notas"],
  vocativo: ["vocativo para convite", "vocativo"],
} as const;

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

  let currentVocativo: string | undefined = undefined;
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

// ── Import dialog ─────────────────────────────────────────────────────────────
function ImportDialog({ eventId }: { eventId: number }) {
  const queryClient = useQueryClient();
  const createGuest = useCreateGuest();

  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "importing" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]); setParseError(null); setFileName(null);
    setImportStatus("idle"); setProgress(0); setFailCount(0);
  };

  const handleFile = async (file: File) => {
    setParseError(null); setRows([]); setFileName(file.name);
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) { setParseError("Nenhuma linha válida encontrada na planilha."); return; }
      setRows(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Erro ao ler o arquivo.");
    }
  };

  const handleImport = async () => {
    setImportStatus("importing"); setProgress(0); setFailCount(0);
    let fails = 0;
    for (let i = 0; i < rows.length; i++) {
      try {
        await new Promise<void>((resolve, reject) => {
          createGuest.mutate({ eventId, data: rows[i] }, { onSuccess: () => resolve(), onError: () => reject() });
        });
      } catch { fails++; }
      setProgress(i + 1);
    }
    setFailCount(fails);
    setImportStatus("done");
    queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(eventId) });
    queryClient.invalidateQueries({ queryKey: getGetEventStatsQueryKey(eventId) });
  };

  const handleClose = (v: boolean) => { if (!v) reset(); setOpen(v); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Importar Planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Convidados via Planilha</DialogTitle>
        </DialogHeader>

        {importStatus === "done" ? (
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
        ) : importStatus === "importing" ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importando {progress} de {rows.length}...</p>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(progress / rows.length) * 100}%` }} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {rows.length === 0 && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors
                  ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/40"}`}
              >
                <Upload className="w-8 h-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Arraste um arquivo ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mt-1">Suporta .xlsx, .xls e .csv</p>
                </div>
                <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>
            )}

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
                  <li><span className="font-mono">vocativo</span></li>
                  <li><span className="font-mono">observacao</span> / <span className="font-mono">notes</span></li>
                </ul>
              </div>
            )}

            {parseError && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{parseError}</p>
              </div>
            )}

            {rows.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {rows.length} convidado{rows.length !== 1 ? "s" : ""} encontrado{rows.length !== 1 ? "s" : ""}
                    <span className="text-muted-foreground font-normal"> em <span className="font-mono text-xs">{fileName}</span></span>
                  </p>
                  <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground underline">Trocar arquivo</button>
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

// ── Add Guest dialog ──────────────────────────────────────────────────────────
const addGuestSchema = z.object({
  name:     z.string().min(1, "Nome obrigatório"),
  phone:    z.string().optional(),
  group:    z.string().optional(),
  vocativo: z.string().optional(),
  notes:    z.string().optional(),
  gender:   z.string().optional(),
  ageRange: z.string().optional(),
  status:   z.enum(["confirmado", "nao_respondeu", "nao_comparecera"]).default("nao_respondeu"),
});

type AddGuestValues = z.infer<typeof addGuestSchema>;

function AddGuestDialog({ eventId }: { eventId: number }) {
  const queryClient = useQueryClient();
  const createGuest = useCreateGuest();
  const [open, setOpen] = useState(false);

  const form = useForm<AddGuestValues>({
    resolver: zodResolver(addGuestSchema),
    defaultValues: {
      name: "", phone: "", group: "", vocativo: "", notes: "",
      gender: "", ageRange: "", status: "nao_respondeu",
    },
  });

  const onSubmit = (values: AddGuestValues) => {
    createGuest.mutate(
      {
        eventId,
        data: {
          name:     values.name,
          status:   values.status,
          phone:    values.phone    || undefined,
          group:    values.group    || undefined,
          vocativo: values.vocativo || undefined,
          notes:    values.notes    || undefined,
          gender:   values.gender   || undefined,
          ageRange: values.ageRange || undefined,
        },
      },
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
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Convidado
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Convidado</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome completo <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="Ex: Maria Oliveira" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone com DDD</FormLabel>
                <FormControl><Input placeholder="(11) 99999-9999" {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="group" render={({ field }) => (
              <FormItem>
                <FormLabel>Grupo do convidado</FormLabel>
                <FormControl><Input placeholder="Ex: Família da Noiva" {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="vocativo" render={({ field }) => (
              <FormItem>
                <FormLabel>Vocativo para o convite</FormLabel>
                <FormControl><Input placeholder="Ex: Sr. e Sra. Oliveira" {...field} /></FormControl>
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gênero</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="ageRange" render={({ field }) => (
                <FormItem>
                  <FormLabel>Faixa Etária</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="crianca">Criança (0–12)</SelectItem>
                      <SelectItem value="adolescente">Adolescente (13–17)</SelectItem>
                      <SelectItem value="adulto">Adulto (18–59)</SelectItem>
                      <SelectItem value="idoso">Idoso (60+)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel>Situação</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="nao_respondeu">Não respondeu</SelectItem>
                    <SelectItem value="confirmado">Confirmado</SelectItem>
                    <SelectItem value="nao_comparecera">Não comparecerá</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observação para o convite</FormLabel>
                <FormControl>
                  <Textarea placeholder="Ex: Alergia a frutos do mar" rows={2} {...field} />
                </FormControl>
              </FormItem>
            )} />

            <Button type="submit" className="w-full" disabled={createGuest.isPending}>
              {createGuest.isPending ? "Salvando..." : "Salvar Convidado"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GuestList({ backPath }: { backPath?: string }) {
  const { eventId: eventIdStr } = useParams();
  const eventId = parseInt(eventIdStr || "0", 10);
  const queryClient = useQueryClient();

  const { data: event } = useGetEvent(eventId);
  const { data: guests = [], isLoading } = useListGuests(eventId);
  const deleteGuest = useDeleteGuest();
  const updateGuest = useUpdateGuest();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (guestId: number) => {
    if (!confirm("Remover este convidado?")) return;
    setDeletingId(guestId);
    deleteGuest.mutate(
      { eventId, guestId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(eventId) });
          queryClient.invalidateQueries({ queryKey: getGetEventStatsQueryKey(eventId) });
        },
        onSettled: () => setDeletingId(null),
      }
    );
  };

  const handleStatusChange = (guestId: number, newStatus: string) => {
    updateGuest.mutate(
      { eventId, guestId, data: { status: newStatus as "confirmado" | "nao_respondeu" | "nao_comparecera" } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(eventId) }) }
    );
  };

  const filtered = guests.filter((g) => {
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase()) ||
      (g.group ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (g.phone ?? "").includes(search);
    const matchStatus = statusFilter === "todos" || g.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    todos:          guests.length,
    confirmado:     guests.filter(g => g.status === "confirmado").length,
    nao_respondeu:  guests.filter(g => g.status === "nao_respondeu").length,
    nao_comparecera:guests.filter(g => g.status === "nao_comparecera").length,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b py-3 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href={backPath ?? `/events/${eventId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-primary leading-tight">{event?.name ?? "Evento"}</h1>
            <p className="text-xs text-muted-foreground">Convidados</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ImportDialog eventId={eventId} />
          <AddGuestDialog eventId={eventId} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 flex-1 w-full">
        {/* Stats pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          {(["todos", "confirmado", "nao_respondeu", "nao_comparecera"] as const).map((s) => {
            const meta = s === "todos"
              ? { label: "Todos", bg: "bg-muted", text: "text-foreground", activeBg: "bg-foreground", activeText: "text-background" }
              : { ...STATUS_META[s], activeBg: "", activeText: "" };
            const isActive = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full font-medium transition-colors border
                  ${isActive
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                  }`}
              >
                {s !== "todos" && (
                  <span className={`w-2 h-2 rounded-full ${STATUS_META[s]?.dot ?? "bg-gray-400"} ${isActive ? "opacity-70" : ""}`} />
                )}
                {s === "todos" ? "Todos" : STATUS_META[s]?.label}
                <span className={`text-xs ${isActive ? "opacity-70" : "text-muted-foreground"}`}>
                  {counts[s]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por nome, grupo ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando convidados...</span>
          </div>
        ) : guests.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-xl border border-dashed border-border">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-base font-semibold text-foreground">Nenhum convidado ainda</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Adicione convidados manualmente ou importe uma planilha.
            </p>
            <div className="flex gap-2 justify-center">
              <ImportDialog eventId={eventId} />
              <AddGuestDialog eventId={eventId} />
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum convidado encontrado para &quot;{search}&quot;</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[24%]">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[14%]">Telefone</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[14%]">Grupo</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[13%]">Vocativo</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[10%]">Gênero</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[10%]">Faixa Etária</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[12%]">Situação</th>
                  <th className="px-4 py-3 w-[3%]" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((guest, idx) => (
                  <tr
                    key={guest.id}
                    className={`border-t border-border/60 transition-colors hover:bg-muted/30 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground leading-snug">{guest.name}</div>
                      {guest.notes && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]" title={guest.notes}>
                          {guest.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{guest.phone || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{guest.group || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{guest.vocativo || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize">{guest.gender || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize">{guest.ageRange || "—"}</td>
                    <td className="px-4 py-2.5">
                      <Select
                        value={guest.status ?? "nao_respondeu"}
                        onValueChange={(v) => handleStatusChange(guest.id, v)}
                      >
                        <SelectTrigger className="border-0 shadow-none h-auto p-0 gap-0 focus:ring-0 bg-transparent w-auto">
                          <StatusBadge status={guest.status ?? "nao_respondeu"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nao_respondeu">Não respondeu</SelectItem>
                          <SelectItem value="confirmado">Confirmado</SelectItem>
                          <SelectItem value="nao_comparecera">Não comparecerá</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(guest.id)}
                        disabled={deletingId === guest.id}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                        title="Remover convidado"
                      >
                        {deletingId === guest.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 0 && (
              <div className="px-4 py-2.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">
                {filtered.length} de {guests.length} convidado{guests.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
