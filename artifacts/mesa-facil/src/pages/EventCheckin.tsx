import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetEvent,
  useListGuests,
  useToggleGuestCheckin,
  useListFloorItems,
  getGetEventQueryKey,
  getListGuestsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, CheckCircle2, Circle, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function EventCheckin() {
  const { eventId: eventIdStr } = useParams();
  const eventId = parseInt(eventIdStr || "0", 10);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");

  const { data: event, isLoading: isLoadingEvent } = useGetEvent(eventId, {
    query: { enabled: !!eventId, queryKey: getGetEventQueryKey(eventId) },
  });
  
  const { data: guests = [], isLoading: isLoadingGuests } = useListGuests(eventId, {
    query: { enabled: !!eventId, queryKey: getListGuestsQueryKey(eventId) },
  });

  const { data: floorItems = [] } = useListFloorItems(eventId, {
    query: { enabled: !!eventId }
  });

  const toggleCheckin = useToggleGuestCheckin();

  const handleToggle = (guestId: number) => {
    toggleCheckin.mutate({ eventId, guestId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey(eventId) });
      }
    });
  };

  if (isLoadingEvent || isLoadingGuests) return <div className="p-8 text-center">Loading...</div>;
  if (!event) return <div className="p-8 text-center">Event not found</div>;

  const filteredGuests = guests.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase()) || 
    (g.group && g.group.toLowerCase().includes(search.toLowerCase()))
  );

  const checkedInCount = guests.filter(g => g.checkedIn).length;
  const totalCount = guests.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b py-6 px-6 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/events/${eventId}`}>
              <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-primary">{event.name}</h1>
              <p className="text-sm text-muted-foreground">Check-in Terminal</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-foreground">
              {checkedInCount} <span className="text-muted-foreground text-lg">/ {totalCount}</span>
            </div>
            <p className="text-sm text-muted-foreground uppercase tracking-wide">Guests Arrived</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-6 flex flex-col gap-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="Search by guest name or group..." 
            className="pl-12 py-6 text-lg rounded-full bg-card shadow-sm border-muted"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid gap-3">
          {filteredGuests.map(guest => {
            const table = floorItems.find(i => i.id === guest.floorItemId);
            
            return (
              <Card 
                key={guest.id} 
                className={`p-4 flex items-center justify-between transition-colors ${guest.checkedIn ? 'bg-accent/20 border-accent' : 'bg-card'}`}
              >
                <div className="flex flex-col gap-1">
                  <h3 className={`text-lg font-semibold ${guest.checkedIn ? 'text-accent-foreground' : 'text-foreground'}`}>
                    {guest.name}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {guest.group && <span>Group: {guest.group}</span>}
                    {table ? (
                      <span className="flex items-center gap-1 font-medium text-primary">
                        <MapPin className="w-4 h-4" />
                        {table.label}
                      </span>
                    ) : (
                      <span className="text-destructive font-medium">Unassigned</span>
                    )}
                  </div>
                </div>
                
                <Button 
                  size="lg"
                  variant={guest.checkedIn ? "outline" : "default"}
                  className={`w-40 gap-2 ${guest.checkedIn ? 'text-accent-foreground border-accent-foreground/30 hover:bg-accent/30' : 'bg-primary hover:bg-primary/90'}`}
                  onClick={() => handleToggle(guest.id)}
                  disabled={toggleCheckin.isPending}
                >
                  {guest.checkedIn ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Checked In
                    </>
                  ) : (
                    <>
                      <Circle className="w-5 h-5" />
                      Check In
                    </>
                  )}
                </Button>
              </Card>
            );
          })}
          
          {filteredGuests.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No guests found matching "{search}"
            </div>
          )}
        </div>
      </main>
    </div>
  );
}