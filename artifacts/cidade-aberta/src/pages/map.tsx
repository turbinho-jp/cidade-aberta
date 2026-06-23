import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListDemands, useListCategories, useListNeighborhoods } from "@workspace/api-client-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { DemandStatus } from "@workspace/api-client-react/src/generated/api.schemas";
import { CategoryIcon } from "@/components/category-icon";
import { Search, Filter, Loader2, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Fix for default marker icons in Leaflet with webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom colored markers based on status
const createCustomIcon = (status: string) => {
  let color = "#64748b"; // default slate
  if (status === "open") color = "#f59e0b"; // amber
  if (status === "in_progress") color = "#06b6d4"; // cyan
  if (status === "completed") color = "#22c55e"; // green
  if (status === "rejected") color = "#ef4444"; // red

  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="white"></circle>
    </svg>
  `;
  return L.divIcon({
    className: "bg-transparent border-none",
    html: svgIcon,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function MapPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");

  const { data: demandsResponse, isLoading: loadingDemands } = useListDemands({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    categoryId: categoryId !== "all" ? parseInt(categoryId) : undefined,
    limit: 500, // Load a bunch for the map
  });

  const { data: categories } = useListCategories();

  // Determine center based on first demand or default to a generic Brazil coord
  const center: [number, number] = useMemo(() => {
    if (demandsResponse?.demands && demandsResponse.demands.length > 0) {
      const first = demandsResponse.demands[0];
      if (first.lat && first.lng) {
        return [first.lat, first.lng];
      }
    }
    // Default to SP center roughly
    return [-23.5505, -46.6333];
  }, [demandsResponse?.demands]);

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)] relative">
        {/* Filter Bar overlaying the map on desktop, or top on mobile */}
        <div className="z-20 bg-card border-b p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">Mapa de Demandas</h1>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar demandas..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="open">Aberto</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories?.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative z-10">
          {loadingDemands && (
            <div className="absolute inset-0 z-[1000] bg-background/50 flex items-center justify-center backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="font-medium text-primary">Carregando mapa...</p>
              </div>
            </div>
          )}
          <MapContainer 
            center={center} 
            zoom={13} 
            className="w-full h-full"
            zoomControl={false}
          >
            <ChangeView center={center} zoom={13} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            {demandsResponse?.demands.map((demand) => (
              demand.lat && demand.lng ? (
                <Marker 
                  key={demand.id} 
                  position={[demand.lat, demand.lng]}
                  icon={createCustomIcon(demand.status)}
                >
                  <Popup className="custom-popup">
                    <div className="min-w-[200px] flex flex-col gap-2 p-1">
                      <div className="flex justify-between items-start gap-2">
                        <StatusBadge status={demand.status} />
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(demand.createdAt), { locale: ptBR })}
                        </span>
                      </div>
                      <Link href={`/demandas/${demand.id}`} className="font-semibold text-primary hover:underline text-sm line-clamp-2 leading-tight">
                        {demand.title}
                      </Link>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        {demand.category && <CategoryIcon name={demand.category.icon} className="w-3 h-3" />}
                        <span className="truncate">{demand.category?.name}</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ) : null
            ))}
          </MapContainer>
        </div>
      </div>
    </Layout>
  );
}
