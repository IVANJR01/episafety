import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ClipboardList, Stethoscope, FileText, Flame, Zap, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { loadGheFicha, GheFichaCompleta, GRUPO_RISCO_LABEL } from "@/lib/gesFicha";
import { toast } from "sonner";

type DocKey = "os" | "pgr" | "pcmso" | "ltcat" | "insalubridade" | "periculosidade";

const DOCUMENTOS: { key: DocKey; nome: string; icon: any; disponivel: boolean; nota?: string }[] = [
  { key: "pgr", nome: "PGR", icon: ShieldCheck, disponivel: true, nota: "Importa riscos do GES/GHE para o inventário." },
  { key: "os", nome: "Ordem de Serviço", icon: ClipboardList, disponivel: true, nota: "Gera OS pronta a partir do GES/GHE." },
  { key: "pcmso", nome: "PCMSO", icon: Stethoscope, disponivel: false, nota: "Fase B — em breve." },
  { key: "ltcat", nome: "LTCAT", icon: FileText, disponivel: false, nota: "Fase C — requer revisão técnica." },
  { key: "insalubridade", nome: "Laudo de Insalubridade", icon: Flame, disponivel: false, nota: "Fase C — requer revisão técnica." },
  { key: "periculosidade", nome: "Laudo de Periculosidade", icon: Zap, disponivel: false, nota: "Fase C — requer revisão técnica." },
];

export default function GerarDocumentos() {
  const nav = useNavigate();
  const { empresaId, empresaScopeIds } = useAuth();

  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([]);
  const [ghes, setGhes] = useState<{ id: string; codigo: string; nome: string }[]>([]);
  const [empresaSel, setEmpresaSel] = useState<string>(empresaId || "");
  const [gheSel, setGheSel] = useState<string>("");
  const [docSel, setDocSel] = useState<DocKey | "">("");
  const [ficha, setFicha] = useState<GheFichaCompleta | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      let q = (supabase as any).from("empresas").select("id, nome").eq("ativo", true).order("nome");
      if (empresaScopeIds.length > 0) q = q.in("id", empresaScopeIds);
      const { data } = await q;
      setEmpresas((data || []) as any);
    })();
  }, [empresaScopeIds.join(",")]);

  useEffect(() => {
    if (!empresaSel) { setGhes([]); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from("ghe_ges")
        .select("id, codigo, nome")
        .eq("empresa_id", empresaSel)
        .eq("status", "ativo")
        .order("codigo");
      setGhes((data || []) as any);
    })();
  }, [empresaSel]);

  useEffect(() => {
    if (!gheSel) { setFicha(null); return; }
    setLoading(true);
    loadGheFicha(gheSel).then(setFicha).catch((e) => toast.error(e.message || "Falha ao carregar GES")).finally(() => setLoading(false));
  }, [gheSel]);

  const podeGerar = docSel && (docSel === "pgr" || (docSel === "os" && gheSel && empresaSel));

  const gerar = () => {
    if (docSel === "os") {
      // Vai para tela de nova OS já com GHE pré-selecionado via query (opcional; simplifica indo direto)
      nav("/programas/ordem-servico/novo");
    } else if (docSel === "pgr") {
      // Vai para lista PGR — usuário abre um PGR e usa "Importar GHE/GES"
      nav("/pgr");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gerar Documentos"
        subtitle="Cadastre o GES/GHE uma vez. Reaproveite os dados nos programas técnicos."
      />

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">1. Contexto</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Empresa</Label>
              <Select value={empresaSel} onValueChange={setEmpresaSel}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>GES/GHE</Label>
              <Select value={gheSel} onValueChange={setGheSel} disabled={!empresaSel}>
                <SelectTrigger><SelectValue placeholder={empresaSel ? "Selecione" : "Escolha a empresa primeiro"} /></SelectTrigger>
                <SelectContent>
                  {ghes.map((g) => <SelectItem key={g.id} value={g.id}>{g.codigo} — {g.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">2. Documento a gerar</h3>
          <div className="grid gap-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {DOCUMENTOS.map((d) => {
              const Icon = d.icon;
              const active = docSel === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  disabled={!d.disponivel}
                  onClick={() => setDocSel(d.key)}
                  className={`text-left border rounded-lg p-3 transition-colors ${
                    active ? "border-primary bg-primary/5" : "border-input"
                  } ${!d.disponivel ? "opacity-50 cursor-not-allowed" : "hover:bg-accent"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Icon className="w-4 h-4 text-primary" />
                    {d.disponivel
                      ? <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px]">Disponível</Badge>
                      : <Badge variant="outline" className="text-[10px]">Em breve</Badge>}
                  </div>
                  <div className="font-semibold text-sm">{d.nome}</div>
                  {d.nota && <div className="text-xs text-muted-foreground mt-1">{d.nota}</div>}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {ficha && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-sm">3. Prévia do GES/GHE</h3>
            <div className="text-xs text-muted-foreground">Estes dados serão reaproveitados no documento.</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="border rounded p-2">
                <div className="font-semibold mb-1">Cabeçalho</div>
                <div><b>Setor:</b> {ficha.cabecalho.setor || "—"}</div>
                <div><b>Trab. expostos:</b> {ficha.cabecalho.trabalhadores_expostos ?? "—"}</div>
                <div><b>Nível de risco:</b> {ficha.cabecalho.nivel_risco || "—"}</div>
              </div>
              <div className="border rounded p-2">
                <div className="font-semibold mb-1">Riscos ({ficha.riscos.length})</div>
                {ficha.riscos.slice(0, 5).map((r) => (
                  <div key={r.id} className="truncate">• {GRUPO_RISCO_LABEL[r.grupo] || r.grupo}: {r.texto_aso || r.perigo_fonte || r.tipo_agente}</div>
                ))}
                {ficha.riscos.length > 5 && <div className="text-muted-foreground">+ {ficha.riscos.length - 5}…</div>}
              </div>
              <div className="border rounded p-2">
                <div className="font-semibold mb-1">Exames ({ficha.exames.length}) • Funções ({ficha.funcoes.length})</div>
                {ficha.funcoes.slice(0, 4).map((f) => <div key={f.id}>• {f.nome_funcao}</div>)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin inline" /></div>}

      <div className="flex justify-end">
        <Button onClick={gerar} disabled={!podeGerar}>
          Continuar
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        <b>Nota técnica:</b> nenhum laudo (LTCAT, Insalubridade, Periculosidade) é gerado com conclusão automática — a responsabilidade técnica exige revisão profissional antes da emissão.
      </div>
    </div>
  );
}
