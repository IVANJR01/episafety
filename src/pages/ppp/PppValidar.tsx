import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, FileText, ArrowRight, ExternalLink } from "lucide-react";
import { PPP_STATUS_LABEL, PPP_STATUS_COLOR, PppDocumento, PppStatus } from "@/lib/pppTypes";

function maskCpf(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return "***";
  return `${d.slice(0, 3)}.***.***-${d.slice(9, 11)}`;
}
const fmtDT = (s?: string | null) => s ? new Date(s).toLocaleString("pt-BR") : "—";

export default function PppValidar() {
  const { id } = useParams<{ id: string }>();
  const [sp] = useSearchParams();
  const versaoQs = sp.get("v") ? Number(sp.get("v")) : null;
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: ppp, isLoading } = useQuery({
    queryKey: ["ppp-validar", id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ppp_documentos")
        .select("*").eq("id", id).maybeSingle();
      return data as PppDocumento | null;
    },
    enabled: !!id && !!user,
  });

  const { data: funcionario } = useQuery({
    queryKey: ["ppp-validar-func", ppp?.funcionario_id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("funcionarios")
        .select("nome, cpf, matricula").eq("id", ppp!.funcionario_id).maybeSingle();
      return data;
    },
    enabled: !!ppp?.funcionario_id,
  });

  const { data: empresa } = useQuery({
    queryKey: ["ppp-validar-emp", ppp?.empresa_id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("empresa_config")
        .select("nome, cnpj").eq("id", ppp!.empresa_id).maybeSingle();
      return data;
    },
    enabled: !!ppp?.empresa_id,
  });

  const { data: pdfs = [] } = useQuery({
    queryKey: ["ppp-validar-pdfs", id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ppp_pdf_versoes")
        .select("*").eq("ppp_id", id).order("pdf_versao", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!id && !!ppp,
  });

  if (!user) {
    return (
      <div className="p-8 text-center">
        <Card><CardContent className="p-6">
          <p>Faça login para validar este PPP.</p>
          <Button className="mt-3" onClick={() => navigate(`/auth?redirect=/ppp/validar/${id}${versaoQs ? `?v=${versaoQs}` : ""}`)}>Entrar</Button>
        </CardContent></Card>
      </div>
    );
  }
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Validando…</div>;
  if (!ppp) {
    return (
      <div className="p-8 text-center">
        <Card><CardContent className="p-6 text-muted-foreground">
          PPP não encontrado ou fora do seu escopo.
        </CardContent></Card>
      </div>
    );
  }

  const status = ppp.status as PppStatus;
  const pdf = versaoQs != null
    ? (pdfs as any[]).find((p) => p.pdf_versao === versaoQs) || null
    : pdfs[0] || null;
  const ultima = pdfs[0] || null;
  const desatualizado = !!pdf && ppp.conteudo_atualizado_em &&
    new Date(ppp.conteudo_atualizado_em).getTime() > new Date(pdf.gerado_em).getTime() + 500;
  const versaoDivergente = versaoQs != null && ultima && ultima.pdf_versao !== versaoQs;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <Badge variant="outline" className="text-xs">Validação interna</Badge>
        <span className="text-xs text-muted-foreground ml-auto">Acesso restrito à empresa do PPP</span>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-xl">PPP v{ppp.versao}</CardTitle>
            <Badge className={PPP_STATUS_COLOR[status]} variant="outline">{PPP_STATUS_LABEL[status]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {desatualizado && (
            <div className="rounded-md p-3 text-sm flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              PDF desatualizado — o PPP foi alterado após esta versão. Regenere o PDF.
            </div>
          )}
          {versaoDivergente && (
            <div className="rounded-md p-3 text-sm flex items-center gap-2 bg-red-50 border border-red-200 text-red-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              QR aberto para PDF v{versaoQs}, mas a última versão é v{ultima?.pdf_versao}.
            </div>
          )}
          {pdf?.com_marca_dagua && (
            <div className="rounded-md p-3 text-sm bg-zinc-50 border border-zinc-200 text-zinc-700">
              Este PDF está marcado como <b>RASCUNHO / EM REVISÃO</b> — não substitui a versão final.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Info label="Empresa" value={empresa?.nome} />
            <Info label="CNPJ" value={empresa?.cnpj} />
            <Info label="Funcionário" value={funcionario?.nome} />
            <Info label="CPF" value={maskCpf(funcionario?.cpf)} />
            <Info label="Matrícula" value={funcionario?.matricula} />
            <Info label="Conteúdo atualizado em" value={fmtDT(ppp.conteudo_atualizado_em)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> PDF
            {pdf ? <Badge variant="outline">v{pdf.pdf_versao}</Badge> : <Badge variant="secondary">Não gerado</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Info label="Versão do PDF" value={pdf ? `v${pdf.pdf_versao}` : "—"} />
          <Info label="Gerado em" value={pdf ? fmtDT(pdf.gerado_em) : "—"} />
          <Info label="Status no momento" value={pdf?.status_no_momento || "—"} />
          <div>
            <span className="text-xs text-muted-foreground">Hash SHA-256: </span>
            <span className="font-mono text-[11px] break-all">{pdf?.pdf_hash || "—"}</span>
          </div>
          {pdf?.drive_link && (
            <Button asChild variant="outline" size="sm">
              <a href={pdf.drive_link} target="_blank" rel="noreferrer">
                Abrir no Drive <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          )}
          <p className="text-[11px] text-muted-foreground pt-2">
            Documento técnico interno. Assinatura ICP-Brasil não implementada nesta fase.
            Compare o hash acima com o impresso no rodapé do PDF para validar integridade.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to={`/ppp/${id}`}>Ir para o PPP completo <ArrowRight className="h-4 w-4 ml-1" /></Link>
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
