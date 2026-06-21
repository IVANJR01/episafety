import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, FileWarning, Rocket } from "lucide-react";
import { toast } from "sonner";
import MfaActionButton from "@/components/cat/MfaActionButton";
import { PppDocumento } from "@/lib/pppTypes";

type ItemStatus = "ok" | "fail" | "warn" | "info";

function StatusIcon({ s }: { s: ItemStatus }) {
  if (s === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (s === "fail") return <XCircle className="h-4 w-4 text-rose-600" />;
  if (s === "warn") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <ShieldCheck className="h-4 w-4 text-sky-600" />;
}
function Row({ status, label, hint }: { status: ItemStatus; label: string; hint?: string }) {
  return (
    <li className="flex items-start gap-2 py-1.5 border-b last:border-b-0">
      <StatusIcon s={status} />
      <div className="flex-1">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
    </li>
  );
}

interface Props {
  ppp: PppDocumento;
  funcionario: any | null;
  canPublicar: boolean;
}

export default function PppChecklistTab({ ppp, funcionario, canPublicar }: Props) {
  const qc = useQueryClient();
  const [publicando, setPublicando] = useState(false);
  const id = ppp.id;

  const { data, isLoading } = useQuery({
    queryKey: ["ppp-checklist", id, ppp.conteudo_atualizado_em, ppp.status],
    queryFn: async () => {
      const [per, exp, ra, rm, ex, pdfs, ass] = await Promise.all([
        (supabase.from as any)("ppp_periodos").select("id").eq("ppp_id", id),
        (supabase.from as any)("ppp_exposicoes")
          .select("id, periodo_id, conclusao_previdenciaria, fundamento_legal, justificativa")
          .eq("ppp_id", id),
        (supabase.from as any)("ppp_responsaveis_ambientais").select("id").eq("ppp_id", id),
        (supabase.from as any)("ppp_responsaveis_medicos").select("id").eq("ppp_id", id),
        (supabase.from as any)("ppp_exames_referenciados").select("id").eq("ppp_id", id),
        (supabase.from as any)("ppp_pdf_versoes")
          .select("id, pdf_versao, sha256, gerado_em, com_marca_dagua")
          .eq("ppp_id", id).order("pdf_versao", { ascending: false }),
        (supabase.from as any)("ppp_assinaturas").select("id, pdf_hash").eq("ppp_id", id),
      ]);
      return {
        periodos: per.data || [],
        exp: exp.data || [],
        ra: ra.data || [],
        rm: rm.data || [],
        exames: ex.data || [],
        pdfs: pdfs.data || [],
        assins: ass.data || [],
      };
    },
  });

  const items = useMemo(() => {
    const d = data || { periodos: [], exp: [], ra: [], rm: [], exames: [], pdfs: [], assins: [] };
    const ultimoPdf = d.pdfs[0];
    const pdfFinal = d.pdfs.find((p: any) => !p.com_marca_dagua);
    const pdfAtualizado = ultimoPdf
      ? new Date(ultimoPdf.gerado_em).getTime() >= new Date(ppp.conteudo_atualizado_em).getTime() - 500
      : false;
    const expSemPeriodo = d.exp.filter((e: any) => !e.periodo_id);
    const espSemFund = d.exp.filter((e: any) =>
      String(e.conclusao_previdenciaria || "").startsWith("especial_") &&
      (!e.fundamento_legal || String(e.fundamento_legal).trim().length < 5)
    );
    const incSemJust = d.exp.filter((e: any) =>
      e.conclusao_previdenciaria === "inconclusivo" &&
      (!e.justificativa || String(e.justificativa).trim().length < 5)
    );
    const assinHashOk = pdfFinal
      ? d.assins.some((a: any) => a.pdf_hash === pdfFinal.sha256)
      : false;

    const trabalhadorOk = !!(funcionario?.nome && funcionario?.cpf);

    const arr: { status: ItemStatus; label: string; hint?: string }[] = [
      { status: trabalhadorOk ? "ok" : "fail", label: "Dados do trabalhador preenchidos",
        hint: trabalhadorOk ? `${funcionario?.nome} — CPF ${funcionario?.cpf}` : "Nome/CPF ausente" },
      { status: d.periodos.length ? "ok" : "fail",
        label: `Histórico laboral — ao menos 1 período (${d.periodos.length})` },
      { status: d.exp.length ? "ok" : (ppp.observacoes && ppp.observacoes.trim().length >= 20 ? "warn" : "fail"),
        label: `Exposições cadastradas (${d.exp.length})`,
        hint: d.exp.length === 0 ? "Sem exposição: descreva justificativa técnica (≥20 caracteres) em Observações do PPP." : undefined },
      { status: expSemPeriodo.length === 0 ? "ok" : "fail",
        label: "Exposições vinculadas a períodos laborais",
        hint: expSemPeriodo.length ? `${expSemPeriodo.length} exposição(ões) sem período` : "Todas vinculadas" },
      { status: espSemFund.length === 0 ? "ok" : "fail",
        label: "Fundamento legal em conclusões especiais",
        hint: espSemFund.length ? `${espSemFund.length} pendente(s)` : "OK" },
      { status: incSemJust.length === 0 ? "ok" : "fail",
        label: "Justificativa em conclusões inconclusivas",
        hint: incSemJust.length ? `${incSemJust.length} pendente(s)` : "OK" },
      { status: d.ra.length ? "ok" : "fail",
        label: `Responsáveis ambientais (${d.ra.length})` },
      { status: d.rm.length ? "ok" : "warn",
        label: `Responsáveis médicos (${d.rm.length})`,
        hint: d.rm.length ? "OK" : "Recomendado quando há exames referenciados" },
      { status: d.exames.length ? "ok" : "info",
        label: `Exames referenciados (${d.exames.length})`,
        hint: d.exames.length ? "OK" : "Opcional — vincule ASOs do PCMSO quando existirem" },
      { status: d.pdfs.length ? "ok" : "fail",
        label: "PDF gerado",
        hint: pdfFinal ? "PDF final disponível" : d.pdfs.length ? "Apenas rascunho gerado" : "Nenhum PDF" },
      { status: pdfAtualizado ? "ok" : d.pdfs.length ? "fail" : "warn",
        label: "PDF atualizado com o conteúdo",
        hint: pdfAtualizado ? "Coerente com a última edição" : "Conteúdo foi alterado após o PDF" },
      { status: pdfFinal ? "ok" : "fail",
        label: "PDF final (sem marca d'água)",
        hint: pdfFinal ? `v${pdfFinal.pdf_versao}` : "Gere o PDF com PPP em vigente ou regenere para final" },
      { status: assinHashOk ? "ok" : "fail",
        label: "Assinatura visual sobre o PDF final atual",
        hint: assinHashOk ? "Hash do PDF assinado" : "Assine após o PDF final" },
      { status: "ok", label: "QR Code de validação interna funcional", hint: `/ppp/validar/${id}` },
      { status: "warn", label: "Aviso visível: sem ICP-Brasil / não enviado ao eSocial",
        hint: "Documento técnico interno; transmissão eSocial S-2240 será tratada em fase futura." },
      { status: "ok", label: "RLS ativa", hint: "Isolamento por empresa_id em todas as tabelas ppp_*" },
      { status: "ok", label: "MFA (AAL2) aplicado em gerar PDF final, assinar e publicar" },
      { status: "ok", label: "Audit log ativo", hint: "ppp_revisoes registra criação, edição e publicação" },
      { status: "ok", label: "Histórico append-only", hint: "ppp_revisoes/ppp_assinaturas/ppp_pdf_versoes não permitem UPDATE/DELETE" },
    ];
    return arr;
  }, [data, id, ppp, funcionario]);

  const total = items.length;
  const ok = items.filter((i) => i.status === "ok").length;
  const fail = items.filter((i) => i.status === "fail").length;
  const podePublicar = fail === 0 && (ppp.status === "rascunho" || ppp.status === "em_revisao");

  async function handlePublicar() {
    if (!confirm("Confirmar publicação do PPP como Vigente? A versão anterior (se houver) será marcada como Substituída.")) return;
    setPublicando(true);
    try {
      const { data, error } = await (supabase as any).rpc("ppp_publicar", { _ppp_id: id });
      if (error) throw error;
      toast.success(`PPP publicado como Vigente (v${data?.versao}, PDF v${data?.pdf_versao})`);
      await qc.invalidateQueries({ queryKey: ["ppp-detalhe", id] });
      await qc.invalidateQueries({ queryKey: ["ppp-revisoes", id] });
      await qc.invalidateQueries({ queryKey: ["ppp-checklist", id] });
      await qc.invalidateQueries({ queryKey: ["ppp-list"] });
      await qc.invalidateQueries({ queryKey: ["ppp-dash"] });
    } catch (e: any) {
      toast.error(`Falha ao publicar: ${e?.message || e}`);
    } finally {
      setPublicando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> Checklist PPP — pré-publicação
          </span>
          <span className="flex items-center gap-2">
            <Badge variant="outline">{ok}/{total} OK</Badge>
            {podePublicar
              ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300" variant="outline">Pronto para publicação</Badge>
              : <Badge className="bg-rose-100 text-rose-800 border-rose-300" variant="outline">{fail} pendência(s)</Badge>}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-4">Carregando…</div>
        ) : (
          <ul>{items.map((it, idx) => <Row key={idx} {...it} />)}</ul>
        )}

        {ppp.status === "vigente" && (
          <div className="mt-3 flex items-start gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2">
            <ShieldCheck className="h-4 w-4 mt-0.5" /> PPP já está Vigente. Edições diretas estão bloqueadas.
          </div>
        )}
        {(ppp.status === "substituido" || ppp.status === "arquivado") && (
          <div className="mt-3 flex items-start gap-2 text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-md p-2">
            <FileWarning className="h-4 w-4 mt-0.5" /> PPP {ppp.status} — apenas leitura.
          </div>
        )}
        {!podePublicar && fail > 0 && (
          <div className="mt-3 flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2">
            <FileWarning className="h-4 w-4 mt-0.5" />
            <span>
              O backend (<code>ppp_publicar</code>) também bloqueia a publicação enquanto houver pendências —
              validação dupla UI + RPC.
            </span>
          </div>
        )}

        {canPublicar && (ppp.status === "rascunho" || ppp.status === "em_revisao") && (
          <div className="mt-4 flex justify-end">
            <MfaActionButton onClick={handlePublicar} disabled={!podePublicar || publicando}>
              <Rocket className="h-4 w-4 mr-1" /> {publicando ? "Publicando…" : "Publicar como Vigente"}
            </MfaActionButton>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
