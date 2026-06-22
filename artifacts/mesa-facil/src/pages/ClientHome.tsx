import { useListEvents } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, MapPin, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function ClientHome() {
  const { data: events, isLoading } = useListEvents();

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
              <span className="hidden sm:inline text-xs text-muted-foreground ml-2">área do cliente</span>
            </div>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              ← Início
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-10">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">Seus Eventos</h1>
          {!isLoading && events && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {events.length === 0
                ? "Nenhum evento atribuído ainda"
                : `${events.length} ${events.length === 1 ? "evento" : "eventos"}`}
            </p>
          )}
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
                <div className="h-1 w-full bg-primary opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h2 className="text-base font-semibold text-foreground leading-snug flex-1">
                      {event.name}
                    </h2>
                    <EventTypeBadge type={event.type} />
                  </div>

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

                  <div className="flex gap-2 pt-3 border-t border-border">
                    <Link href={`/client/events/${event.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Users className="w-3.5 h-3.5 mr-1.5" />
                        Atribuição
                      </Button>
                    </Link>
                    <Link href={`/client/events/${event.id}/guests`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        Convidados
                      </Button>
                    </Link>
                    <Link href={`/client/events/${event.id}/checkin`} className="flex-1">
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
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Nenhum evento atribuído</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Aguarde o gestor do evento atribuir você a um evento.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
