import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PgrAvaliacaoMedicao } from "@/lib/pgrTypes";

interface Props {
  pgrId: string;
  empresaId: string;
  itemId: string | null;
  canEdit: boolean;
}

const vazio = {
  tipo_avaliacao: "quantitativa",
  data_avaliacao: "",
  responsavel_nome: "",
  responsavel_registro: "",
  ponto_amostragem: "",
  tecnica: "",
  instrumento: "",
  instrumento_certificado: "",
  instrumento_calibracao_validade: "",
  resultado: "",
  unidade: "",
  incerteza: "",
  limite_valor: "",
  limite_fonte: "",
  jornada_considerada: "",
  parecer_tecnico: "",
  laudo_url: "",
  validade_ate: "",
};

const fmt = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

export default function ItemMedicoesPanel({ pgrId, empresaId, itemId, canEdit }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(vazio);
  const [adicionando, setAdicionando] = useState(false);

  const { data: medicoes = [], isLoading } = useQuery({
    queryKey: ["pgr-medicoes", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("pgr_avaliacao_medicoes")
        .select("*").eq("inventario_item_id", itemId)
        .order("data_avaliacao", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as PgrAvaliacaoMedicao[];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const temResultado = form.resultado !== "" && form.resultado !== null;
      // Espelha o CHECK do banco: resultado sem unidade não é auditável.
      if (temResultado && !form.unidade.trim()) {
        throw new Error("Resultado numérico exige a unidade de medida.");
      }
      const { error } = await (supabase.from as any)("pgr_avaliacao_medicoes").insert({
        pgr_id: pgrId,
        empresa_id: empresaId,
        inventario_item_id: itemId,
        tipo_avaliacao: form.tipo_avaliacao,
        data_avaliacao: form.data_avaliacao || null,
        responsavel_nome: form.responsavel_nome.trim() || null,
        responsavel_registro: form.responsavel_registro.trim() || null,
        ponto_amostragem: form.ponto_amostragem.trim() || null,
        tecnica: form.tecnica.trim() || null,
        instrumento: form.instrumento.trim() || null,
        instrumento_certificado: form.instrumento_certificado.trim() || null,
        instrumento_calibracao_validade: form.instrumento_calibracao_validade || null,
        resultado: temResultado ? Number(form.resultado) : null,
        unidade: form.unidade.trim() || null,
        incerteza: form.incerteza !== "" ? Number(form.incerteza) : null,
        limite_valor: form.limite_valor.trim() || null,
        limite_fonte: form.limite_fonte.trim() || null,
        jornada_considerada: form.jornada_considerada.trim() || null,
        parecer_tecnico: form.parecer_tecnico.trim() || null,
        laudo_url: form.laudo_url.trim() || null,
        validade_ate: form.validade_ate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Medição registrada");
      qc.invalidateQueries({ queryKey: ["pgr-medicoes", itemId] });
      setForm(vazio);
      setAdicionando(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("pgr_avaliacao_medicoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pgr-medicoes", itemId] }),
    onError: (e: any) => toast.error(e.message),
  });

  if (!itemId) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Salve o item primeiro para registrar medições.
      </p>
    );
  }

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando medições…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {medicoes.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma medição registrada. Um mesmo agente pode ter várias medições
            (pontos, datas e jornadas distintas).
          </p>
        )}
        {medicoes.map((m) => (
          <div key={m.id} className="border rounded-md p-2 flex items-start justify-between gap-2">
            <div className="min-w-0 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[11px]">{m.tipo_avaliacao}</Badge>
                {m.excedente === true && (
                  <Badge variant="outline" className="text-[11px] bg-red-100 text-red-800 border-red-300">
                    Excede o limite
                  </Badge>
                )}
                {m.excedente === false && (
                  <Badge variant="outline" className="text-[11px] bg-emerald-100 text-emerald-800 border-emerald-300">
                    Dentro do limite
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">{fmt(m.data_avaliacao)}</span>
              </div>
              <p className="mt-1 font-medium">
                {m.resultado != null ? `${m.resultado} ${m.unidade || ""}` : "Sem resultado numérico"}
                {m.incerteza != null && ` (± ${m.incerteza})`}
                {m.limite_valor && ` · limite ${m.limite_valor}`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {[m.ponto_amostragem, m.tecnica, m.instrumento, m.limite_fonte && `Fonte: ${m.limite_fonte}`]
                  .filter(Boolean).join(" · ") || "—"}
              </p>
              {m.parecer_tecnico && (
                <p className="text-[11px] italic text-muted-foreground mt-1">{m.parecer_tecnico}</p>
              )}
            </div>
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={() => excluir.mutate(m.id)}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {canEdit && !adicionando && (
        <Button variant="outline" size="sm" onClick={() => setAdicionando(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar medição
        </Button>
      )}

      {canEdit && adicionando && (
        <div className="border rounded-md p-3 space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Tipo de avaliação *</Label>
              <Select value={form.tipo_avaliacao}
                onValueChange={(v) => setForm({ ...form, tipo_avaliacao: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualitativa">Qualitativa</SelectItem>
                  <SelectItem value="quantitativa">Quantitativa</SelectItem>
                  <SelectItem value="semiquantitativa">Semiquantitativa</SelectItem>
                  <SelectItem value="ergonomica">Ergonômica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data da avaliação</Label>
              <Input type="date" value={form.data_avaliacao}
                onChange={(e) => setForm({ ...form, data_avaliacao: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Válida até</Label>
              <Input type="date" value={form.validade_ate}
                onChange={(e) => setForm({ ...form, validade_ate: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Resultado</Label>
              <Input type="number" step="any" value={form.resultado}
                onChange={(e) => setForm({ ...form, resultado: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">
                Unidade {form.resultado !== "" && <span className="text-red-500">*</span>}
              </Label>
              <Input value={form.unidade}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                placeholder="dB(A), mg/m³…" />
            </div>
            <div>
              <Label className="text-xs">Incerteza</Label>
              <Input type="number" step="any" value={form.incerteza}
                onChange={(e) => setForm({ ...form, incerteza: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Limite</Label>
              <Input value={form.limite_valor}
                onChange={(e) => setForm({ ...form, limite_valor: e.target.value })}
                placeholder="85 dB(A)" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Fonte do limite</Label>
              <Input value={form.limite_fonte}
                onChange={(e) => setForm({ ...form, limite_fonte: e.target.value })}
                placeholder="NR-15 Anexo 1, ACGIH TLV…" />
            </div>
            <div>
              <Label className="text-xs">Jornada considerada</Label>
              <Input value={form.jornada_considerada}
                onChange={(e) => setForm({ ...form, jornada_considerada: e.target.value })}
                placeholder="8h/dia" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Ponto de amostragem</Label>
              <Input value={form.ponto_amostragem}
                onChange={(e) => setForm({ ...form, ponto_amostragem: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Técnica</Label>
              <Input value={form.tecnica}
                onChange={(e) => setForm({ ...form, tecnica: e.target.value })}
                placeholder="Dosimetria, NHO-01…" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Instrumento</Label>
              <Input value={form.instrumento}
                onChange={(e) => setForm({ ...form, instrumento: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Certificado</Label>
              <Input value={form.instrumento_certificado}
                onChange={(e) => setForm({ ...form, instrumento_certificado: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Calibração até</Label>
              <Input type="date" value={form.instrumento_calibracao_validade}
                onChange={(e) => setForm({ ...form, instrumento_calibracao_validade: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Responsável pela avaliação</Label>
              <Input value={form.responsavel_nome}
                onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Registro profissional</Label>
              <Input value={form.responsavel_registro}
                onChange={(e) => setForm({ ...form, responsavel_registro: e.target.value })} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Parecer técnico</Label>
            <Textarea rows={2} value={form.parecer_tecnico}
              onChange={(e) => setForm({ ...form, parecer_tecnico: e.target.value })} />
          </div>

          <div>
            <Label className="text-xs">Link do laudo / medição</Label>
            <Input value={form.laudo_url}
              onChange={(e) => setForm({ ...form, laudo_url: e.target.value })}
              placeholder="https://…" />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm"
              onClick={() => { setAdicionando(false); setForm(vazio); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Adicionar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
