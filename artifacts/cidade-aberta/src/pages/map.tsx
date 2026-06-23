import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { useListDemands, useListCategories } from "@workspace/api-client-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { DemandStatus } from "@workspace/api-client-react/src/generated/api.schemas";
import { CategoryIcon } from "@/components/category-icon";
import { Search, Loader2, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Fix for default marker icons in Leaflet with vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createCustomIcon = (status: string) => {
  let color = "#64748b";
  if (status === "open") color = "#f59e0b";
  if (status === "under_review" || status === "approved") color = "#a855f7";
  if (status === "in_progress") color = "#06b6d4";
  if (status === "completed") color = "#22c55e";
  if (status === "rejected") color = "#ef4444";

  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" fill="${color}" stroke="white" stroke-width="1.5">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`;

  return L.divIcon({
    className: "",
    html: svgIcon,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -44],
  });
};

// Only re-centers when center actually changes (on data load)
function FlyToCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13, { animate: true });
  }, [center[0], center[1]]);
  return null;
}

const JOAO_PESSOA: [number, number] = [-7.1195, -34.8450];

export default function MapPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [hasCentered, setHasCentered] = useState(false);

  const { data: demandsResponse, isLoading: loadingDemands } = useListDemands({
    search: search || undefined,
    status: status !== "all" ? (status as DemandStatus) : undefined,
    categoryId: categoryId !== "all" ? parseInt(categoryId) : undefined,
    limit: 500,
  });

  const { data: categories } = useListCategories();

  const autoCenter = useMemo<[number, number]>(() => {
    if (hasCentered) return JOAO_PESSOA;
    const demands = demandsResponse?.demands ?? [];
    const withCoords = demands.filter(d => d.lat && d.lng);
    if (withCoords.length > 0) {
      setHasCentered(true);
      return [withCoords[0].lat!, withCoords[0].lng!];
    }
    return JOAO_PESSOA;
  }, [demandsResponse?.demands]);

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
        {/* Filter bar */}
        <div className="z-20 bg-card border-b p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between flex-shrink-0">
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
                <SelectItem value="under_review">Em análise</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
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

        {/* Map */}
        <div style={{ flex: 1, position: "relative", zIndex: 10 }}>
          {loadingDemands && (
            <div className="absolute inset-0 z-[1000] bg-background/50 flex items-center justify-center backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="font-medium text-primary">Carregando demandas...</p>
              </div>
            </div>
          )}
          <MapContainer
            center={JOAO_PESSOA}
            zoom={13}
            style={{ width: "100%", height: "100%" }}
            zoomControl={true}
          >
            {!loadingDemands && <FlyToCenter center={autoCenter} />}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {(demandsResponse?.demands ?? []).map((demand) =>
              demand.lat && demand.lng ? (
                <Marker
                  key={demand.id}
                  position={[demand.lat, demand.lng]}
                  icon={createCustomIcon(demand.status)}
                >
                  <Popup>
                    <div style={{ minWidth: 200 }} className="flex flex-col gap-2 p-1">
                      <div className="flex justify-between items-start gap-2">
                        <StatusBadge status={demand.status} />
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(demand.createdAt), { locale: ptBR, addSuffix: true })}
                        </span>
                      </div>
                      <Link
                        href={`/demandas/${demand.id}`}
                        className="font-semibold text-primary hover:underline text-sm leading-tight"
                        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                      >
                        {demand.title}
                      </Link>
                      {demand.address && (
                        <p className="text-xs text-muted-foreground truncate">{demand.address}</p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {demand.category && <CategoryIcon name={demand.category.icon} className="w-3 h-3" />}
                        <span className="truncate">{demand.category?.name}</span>
                        <span className="ml-auto font-medium text-primary">{demand.confirmationsCount} confirmações</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ) : null
            )}
          </MapContainer>
        </div>
      </div>
    </Layout>
  );
}
