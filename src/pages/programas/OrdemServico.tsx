import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ClipboardList, Search, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { OrdemServicoSst, OS_STATUS_LABEL, OS_STATUS_COLOR, OS_ESCOPO_LABEL } from "@/lib/osTypes";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/ui/list-skeleton";

export default function OrdemServico() {
  const { empresaScopeIds } = useAuth();
  const [items, setItems] = useState<OrdemServicoSst[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      let q = (supabase as any).from("ordens_servico_sst").select("*").order("created_at", { ascending: false });
      if (empresaScopeIds.length > 0) q = q.in("empresa_id", empresaScopeIds);
      const { data, error } = await q;
      if (error) throw error;
      setItems((data || []) as OrdemServicoSst[]);
    } catch (e: any) {
      toast.error(e.message || "Falha ao carregar ordens de serviço");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [empresaScopeIds.join(",")]);

  const filtered = items.filter((i) =>
    !busca || (i.titulo || "").toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Ordem de Serviço"
        subtitle="Documentos de orientação de segurança por função/atividade. Base central: GES/GHE."
        actions={
          <Button asChild className="min-h-[44px]">
            <Link to="/programas/ordem-servico/novo">
              <Plus className="w-4 h-4 mr-2" /> Nova OS
            </Link>
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {loading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma Ordem de Serviço"
          description="Crie sua primeira OS a partir de um GES/GHE, função ou funcionário. Os riscos, EPIs e medidas serão pré-preenchidos automaticamente."
          action={
            <Button asChild>
              <Link to="/programas/ordem-servico/novo">
                <Plus className="w-4 h-4 mr-2" /> Nova OS
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((os) => (
            <Card key={os.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <Badge className={OS_STATUS_COLOR[os.status]}>{OS_STATUS_LABEL[os.status]}</Badge>
                </div>
                <h3 className="font-semibold text-sm">{os.titulo}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {OS_ESCOPO_LABEL[os.escopo]} • v{os.versao}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link to={`/programas/ordem-servico/${os.id}`}>Abrir</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
