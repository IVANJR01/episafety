import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Users, FileText, Shield, CheckCircle2, AlertCircle } from "lucide-react";
import { hasPermission } from "@/lib/permissions";

export default function AsoDiagnostico() {
  const { user, empresaId, isSuperAdmin, isPrincipal, modulosPermitidos } = useAuth();

  // Mostrar apenas para admins / principal
  if (!isSuperAdmin && !isPrincipal) return null;

  const urlEmpresaId = new URLSearchParams(window.location.search).get("empresa_id") || empresaId;

  const { data } = useQuery({
    queryKey: ["aso-diag", urlEmpresaId],
    enabled: !!urlEmpresaId,
    queryFn: async () => {
      const [f, e, g, a] = await Promise.all([
        supabase.from("funcionarios").select("id", { count: "exact", head: true }).eq("empresa_id", urlEmpresaId!),
        supabase.from("aso_exames_catalogo").select("id", { count: "exact", head: true }).eq("empresa_id", urlEmpresaId!),
        supabase.from("ghe_ges").select("id", { count: "exact", head: true }).eq("empresa_id", urlEmpresaId!),
        supabase.from("asos").select("id", { count: "exact", head: true }).eq("empresa_id", urlEmpresaId!),
      ]);
      return { funcionarios: f.count || 0, exames: e.count || 0, ghes: g.count || 0, asos: a.count || 0 };
    },
  });

  const podeASO = isSuperAdmin || isPrincipal || hasPermission(modulosPermitidos, "aso", "view");
  const empresaMatch = !urlEmpresaId || !empresaId || urlEmpresaId === empresaId;
  const perfil = isSuperAdmin ? "Super Admin" : isPrincipal ? "Principal" : "Usuário";

  return (
    <Card className="border-dashed bg-muted/30">
      <CardContent className="p-3 text-xs space-y-2">
        <div className="flex items-center gap-2 font-medium text-sm">
          <Shield className="h-4 w-4 text-primary" />
          Diagnóstico de Acesso ASO
          <Badge variant="outline" className="ml-auto text-[10px]">visível apenas para admin/principal</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <div className="text-muted-foreground">Usuário</div>
            <div className="font-mono truncate" title={user?.email || ""}>{user?.email || "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Perfil</div>
            <div>{perfil}</div>
          </div>
          <div>
            <div className="text-muted-foreground">empresa_id do usuário</div>
            <div className="font-mono text-[10px] truncate" title={empresaId || ""}>{empresaId || "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">empresa_id da URL</div>
            <div className="font-mono text-[10px] truncate flex items-center gap-1" title={urlEmpresaId || ""}>
              {urlEmpresaId || "—"}
              {empresaMatch
                ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                : <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2 border-t">
          <Badge variant={podeASO ? "default" : "destructive"} className="justify-center">
            {podeASO ? "✓ Permissão ASO" : "✗ Sem permissão"}
          </Badge>
          <Badge variant="secondary" className="justify-center gap-1"><Users className="h-3 w-3" />{data?.funcionarios ?? "…"} colab.</Badge>
          <Badge variant="secondary" className="justify-center gap-1"><Stethoscope className="h-3 w-3" />{data?.exames ?? "…"} exames</Badge>
          <Badge variant="secondary" className="justify-center gap-1"><Shield className="h-3 w-3" />{data?.ghes ?? "…"} GHE/GES</Badge>
          <Badge variant="secondary" className="justify-center gap-1"><FileText className="h-3 w-3" />{data?.asos ?? "…"} ASOs</Badge>
        </div>
        {data && data.ghes === 0 && (
          <div className="text-amber-600 dark:text-amber-400 pt-1">
            Sem GES/GHE cadastrados nesta empresa. Cadastre em <b>Cadastro → GES/GHE</b> para começar.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
