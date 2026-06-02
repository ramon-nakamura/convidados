import { useListEvents, useCreateEvent, getListEventsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Calendar, MapPin, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  date: z.string().min(1, "Data é obrigatória"),
  type: z.enum(["wedding", "birthday", "graduation", "corporate", "other"]),
  venue: z.string().optional(),
  notes: z.string().optional(),
});

const EVENT_TYPE_META: Record<string, { label: string; emoji: string; bg: string; text: string }> = {
  wedding:    { label: "Casamento",   emoji: "💍", bg: "bg-[hsl(21,35%,92%)]",  text: "text-[hsl(21,35%,38%)]" },
  birthday:   { label: "Aniversário", emoji: "🎂", bg: "bg-[hsl(36,50%,91%)]",  text: "text-[hsl(36,50%,35%)]" },
  graduation: { label: "Formatura",   emoji: "🎓", bg: "bg-[hsl(84,9%,88%)]",   text: "text-[hsl(84,9%,32%)]"  },
  corporate:  { label: "Corporativo", emoji: "🏢", bg: "bg-[hsl(84,5%,88%)]",   text: "text-[hsl(84,5%,30%)]"  },
  other:      { label: "Outro",       emoji: "📅", bg: "bg-[hsl(26,18%,90%)]",  text: "text-[hsl(26,18%,38%)]" },
};

function EventTypeBadge({ type }: { type: string }) {
  const meta = EVENT_TYPE_META[type] ?? EVENT_TYPE_META.other;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
      <span>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}

function CreateEventDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const createEvent = useCreateEvent();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      date: new Date().toISOString().slice(0, 10),
      type: "wedding",
      venue: "",
      notes: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createEvent.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
          onOpenChange(false);
          form.reset();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-lg">Novo Evento</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Evento</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Casamento Ana & João" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="wedding">💍 Casamento</SelectItem>
                        <SelectItem value="birthday">🎂 Aniversário</SelectItem>
                        <SelectItem value="graduation">🎓 Formatura</SelectItem>
                        <SelectItem value="corporate">🏢 Corporativo</SelectItem>
                        <SelectItem value="other">📅 Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="venue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Espaço Villa Jardins" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                  <FormControl>
                    <Textarea placeholder="Detalhes adicionais..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-2">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createEvent.isPending}>
                {createEvent.isPending ? "Criando..." : "Criar Evento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Home() {
  const { data: events, isLoading } = useListEvents();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <span className="text-base font-bold text-foreground tracking-tight">MesaFácil</span>
              <span className="hidden sm:inline text-xs text-muted-foreground ml-2">gestão de mesas & convidados</span>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Novo Evento
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Seus Eventos</h1>
            {!isLoading && events && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {events.length} {events.length === 1 ? "evento" : "eventos"}
              </p>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-card-border rounded-xl p-5 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <div className="pt-2 border-t mt-4 flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : events && events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-card border border-card-border rounded-xl overflow-hidden hover:shadow-md transition-shadow group"
              >
                {/* Card top accent strip */}
                <div className="h-1 w-full bg-primary opacity-60 group-hover:opacity-100 transition-opacity" />

                <div className="p-5">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h2 className="text-base font-semibold text-foreground leading-snug flex-1">
                      {event.name}
                    </h2>
                    <EventTypeBadge type={event.type} />
                  </div>

                  {/* Meta */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{format(new Date(event.date), "d 'de' MMMM, yyyy", { locale: ptBR })}</span>
                    </div>
                    {event.venue && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{event.venue}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats chip */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2 mb-4">
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span>Convidados</span>
                    <span className="ml-auto font-semibold text-foreground">—</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-border">
                    <Link href={`/events/${event.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        Editor
                      </Button>
                    </Link>
                    <Link href={`/events/${event.id}/checkin`} className="flex-1">
                      <Button size="sm" className="w-full">
                        Check-in
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-card rounded-xl border border-dashed border-border">
            <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Nenhum evento ainda</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              Crie seu primeiro evento para começar a organizar a disposição dos convidados.
            </p>
            <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              Criar Evento
            </Button>
          </div>
        )}
      </main>

      <CreateEventDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
