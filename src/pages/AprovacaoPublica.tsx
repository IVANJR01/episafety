import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, ClipboardList, Loader2, ShieldAlert } from "lucide-react";

interface ResumoSolicitacao {
  numero: string;
  titulo: string;
  empresa_nome?: string;
  setor?: string;
  solicitante_nome?: string;
  prioridade: string;
  data_necessidade?: string;
  status: string;
  itens_count: number;
  ja_usado: boolean;
}

const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente 🔴",
};

export default function AprovacaoPublica() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const token = searchParams.get("token");
  const acaoSugerida = searchParams.get("acao");

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<ResumoSolicitacao | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState<"aprovar" | "recusar" | null>(null);
  const [resultado, setResultado] = useState<{ status: string } | null>(null);

  useEffect(() => {
    (async () => {
      if (!id || !token) { setErro("Link inválido"); setLoading(false); return; }
      const { data, error } = await (supabase.rpc as any)("consultar_solicitacao_publica", {
        p_solicitacao_id: id,
        p_token: token,
      });
      if (error || !(data as any)?.ok) {
        setErro((data as any)?.erro || error?.message || "Link inválido");
        setLoading(false);
        return;
      }
      setResumo(data as unknown as ResumoSolicitacao);
      setLoading(false);
    })();
  }, [id, token]);

  async function confirmar(acao: "aprovar" | "recusar") {
    if (!id || !token) return;
    setEnviando(acao);
    const { data, error } = await (supabase.rpc as any)("aprovar_solicitacao_publica", {
      p_solicitacao_id: id,
      p_token: token,
      p_acao: acao,
      p_motivo: acao === "recusar" ? motivo : null,
    });
    setEnviando(null);
    if (error || !(data as any)?.ok) {
      setErro((data as any)?.erro || error?.message || "Não foi possível registrar sua resposta");
      return;
    }
    setResultado({ status: (data as any).status });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (erro && !resumo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-2">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">Não foi possível abrir esta solicitação</h1>
            <p className="text-sm text-muted-foreground">{erro}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!resumo) return null;

  const jaDecidido = resultado || resumo.ja_usado || (resumo.status !== "enviada");
  const statusFinal = resultado?.status || resumo.status;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="max-w-lg w-full">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Solicitação de Materiais</h1>
              <p className="text-xs text-muted-foreground">SafetySoluções — Aprovação para o setor de compras</p>
            </div>
          </div>

          <div className="text-sm space-y-1 border-t pt-3">
            <div><span className="text-muted-foreground">Número:</span> <strong className="font-mono">{resumo.numero}</strong></div>
            <div><span className="text-muted-foreground">Título:</span> <strong>{resumo.titulo}</strong></div>
            {resumo.empresa_nome && <div><span className="text-muted-foreground">Empresa:</span> {resumo.empresa_nome}</div>}
            {resumo.setor && <div><span className="text-muted-foreground">Setor:</span> {resumo.setor}</div>}
            {resumo.solicitante_nome && <div><span className="text-muted-foreground">Solicitante:</span> {resumo.solicitante_nome}</div>}
            <div><span className="text-muted-foreground">Prioridade:</span> {PRIORIDADE_LABEL[resumo.prioridade] || resumo.prioridade}</div>
            <div><span className="text-muted-foreground">Itens:</span> {resumo.itens_count}</div>
          </div>

          {jaDecidido ? (
            <div className={`rounded-lg p-4 flex items-center gap-3 ${statusFinal === "aprovada" ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
              {statusFinal === "aprovada" ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
              <div>
                <div className="font-semibold">
                  {statusFinal === "aprovada" ? "Solicitação aprovada" : statusFinal === "recusada" ? "Solicitação recusada" : "Já respondida anteriormente"}
                </div>
                <div className="text-xs">Essa decisão já foi registrada no sistema.</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 border-t pt-3">
              <p className="text-sm">O que você decide sobre esta solicitação?</p>
              {acaoSugerida === "recusar" && (
                <div className="space-y-1">
                  <Label className="text-xs">Motivo da recusa (opcional)</Label>
                  <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: fora do orçamento deste mês" />
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => confirmar("aprovar")}
                  disabled={!!enviando}
                  className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  {enviando === "aprovar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirmar Aprovação
                </Button>
                <Button
                  onClick={() => confirmar("recusar")}
                  disabled={!!enviando}
                  variant="destructive"
                  className="flex-1 gap-2"
                >
                  {enviando === "recusar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Confirmar Recusa
                </Button>
              </div>
              {erro && <p className="text-xs text-destructive">{erro}</p>}
            </div>
          )}

          <p className="text-xs text-muted-foreground italic">Este link é de uso único e pessoal — não encaminhe para terceiros.</p>
        </CardContent>
      </Card>
    </div>
  );
}
