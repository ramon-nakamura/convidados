import { Link } from "wouter";
import { MapPin, Users, CheckSquare, ArrowRight, Sparkles } from "lucide-react";

const features = [
  {
    icon: MapPin,
    title: "Monte o salão",
    description:
      "Arraste mesas, cadeiras e decorações para criar o mapa do seu evento. Defina salas e ajuste cada detalhe com precisão.",
    color: "bg-amber-50 text-amber-700",
    border: "border-amber-200",
  },
  {
    icon: Users,
    title: "Gerencie convidados",
    description:
      "Importe listas de planilhas ou cadastre manualmente. Organize por grupo, vocativo e situação de confirmação.",
    color: "bg-emerald-50 text-emerald-700",
    border: "border-emerald-200",
  },
  {
    icon: CheckSquare,
    title: "Faça o check-in",
    description:
      "No dia do evento, marque presenças em tempo real. Veja quem chegou e quem ainda não apareceu com um clique.",
    color: "bg-indigo-50 text-indigo-700",
    border: "border-indigo-200",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[hsl(36,40%,95%)] flex flex-col">
      {/* Topbar */}
      <nav className="px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[hsl(84,9%,42%)] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-[hsl(84,8%,15%)] tracking-tight text-lg">
            Mesa<span className="text-[hsl(84,9%,42%)]">Fácil</span>
          </span>
        </div>
        <Link href="/app">
          <button className="text-sm font-medium text-[hsl(84,8%,30%)] hover:text-[hsl(84,8%,15%)] transition-colors">
            Entrar →
          </button>
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-8 pb-20">
        <div className="max-w-2xl w-full text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[hsl(26,18%,84%)] text-xs font-medium text-[hsl(84,9%,42%)] mb-8 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Organização de eventos simplificada
          </div>

          {/* Title */}
          <h1 className="text-5xl sm:text-6xl font-bold text-[hsl(84,8%,15%)] leading-[1.1] tracking-tight mb-6">
            Cada convidado
            <br />
            <span className="text-[hsl(21,38%,56%)]">no lugar certo.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-[hsl(84,8%,40%)] leading-relaxed max-w-lg mx-auto mb-10">
            Monte o mapa do salão, organize sua lista de convidados e faça o check-in no dia do evento — tudo em um só lugar.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/app">
              <button className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-[hsl(84,9%,42%)] hover:bg-[hsl(84,9%,36%)] text-white font-semibold text-base transition-all shadow-md hover:shadow-lg active:scale-[0.98] w-full sm:w-auto">
                Entrar como Gestor
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/client">
              <button className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-white hover:bg-[hsl(36,40%,98%)] text-[hsl(84,8%,25%)] font-semibold text-base transition-all shadow-sm hover:shadow-md border border-[hsl(26,18%,82%)] active:scale-[0.98] w-full sm:w-auto">
                Entrar como Cliente
                <ArrowRight className="w-4 h-4 opacity-60" />
              </button>
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full max-w-3xl mt-20 mb-12 flex items-center gap-4">
          <div className="flex-1 h-px bg-[hsl(26,18%,84%)]" />
          <span className="text-xs text-[hsl(84,8%,55%)] font-medium uppercase tracking-widest">O que você pode fazer</span>
          <div className="flex-1 h-px bg-[hsl(26,18%,84%)]" />
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full">
          {features.map((f) => (
            <div
              key={f.title}
              className={`bg-white rounded-2xl border ${f.border} p-6 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center shrink-0 border ${f.border}`}>
                <f.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-[hsl(84,8%,15%)] text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-[hsl(84,8%,48%)] leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Floor plan illustration */}
        <div className="mt-16 w-full max-w-3xl">
          <div className="bg-white border border-[hsl(26,18%,84%)] rounded-2xl p-8 shadow-sm overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,hsl(36,40%,92%),transparent_70%)]" />
            <p className="text-center text-xs text-[hsl(84,8%,55%)] font-medium uppercase tracking-widest mb-6 relative">
              Mapa do salão
            </p>
            <FloorIllustration />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-[hsl(84,8%,55%)]">
        MesaFácil · Organização de eventos
      </footer>
    </div>
  );
}

function FloorIllustration() {
  const tables = [
    { x: 80,  y: 30,  r: 46, seats: 8,  label: "Mesa 1" },
    { x: 240, y: 30,  r: 46, seats: 10, label: "Mesa 2" },
    { x: 400, y: 30,  r: 46, seats: 8,  label: "Mesa 3" },
    { x: 560, y: 30,  r: 38, seats: 6,  label: "Mesa 4" },
    { x: 80,  y: 160, r: 46, seats: 10, label: "Mesa 5" },
    { x: 240, y: 160, r: 46, seats: 10, label: "Mesa 6" },
    { x: 400, y: 160, r: 46, seats: 8,  label: "Mesa 7" },
  ];

  const rectTable = { x: 490, y: 145, w: 140, h: 52 };

  return (
    <svg
      viewBox="0 0 680 240"
      className="w-full opacity-80"
      style={{ maxHeight: 220 }}
    >
      {/* Room boundary */}
      <rect x="8" y="4" width="664" height="232" rx="12"
        fill="hsl(36,40%,97%)" stroke="hsl(26,18%,82%)" strokeWidth="1.5" />

      {/* Entrance label */}
      <rect x="280" y="222" width="120" height="14" rx="4" fill="hsl(94,14%,88%)" />
      <text x="340" y="232" textAnchor="middle" fontSize="7" fill="hsl(84,9%,42%)" fontWeight="600" fontFamily="sans-serif">
        ENTRADA
      </text>

      {/* Round tables */}
      {tables.map((t) => {
        const cx = t.x + 56;
        const cy = t.y + 56;
        const seats = t.seats;
        const seatR = 8;
        const gapR = t.r + 14;
        return (
          <g key={t.label}>
            {/* Seats */}
            {Array.from({ length: seats }).map((_, i) => {
              const angle = (i / seats) * Math.PI * 2 - Math.PI / 2;
              const sx = cx + Math.cos(angle) * gapR;
              const sy = cy + Math.sin(angle) * gapR;
              return (
                <ellipse
                  key={i}
                  cx={sx} cy={sy}
                  rx={seatR} ry={6}
                  transform={`rotate(${(angle * 180) / Math.PI + 90}, ${sx}, ${sy})`}
                  fill="white" stroke="hsl(26,30%,74%)" strokeWidth="1"
                />
              );
            })}
            {/* Table */}
            <circle cx={cx} cy={cy} r={t.r}
              fill="white" stroke="hsl(21,38%,70%)" strokeWidth="1.5" />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize="7.5"
              fill="hsl(21,38%,50%)" fontWeight="600" fontFamily="sans-serif">
              {t.label}
            </text>
          </g>
        );
      })}

      {/* Rectangle table (noivos) */}
      <g>
        {/* Seats top */}
        {[0,1,2].map((i) => (
          <rect key={`rt${i}`}
            x={rectTable.x + 14 + i * 38} y={rectTable.y - 13}
            width={24} height={10} rx="3"
            fill="white" stroke="hsl(26,30%,74%)" strokeWidth="1" />
        ))}
        {/* Seats bottom */}
        {[0,1,2].map((i) => (
          <rect key={`rb${i}`}
            x={rectTable.x + 14 + i * 38} y={rectTable.y + rectTable.h + 3}
            width={24} height={10} rx="3"
            fill="white" stroke="hsl(26,30%,74%)" strokeWidth="1" />
        ))}
        <rect x={rectTable.x} y={rectTable.y} width={rectTable.w} height={rectTable.h} rx="8"
          fill="white" stroke="hsl(21,38%,70%)" strokeWidth="1.5" />
        <text x={rectTable.x + rectTable.w / 2} y={rectTable.y + rectTable.h / 2 + 4}
          textAnchor="middle" fontSize="7.5"
          fill="hsl(21,38%,50%)" fontWeight="600" fontFamily="sans-serif">
          Noivos
        </text>
      </g>

      {/* Buffet item */}
      <rect x="20" y="12" width="18" height="60" rx="4"
        fill="hsl(26,30%,92%)" stroke="hsl(26,18%,78%)" strokeWidth="1" />
      <text x="29" y="54" textAnchor="middle" fontSize="6"
        fill="hsl(84,8%,48%)" fontWeight="500" fontFamily="sans-serif"
        transform="rotate(-90, 29, 42)">
        Buffet
      </text>
    </svg>
  );
}
