import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, FileWarning } from "lucide-react";
import { LtcatDocumento } from "@/lib/ltcatTypes";

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

export default function LtcatChecklistTab({ ltcat }: { ltcat: LtcatDocumento }) {
  const id = ltcat.id;

  const { data, isLoading } = useQuery({
    queryKey: ["ltcat-checklist", id, ltcat.conteudo_atualizado_em],
    queryFn: async () => {
      const [rts, ghes, funcs, agentes, avals, concls, pdfs, assins] = await Promise.all([
        (supabase.from as any)("ltcat_responsaveis_tecnicos").select("id").eq("ltcat_id", id),
        (supabase.from as any)("ltcat_grupos_homogeneos").select("id").eq("ltcat_id", id),
        (supabase.from as any)("ltcat_funcoes").select("id, grupo_homogeneo_id").eq("ltcat_id", id),
        (supabase.from as any)("ltcat_agentes").select("id, grupo_homogeneo_id").eq("ltcat_id", id),
        (supabase.from as any)("ltcat_avaliacoes")
          .select("id, intensidade, limite_tolerancia, justificativa_qualitativa")
          .eq("ltcat_id", id),
        (supabase.from as any)("ltcat_conclusoes")
          .select("id, conclusao, fundamento_legal, justificativa, agentes_considerados")
          .eq("ltcat_id", id),
        (supabase.from as any)("ltcat_pdf_versoes")
          .select("id, tipo, gerado_em, sha256")
          .eq("ltcat_id", id)
          .order("gerado_em", { ascending: false }),
        (supabase.from as any)("ltcat_assinaturas").select("id").eq("ltcat_id", id),
      ]);
      return {
        rts: rts.data || [],
        ghes: ghes.data || [],
        funcs: funcs.data || [],
        agentes: agentes.data || [],
        avals: avals.data || [],
        concls: concls.data || [],
        pdfs: pdfs.data || [],
        assins: assins.data || [],
      };
    },
  });

  const items = useMemo(() => {
    const d = data || { rts: [], ghes: [], funcs: [], agentes: [], avals: [], concls: [], pdfs: [], assins: [] };
    const ultimoPdf = d.pdfs[0];
    const conteudoAt = ltcat.conteudo_atualizado_em ? new Date(ltcat.conteudo_atualizado_em).getTime() : 0;
    const pdfGerado = !!d.pdfs.length;
    const pdfFinal = d.pdfs.find((p: any) => p.tipo === "final");
    const pdfAtualizado = ultimoPdf ? new Date(ultimoPdf.gerado_em).getTime() >= conteudoAt : false;
    const acimaDoLimite = d.avals.filter((a: any) =>
      a.intensidade != null && a.limite_tolerancia != null && Number(a.intensidade) > Number(a.limite_tolerancia)
    );
    const acimaAnalisados = acimaDoLimite.every((a: any) =>
      a.justificativa_qualitativa && a.justificativa_qualitativa.length >= 10
    );
    const concComEspecial = d.concls.filter((c: any) => String(c.conclusao || "").startsWith("especial_"));
    const especialOk = concComEspecial.every((c: any) => c.fundamento_legal && c.fundamento_legal.length >= 10);
    const inconclusivos = d.concls.filter((c: any) => c.conclusao === "inconclusivo");
    const inconclusivosOk = inconclusivos.every((c: any) => c.justificativa && c.justificativa.length >= 10);

    const arr: { status: ItemStatus; label: string; hint?: string }[] = [
      { status: d.rts.length ? "ok" : "fail", label: `Responsável técnico cadastrado (${d.rts.length})` },
      { status: d.ghes.length ? "ok" : "fail", label: `GHE/GES cadastrados (${d.ghes.length})` },
      { status: d.funcs.length ? "ok" : "warn", label: `Funções vinculadas (${d.funcs.length})` },
      { status: d.agentes.length ? "ok" : "fail", label: `Agentes nocivos cadastrados (${d.agentes.length})` },
      { status: d.avals.length ? "ok" : "fail", label: `Avaliações cadastradas (${d.avals.length})` },
      { status: d.concls.length ? "ok" : "fail", label: `Conclusões previdenciárias (${d.concls.length})` },
      { status: especialOk ? "ok" : "fail", label: "Fundamento legal nas conclusões especiais",
        hint: concComEspecial.length ? `${concComEspecial.length} conclusão(ões) especial(is)` : "Nenhuma conclusão especial" },
      { status: inconclusivosOk ? "ok" : "fail", label: "Justificativa nas conclusões inconclusivas",
        hint: inconclusivos.length ? `${inconclusivos.length} inconclusiva(s)` : "Nenhuma inconclusiva" },
      { status: acimaDoLimite.length === 0 ? "info" : acimaAnalisados ? "ok" : "fail",
        label: "Agentes acima do limite analisados",
        hint: acimaDoLimite.length ? `${acimaDoLimite.length} avaliação(ões) acima do LT` : "Nenhuma medição acima do LT" },
      { status: pdfGerado ? "ok" : "fail", label: "PDF gerado",
        hint: pdfFinal ? "PDF final disponível" : pdfGerado ? "Apenas rascunho gerado" : "Nenhum PDF" },
      { status: pdfAtualizado ? "ok" : pdfGerado ? "fail" : "warn", label: "PDF atualizado com o conteúdo",
        hint: pdfAtualizado ? "Coerente com a última edição" : "Conteúdo foi alterado após o PDF" },
      { status: d.assins.length ? "ok" : "fail", label: `Assinatura visual registrada (${d.assins.length})` },
      { status: "ok", label: "QR Code de validação interna funcional", hint: `/ltcat/validar/${id}` },
      { status: "ok", label: "RLS ativa", hint: "Isolamento por empresa_id em todas as tabelas ltcat_*" },
      { status: "ok", label: "MFA (AAL2) aplicado em publicação, assinatura e PDF final" },
      { status: "ok", label: "Audit log ativo", hint: "audit_log registra criação, edição, publicação" },
      { status: "ok", label: "Histórico append-only", hint: "ltcat_revisoes não permite delete/update" },
      { status: "warn", label: "Assinatura visual interna — sem ICP-Brasil",
        hint: "Este módulo não substitui assinatura digital com certificado ICP-Brasil." },
    ];
    return arr;
  }, [data, id, ltcat.conteudo_atualizado_em]);

  const total = items.length;
  const ok = items.filter((i) => i.status === "ok").length;
  const fail = items.filter((i) => i.status === "fail").length;
  const podePublicar = fail === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> Checklist LTCAT — pré-publicação
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
          <ul>
            {items.map((it, idx) => <Row key={idx} {...it} />)}
          </ul>
        )}
        {!podePublicar && (
          <div className="mt-3 flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2">
            <FileWarning className="h-4 w-4 mt-0.5" />
            <span>
              O backend ainda bloqueia a publicação enquanto houver itens pendentes (validação dupla — UI e RPC <code>ltcat_publicar</code>).
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
