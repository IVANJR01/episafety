import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, Download, Loader2, CheckCircle2, Archive } from "lucide-react";
import { toast } from "sonner";
import { OrdemServicoSst, OS_STATUS_LABEL, OS_STATUS_COLOR, OS_ESCOPO_LABEL } from "@/lib/osTypes";
import { gerarOsPdf } from "@/lib/osPdf";
import { GRUPO_RISCO_LABEL } from "@/lib/gesFicha";

export default function OrdemServicoDetalhe() {
  const nav = useNavigate();
  const { id } = useParams();
  const [os, setOs] = useState<OrdemServicoSst | null>(null);
  const [empresa, setEmpresa] = useState<{ nome: string; cnpj: string | null } | null>(null);
  const [ghe, setGhe] = useState<{ codigo: string; nome: string } | null>(null);
  const [funcao, setFuncao] = useState<{ nome_funcao: string } | null>(null);
  const [funcionario, setFuncionario] = useState<{ nome: string; matricula: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await (supabase as any).from("ordens_servico_sst").select("*").eq("id", id).maybeSingle();
    if (error || !data) { toast.error("OS não encontrada"); nav("/programas/ordem-servico"); return; }
    const d = data as OrdemServicoSst;
    setOs(d);

    const [emp, g, f, fun] = await Promise.all([
      (supabase as any).from("empresa_config").select("nome, cnpj").eq("id", d.empresa_id).maybeSingle(),
      d.ghe_id ? (supabase as any).from("ghe_ges").select("codigo, nome").eq("id", d.ghe_id).maybeSingle() : Promise.resolve({ data: null }),
      d.funcao_id ? (supabase as any).from("ghe_funcoes").select("nome_funcao").eq("id", d.funcao_id).maybeSingle() : Promise.resolve({ data: null }),
      d.funcionario_id ? (supabase as any).from("funcionarios").select("nome, matricula").eq("id", d.funcionario_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setEmpresa(emp.data as any); setGhe(g.data as any); setFuncao(f.data as any); setFuncionario(fun.data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const gerarPdf = async () => {
    if (!os) return;
    setBusy(true);
    try {
      const doc = gerarOsPdf({
        os,
        empresaNome: empresa?.nome || null,
        empresaCnpj: empresa?.cnpj || null,
        gheNome: ghe ? `${ghe.codigo} — ${ghe.nome}` : null,
        funcaoNome: funcao?.nome_funcao || null,
        funcionarioNome: funcionario?.nome || null,
        funcionarioMatricula: funcionario?.matricula || null,
      });
      doc.save(`OS-${os.titulo.replace(/[^a-z0-9]+/gi, "_")}-v${os.versao}.pdf`);
      toast.success("PDF gerado");
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar PDF");
    } finally {
      setBusy(false);
    }
  };

  const emitir = async () => {
    if (!os) return;
    setBusy(true);
    const { error } = await (supabase as any).from("ordens_servico_sst").update({
      status: "emitida",
      data_emissao: os.data_emissao || new Date().toISOString().slice(0, 10),
    }).eq("id", os.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("OS emitida");
    load();
  };

  const arquivar = async () => {
    if (!os) return;
    if (!confirm("Arquivar esta Ordem de Serviço?")) return;
    setBusy(true);
    const { error } = await (supabase as any).from("ordens_servico_sst").update({ status: "arquivada" }).eq("id", os.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Arquivada");
    load();
  };

  if (loading || !os) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin inline" /></div>;

  return (
    <div className="space-y-4">
      <PageHeader
        title={os.titulo}
        subtitle={`${OS_ESCOPO_LABEL[os.escopo]} • v${os.versao}`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => nav("/programas/ordem-servico")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            {os.status === "rascunho" && (
              <>
                <Button variant="outline" asChild>
                  <Link to={`/programas/ordem-servico/${os.id}/editar`}>
                    <Pencil className="w-4 h-4 mr-1" /> Editar
                  </Link>
                </Button>
                <Button onClick={emitir} disabled={busy}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Emitir
                </Button>
              </>
            )}
            <Button onClick={gerarPdf} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              PDF
            </Button>
            {os.status === "emitida" && (
              <Button variant="outline" onClick={arquivar} disabled={busy}>
                <Archive className="w-4 h-4 mr-1" /> Arquivar
              </Button>
            )}
          </div>
        }
      />

      <div className="flex gap-2 flex-wrap items-center">
        <Badge className={OS_STATUS_COLOR[os.status]}>{OS_STATUS_LABEL[os.status]}</Badge>
        {os.data_emissao && <Badge variant="outline">Emissão: {new Date(os.data_emissao).toLocaleDateString("pt-BR")}</Badge>}
      </div>

      <Card>
        <CardContent className="p-4 space-y-2 text-sm">
          <h3 className="font-semibold">Identificação</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div><b>Empresa:</b> {empresa?.nome || "—"}</div>
            <div><b>CNPJ:</b> {empresa?.cnpj || "—"}</div>
            <div><b>GES/GHE:</b> {ghe ? `${ghe.codigo} — ${ghe.nome}` : "—"}</div>
            <div><b>Função:</b> {funcao?.nome_funcao || "—"}</div>
            <div><b>Funcionário:</b> {funcionario?.nome || "—"}</div>
            <div><b>Responsável técnico:</b> {os.responsavel_tecnico_nome || "—"} {os.responsavel_tecnico_registro ? `(${os.responsavel_tecnico_registro})` : ""}</div>
          </div>
        </CardContent>
      </Card>

      {os.atividades && (
        <Card><CardContent className="p-4 text-sm">
          <h3 className="font-semibold mb-1">Atividades</h3>
          <p className="whitespace-pre-line text-muted-foreground">{os.atividades}</p>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-4 text-sm">
        <h3 className="font-semibold mb-1">Riscos ({os.riscos_snapshot?.length || 0})</h3>
        {!os.riscos_snapshot?.length ? (
          <p className="text-muted-foreground text-xs">Sem riscos registrados.</p>
        ) : (
          <div className="space-y-2 text-xs">
            {Object.entries(
              os.riscos_snapshot.reduce((acc: any, r) => { (acc[r.grupo] = acc[r.grupo] || []).push(r); return acc; }, {}),
            ).map(([g, arr]: any) => (
              <div key={g}>
                <Badge variant="outline">{GRUPO_RISCO_LABEL[g] || g}</Badge>
                <ul className="pl-4 list-disc mt-1">
                  {arr.map((r: any, i: number) => <li key={i}>{r.descricao}{r.fonte ? ` (${r.fonte})` : ""}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      {(os.medidas_preventivas || os.proibicoes || os.procedimentos_acidente || os.responsabilidades) && (
        <Card><CardContent className="p-4 text-sm space-y-3">
          {os.medidas_preventivas && (<div><h4 className="font-semibold">Medidas preventivas</h4><p className="whitespace-pre-line text-muted-foreground">{os.medidas_preventivas}</p></div>)}
          {os.proibicoes && (<div><h4 className="font-semibold">Proibições</h4><p className="whitespace-pre-line text-muted-foreground">{os.proibicoes}</p></div>)}
          {os.procedimentos_acidente && (<div><h4 className="font-semibold">Procedimentos em caso de acidente</h4><p className="whitespace-pre-line text-muted-foreground">{os.procedimentos_acidente}</p></div>)}
          {os.responsabilidades && (<div><h4 className="font-semibold">Responsabilidades</h4><p className="whitespace-pre-line text-muted-foreground">{os.responsabilidades}</p></div>)}
        </CardContent></Card>
      )}
    </div>
  );
}
