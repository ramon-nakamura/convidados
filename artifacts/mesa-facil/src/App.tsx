import { Switch, Route, Router as WouterRouter, useParams } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import ClientHome from "@/pages/ClientHome";
import EventEditor from "@/pages/EventEditor";
import EventCheckin from "@/pages/EventCheckin";
import GuestList from "@/pages/GuestList";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ManagerEventEditor() { return <EventEditor />; }
function ManagerGuestList() { return <GuestList />; }
function ManagerCheckin() { return <EventCheckin />; }
function ClientEventEditor() { return <EventEditor clientMode />; }
function ClientGuestList() {
  const { eventId } = useParams<{ eventId: string }>();
  return <GuestList backPath={`/client/events/${eventId}`} />;
}
function ClientCheckin() {
  const { eventId } = useParams<{ eventId: string }>();
  return <EventCheckin backPath={`/client/events/${eventId}`} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      {/* Manager area */}
      <Route path="/app" component={Home} />
      <Route path="/events/:eventId" component={ManagerEventEditor} />
      <Route path="/events/:eventId/guests" component={ManagerGuestList} />
      <Route path="/events/:eventId/checkin" component={ManagerCheckin} />
      {/* Client area */}
      <Route path="/client" component={ClientHome} />
      <Route path="/client/events/:eventId" component={ClientEventEditor} />
      <Route path="/client/events/:eventId/guests" component={ClientGuestList} />
      <Route path="/client/events/:eventId/checkin" component={ClientCheckin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
