import { useEffect } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, FileText, ArrowRight, Skull } from "lucide-react";
import { toast } from "sonner";
import { CatRow, STATUS_LABEL, STATUS_COLOR, TIPO_LABEL } from "@/lib/catTypes";

export default function CatValidar() {
  const { id } = useParams<{ id: string }>();
  const [sp] = useSearchParams();
  const versaoQs = sp.get("v");
  const navigate = useNavigate();

  const { data: cat, isLoading, error } = useQuery({
    queryKey: ["cat-validar", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("cat_comunicacoes").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as (CatRow & { pdf_versao?: number; pdf_hash?: string | null; pdf_gerado_em?: string | null; pdf_drive_view_link?: string | null }) | null;
    },
  });

  const { data: empresa } = useQuery({
    queryKey: ["cat-validar-emp", cat?.empresa_id],
    enabled: !!cat?.empresa_id,
    queryFn: async () => (await (supabase.from as any)("empresa_config").select("nome, cnpj").eq("id", cat!.empresa_id).maybeSingle()).data,
  });

  const { data: funcionario } = useQuery({
    queryKey: ["cat-validar-func", cat?.funcionario_id],
    enabled: !!cat?.funcionario_id,
    queryFn: async () => (await (supabase.from as any)("funcionarios").select("nome, cpf, cargo").eq("id", cat!.funcionario_id).maybeSingle()).data,
  });

  useEffect(() => {
    if (!isLoading && !cat && !error) {
      toast.error("CAT não encontrada ou fora do seu escopo de empresa.");
      navigate("/cat");
    }
  }, [cat, isLoading, error, navigate]);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Validando…</div>;
  if (!cat) return null;

  const versaoAtual = (cat as any).pdf_versao ?? 0;
  const pdfGeradoEm = (cat as any).pdf_gerado_em as string | null;
  const desatualizado = !!pdfGeradoEm && new Date(cat.updated_at).getTime() > new Date(pdfGeradoEm).getTime() + 1500;
  const versaoEsperada = versaoQs ? Number(versaoQs) : null;
  const versaoDivergente = versaoEsperada != null && versaoEsperada !== versaoAtual;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <Badge variant="outline" className="text-xs">Validação interna</Badge>
        <span className="text-xs text-muted-foreground ml-auto">Acesso restrito à empresa da CAT</span>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-xl flex items-center gap-2">
              {cat.obito && <Skull className="h-5 w-5 text-red-600" />}
              CAT {cat.numero_cat || "(rascunho)"}
            </CardTitle>
            <Badge className={STATUS_COLOR[cat.status]} variant="outline">{STATUS_LABEL[cat.status]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {desatualizado && (
            <div className="rounded-md p-3 text-sm flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              PDF desatualizado — a CAT foi alterada após esta versão. Gere uma nova versão no detalhe da CAT.
            </div>
          )}
          {versaoDivergente && (
            <div className="rounded-md p-3 text-sm flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Esta validação foi aberta para a versão v{versaoEsperada}, mas a versão vigente é v{versaoAtual}.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Info label="Tipo" value={TIPO_LABEL[cat.tipo_cat]} />
            <Info label="Data do acidente" value={new Date(cat.data_acidente + "T00:00:00").toLocaleDateString("pt-BR")} />
            <Info label="Empresa" value={empresa?.nome} />
            <Info label="CNPJ" value={empresa?.cnpj} />
            <Info label="Funcionário" value={funcionario?.nome} />
            <Info label="CPF" value={funcionario?.cpf} />
            <Info label="Cargo" value={funcionario?.cargo} />
            <Info label="Óbito" value={cat.obito ? "SIM" : "Não"} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> PDF
            {versaoAtual ? <Badge variant="outline">v{versaoAtual}</Badge> : <Badge variant="secondary">Não gerado</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Info label="Versão vigente" value={versaoAtual ? `v${versaoAtual}` : "—"} />
          <Info label="Gerado em" value={pdfGeradoEm ? new Date(pdfGeradoEm).toLocaleString("pt-BR") : null} />
          <div>
            <span className="text-xs text-muted-foreground">Hash SHA-256: </span>
            <span className="font-mono text-[11px] break-all">{(cat as any).pdf_hash || "—"}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Documento gerencial interno. Confira o hash acima contra o hash exibido no rodapé/cabeçalho do PDF baixado para validar integridade.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to={`/cat/${cat.id}`}>Ir para o detalhe completo <ArrowRight className="h-4 w-4 ml-1" /></Link>
        </Button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="text-sm">
      <span className="text-xs text-muted-foreground">{label}: </span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
