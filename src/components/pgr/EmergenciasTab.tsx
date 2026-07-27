import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Edit2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  pgrId: string;
  empresaId: string;
  canEdit: boolean;
}

const TIPO_LABEL: Record<string, string> = {
  incendio: "Incêndio",
  explosao: "Explosão",
  vazamento_quimico: "Vazamento químico",
  choque_eletrico: "Choque elétrico",
  soterramento: "Soterramento",
  queda_altura: "Queda de altura",
  espaco_confinado: "Emergência em espaço confinado",
  acidente_pessoal: "Acidente pessoal",
  desastre_natural: "Desastre natural",
  contaminacao_biologica: "Contaminação biológica",
  falha_energia: "Falha de energia",
  outro: "Outro",
};

const vazio = {
  nome: "", tipo: "incendio", descricao: "", grande_magnitude: false,
  medidas_prevencao: "", procedimento_resposta: "", primeiros_socorros: "",
  meios_recursos: "", responsaveis: "", encaminhamento_acidentados: "",
  abandono_ponto_encontro: "", comunicacao: "",
  periodicidade_simulado: "", ultimo_simulado: "", proximo_simulado: "",
  licoes_aprendidas: "",
};

export default function EmergenciasTab({ pgrId, empresaId, canEdit }: Props) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(vazio);

  const { data: cenarios = [], isLoading, error } = useQuery({
    queryKey: ["pgr-emergencias", pgrId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("pgr_cenarios_emergencia")
        .select("*").eq("pgr_id", pgrId).order("nome");
      if (error) throw error;
      return (data || []) as any[];
    },
    retry: false,
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (form.nome.trim().length < 3) throw new Error("Informe o nome do cenário.");
      const payload = {
        pgr_id: pgrId, empresa_id: empresaId,
        nome: form.nome.trim(),
        tipo: form.tipo,
        descricao: form.descricao.trim() || null,
        grande_magnitude: form.grande_magnitude,
        medidas_prevencao: form.medidas_prevencao.trim() || null,
        procedimento_resposta: form.procedimento_resposta.trim() || null,
        primeiros_socorros: form.primeiros_socorros.trim() || null,
        meios_recursos: form.meios_recursos.trim() || null,
        responsaveis: form.responsaveis.trim() || null,
        encaminhamento_acidentados: form.encaminhamento_acidentados.trim() || null,
        abandono_ponto_encontro: form.abandono_ponto_encontro.trim() || null,
        comunicacao: form.comunicacao.trim() || null,
        periodicidade_simulado: form.periodicidade_simulado.trim() || null,
        ultimo_simulado: form.ultimo_simulado || null,
        proximo_simulado: form.proximo_simulado || null,
        licoes_aprendidas: form.licoes_aprendidas.trim() || null,
      };
      const q = editId
        ? (supabase.from as any)("pgr_cenarios_emergencia").update(payload).eq("id", editId)
        : (supabase.from as any)("pgr_cenarios_emergencia").insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editId ? "Cenário atualizado" : "Cenário registrado");
      qc.invalidateQueries({ queryKey: ["pgr-emergencias", pgrId] });
      setAberto(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("pgr_cenarios_emergencia").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pgr-emergencias", pgrId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const abrirNovo = () => { setEditId(null); setForm(vazio); setAberto(true); };
  const abrirEdicao = (c: any) => {
    setEditId(c.id);
    setForm({ ...vazio, ...Object.fromEntries(
      Object.keys(vazio).map((k) => [k, c[k] ?? (typeof (vazio as any)[k] === "boolean" ? false : "")]),
    ) });
    setAberto(true);
  };

  if (isLoading) {
    return (
      <Card><CardContent className="p-8 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando cenários…
      </CardContent></Card>
    );
  }

  // A tabela pode ainda não existir no ambiente (migration pendente). Dizer isso
  // é melhor do que exibir uma lista vazia como se não houvesse cenário algum.
  if (error) {
    return (
      <Card className="border-amber-300">
        <CardContent className="p-4 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Não foi possível carregar os cenários de emergência. Se este ambiente ainda
            não recebeu a migration <code>pgr_cenarios_emergencia</code>, aplique-a antes
            de usar esta aba.
            <span className="block text-xs mt-1 opacity-80">{(error as any).message}</span>
          </span>
        </CardContent>
      </Card>
    );
  }

  const Campo = ({ k, label, rows = 2, ph }: { k: string; label: string; rows?: number; ph?: string }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Textarea rows={rows} value={form[k]} placeholder={ph}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span>Preparação e resposta a emergências</span>
            {canEdit && (
              <Button size="sm" onClick={abrirNovo}>
                <Plus className="h-4 w-4 mr-1" /> Novo cenário
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Cenários decorrentes dos riscos inventariados (NR-01 1.5.6). Um cenário sem
            origem em risco identificado é apenas papel.
          </CardDescription>
        </CardHeader>
      </Card>

      {cenarios.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
          Nenhum cenário de emergência registrado.
        </CardContent></Card>
      ) : cenarios.map((c) => (
        <Card key={c.id}>
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.nome}</span>
                  <Badge variant="outline" className="text-[11px]">{TIPO_LABEL[c.tipo] || c.tipo}</Badge>
                  {c.grande_magnitude && (
                    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-[11px]">
                      Grande magnitude
                    </Badge>
                  )}
                </div>
                {c.descricao && <p className="text-sm text-muted-foreground mt-1">{c.descricao}</p>}
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                  {([
                    ["Resposta", c.procedimento_resposta],
                    ["Primeiros socorros", c.primeiros_socorros],
                    ["Meios e recursos", c.meios_recursos],
                    ["Responsáveis", c.responsaveis],
                    ["Abandono / ponto de encontro", c.abandono_ponto_encontro],
                    ["Comunicação", c.comunicacao],
                  ] as [string, string | null][]).filter(([, v]) => v).map(([rot, v]) => (
                    <div key={rot}>
                      <dt className="text-muted-foreground">{rot}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                {(c.periodicidade_simulado || c.ultimo_simulado || c.proximo_simulado) && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Simulados: {[
                      c.periodicidade_simulado,
                      c.ultimo_simulado && `último ${c.ultimo_simulado.split("-").reverse().join("/")}`,
                      c.proximo_simulado && `próximo ${c.proximo_simulado.split("-").reverse().join("/")}`,
                    ].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              {canEdit && (
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => abrirEdicao(c)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => excluir.mutate(c.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar cenário" : "Novo cenário de emergência"}</DialogTitle>
            <DialogDescription>
              Descreva como a organização responde, com quais recursos e quem é responsável.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome do cenário *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: Incêndio no depósito de tecidos" />
              </div>
              <div>
                <Label className="text-xs">Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Campo k="descricao" label="Descrição" />

            <div className="flex items-start gap-2">
              <Checkbox id="magnitude" checked={form.grande_magnitude}
                onCheckedChange={(c) => setForm({ ...form, grande_magnitude: !!c })} />
              <div>
                <Label htmlFor="magnitude" className="text-xs font-medium">Emergência de grande magnitude</Label>
                <p className="text-[11px] text-muted-foreground">
                  Extrapola a capacidade de resposta própria e exige acionamento externo.
                </p>
              </div>
            </div>

            <Campo k="medidas_prevencao" label="Medidas de prevenção" />
            <Campo k="procedimento_resposta" label="Procedimento de resposta" rows={3} />
            <Campo k="primeiros_socorros" label="Primeiros socorros" />
            <Campo k="meios_recursos" label="Meios e recursos disponíveis"
              ph="Extintores, hidrantes, kit de emergência, brigada…" />
            <Campo k="responsaveis" label="Responsáveis" />
            <Campo k="encaminhamento_acidentados" label="Encaminhamento de acidentados"
              ph="Hospital de referência, transporte, contatos" />
            <Campo k="abandono_ponto_encontro" label="Abandono e ponto de encontro" />
            <Campo k="comunicacao" label="Comunicação"
              ph="Como o alarme é dado e quem é acionado (interno e externo)" />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Periodicidade dos simulados</Label>
                <Input value={form.periodicidade_simulado}
                  onChange={(e) => setForm({ ...form, periodicidade_simulado: e.target.value })}
                  placeholder="Ex.: anual" />
              </div>
              <div>
                <Label className="text-xs">Último simulado</Label>
                <Input type="date" value={form.ultimo_simulado}
                  onChange={(e) => setForm({ ...form, ultimo_simulado: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Próximo simulado</Label>
                <Input type="date" value={form.proximo_simulado}
                  onChange={(e) => setForm({ ...form, proximo_simulado: e.target.value })} />
              </div>
            </div>

            <Campo k="licoes_aprendidas" label="Lições aprendidas" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
