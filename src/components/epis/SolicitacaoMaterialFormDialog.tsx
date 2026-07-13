import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Save, Send, Loader2, Camera, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import {
  ACCEPTED_IMG_TYPES, MAX_IMG_BYTES,
  compressImage, buildItemImagePath, uploadItemImage,
  getSignedImageUrl, removeItemImage,
} from "@/lib/solicitacaoMateriaisImagens";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  solicitacaoId: string | null;
  onSaved: () => void;
}

type ItemForm = {
  id?: string;
  tipo_item: string;
  epi_id: string | null;
  nome_item: string;
  descricao: string;
  ca: string;
  unidade_medida: string;
  quantidade_solicitada: number;
  justificativa_item: string;
  observacoes: string;
  imagem_path: string | null;
  imagem_nome: string | null;
  imagem_tipo: string | null;
  imagem_tamanho: number | null;
  imagem_preview_url?: string | null;
  _uploading?: boolean;
};

const emptyItem = (): ItemForm => ({
  tipo_item: "EPI",
  epi_id: null,
  nome_item: "",
  descricao: "",
  ca: "",
  unidade_medida: "un",
  quantidade_solicitada: 1,
  justificativa_item: "",
  observacoes: "",
  imagem_path: null,
  imagem_nome: null,
  imagem_tipo: null,
  imagem_tamanho: null,
  imagem_preview_url: null,
});

const emptyHead = () => ({
  titulo: "",
  obra_id: "" as string,
  local_obra: "",
  setor: "",
  solicitante_nome: "",
  data_solicitacao: new Date().toISOString().slice(0, 10),
  data_necessidade: "",
  prioridade: "normal" as "baixa" | "normal" | "alta" | "urgente",
  justificativa: "",
  observacoes: "",
});

export default function SolicitacaoMaterialFormDialog({ open, onOpenChange, solicitacaoId, onSaved }: Props) {
  const { user, empresaId } = useAuth();
  const [head, setHead] = useState(emptyHead());
  const [itens, setItens] = useState<ItemForm[]>([emptyItem()]);
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([]);
  const [epis, setEpis] = useState<{ id: string; nome: string; ca: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("rascunho");

  useEffect(() => {
    if (!open) return;
    (async () => {
      if (!empresaId) return;
      const [{ data: o }, { data: e }] = await Promise.all([
        (supabase.from as any)("obras").select("id, nome").eq("empresa_id", empresaId).order("nome"),
        supabase.from("epis").select("id, nome, ca").eq("empresa_id", empresaId).order("nome"),
      ]);
      setObras((o as any[]) || []);
      setEpis((e as any[]) || []);
    })();
  }, [open, empresaId]);

  useEffect(() => {
    if (!open) return;
    if (!solicitacaoId) {
      setHead({ ...emptyHead(), solicitante_nome: user?.email?.split("@")[0] || "" });
      setItens([emptyItem()]);
      setStatus("rascunho");
      return;
    }
    setLoading(true);
    (async () => {
      const { data: s } = await supabase.from("solicitacoes_materiais").select("*").eq("id", solicitacaoId).maybeSingle();
      const { data: is } = await supabase.from("solicitacoes_materiais_itens").select("*").eq("solicitacao_id", solicitacaoId).order("ordem");
      if (s) {
        setStatus((s as any).status);
        setHead({
          titulo: (s as any).titulo || "",
          obra_id: (s as any).obra_id || "",
          local_obra: (s as any).local_obra || "",
          setor: (s as any).setor || "",
          solicitante_nome: (s as any).solicitante_nome || "",
          data_solicitacao: (s as any).data_solicitacao,
          data_necessidade: (s as any).data_necessidade || "",
          prioridade: (s as any).prioridade,
          justificativa: (s as any).justificativa || "",
          observacoes: (s as any).observacoes || "",
        });
      }
      setItens(((is as any[]) || []).map((i) => ({
        id: i.id,
        tipo_item: i.tipo_item,
        epi_id: i.epi_id,
        nome_item: i.nome_item,
        descricao: i.descricao || "",
        ca: i.ca || "",
        unidade_medida: i.unidade_medida,
        quantidade_solicitada: Number(i.quantidade_solicitada || 0),
        justificativa_item: i.justificativa_item || "",
        observacoes: i.observacoes || "",
      })));
      if (!(is as any[])?.length) setItens([emptyItem()]);
      setLoading(false);
    })();
  }, [open, solicitacaoId, user]);

  function updateItem(idx: number, patch: Partial<ItemForm>) {
    setItens((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }
  function pickEpi(idx: number, epiId: string) {
    const epi = epis.find((e) => e.id === epiId);
    if (!epi) return;
    updateItem(idx, { epi_id: epi.id, nome_item: epi.nome, ca: epi.ca || "" });
  }
  function addItem() { setItens((p) => [...p, emptyItem()]); }
  function removeItem(idx: number) { setItens((p) => p.filter((_, i) => i !== idx)); }

  async function save(nextStatus: "rascunho" | "enviada") {
    if (!empresaId) { toast.error("Empresa não selecionada"); return; }
    if (!head.titulo.trim()) { toast.error("Informe o título"); return; }
    if (itens.some((i) => !i.nome_item.trim())) { toast.error("Todos os itens precisam de nome"); return; }
    if (itens.some((i) => !i.quantidade_solicitada || i.quantidade_solicitada <= 0)) { toast.error("Quantidade solicitada deve ser maior que zero"); return; }

    setSaving(true);
    try {
      let solicId = solicitacaoId;

      if (!solicId) {
        const { data: numData, error: numErr } = await supabase.rpc("proximo_numero_solicitacao_material", { _empresa_id: empresaId });
        if (numErr) throw numErr;
        const { data: created, error: createErr } = await supabase.from("solicitacoes_materiais").insert({
          empresa_id: empresaId,
          numero_solicitacao: numData as unknown as string,
          titulo: head.titulo.trim(),
          obra_id: head.obra_id || null,
          local_obra: head.local_obra || null,
          setor: head.setor || null,
          solicitante_id: user?.id || null,
          solicitante_nome: head.solicitante_nome || null,
          data_solicitacao: head.data_solicitacao,
          data_necessidade: head.data_necessidade || null,
          prioridade: head.prioridade,
          justificativa: head.justificativa || null,
          observacoes: head.observacoes || null,
          status: nextStatus,
          created_by: user?.id || null,
        }).select("id").single();
        if (createErr) throw createErr;
        solicId = created.id;
      } else {
        const { error: updErr } = await supabase.from("solicitacoes_materiais").update({
          titulo: head.titulo.trim(),
          obra_id: head.obra_id || null,
          local_obra: head.local_obra || null,
          setor: head.setor || null,
          solicitante_nome: head.solicitante_nome || null,
          data_solicitacao: head.data_solicitacao,
          data_necessidade: head.data_necessidade || null,
          prioridade: head.prioridade,
          justificativa: head.justificativa || null,
          observacoes: head.observacoes || null,
          status: nextStatus,
        }).eq("id", solicId);
        if (updErr) throw updErr;
        // Simplify: delete existing itens and reinsert
        await supabase.from("solicitacoes_materiais_itens").delete().eq("solicitacao_id", solicId);
      }

      const toInsert = itens.map((i, idx) => ({
        solicitacao_id: solicId!,
        empresa_id: empresaId,
        tipo_item: i.tipo_item,
        epi_id: i.epi_id || null,
        nome_item: i.nome_item.trim(),
        descricao: i.descricao || null,
        ca: i.ca || null,
        unidade_medida: i.unidade_medida,
        quantidade_solicitada: i.quantidade_solicitada,
        justificativa_item: i.justificativa_item || null,
        observacoes: i.observacoes || null,
        ordem: idx,
      }));
      const { error: itErr } = await supabase.from("solicitacoes_materiais_itens").insert(toInsert);
      if (itErr) throw itErr;

      toast.success(nextStatus === "enviada" ? "Solicitação enviada" : "Solicitação salva");
      onSaved();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  const readOnly = !["rascunho", "enviada"].includes(status);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl h-[100dvh] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>{solicitacaoId ? "Editar Solicitação" : "Nova Solicitação de Materiais"}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Dados gerais */}
            <Card>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label>Título *</Label>
                  <Input value={head.titulo} onChange={(e) => setHead({ ...head, titulo: e.target.value })} disabled={readOnly} placeholder="Ex: Reposição EPIs frente de serviço" />
                </div>
                <div>
                  <Label>Obra / Local (cadastrado)</Label>
                  <Select value={head.obra_id || "__none"} onValueChange={(v) => setHead({ ...head, obra_id: v === "__none" ? "" : v })} disabled={readOnly}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Nenhuma —</SelectItem>
                      {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Local (texto livre)</Label>
                  <Input value={head.local_obra} onChange={(e) => setHead({ ...head, local_obra: e.target.value })} disabled={readOnly} placeholder="Ex: Obra Rua X - Bloco B" />
                </div>
                <div>
                  <Label>Setor</Label>
                  <Input value={head.setor} onChange={(e) => setHead({ ...head, setor: e.target.value })} disabled={readOnly} />
                </div>
                <div>
                  <Label>Solicitante</Label>
                  <Input value={head.solicitante_nome} onChange={(e) => setHead({ ...head, solicitante_nome: e.target.value })} disabled={readOnly} />
                </div>
                <div>
                  <Label>Data da Solicitação</Label>
                  <Input type="date" value={head.data_solicitacao} onChange={(e) => setHead({ ...head, data_solicitacao: e.target.value })} disabled={readOnly} />
                </div>
                <div>
                  <Label>Data de Necessidade</Label>
                  <Input type="date" value={head.data_necessidade} onChange={(e) => setHead({ ...head, data_necessidade: e.target.value })} disabled={readOnly} />
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={head.prioridade} onValueChange={(v: any) => setHead({ ...head, prioridade: v })} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Justificativa</Label>
                  <Textarea rows={2} value={head.justificativa} onChange={(e) => setHead({ ...head, justificativa: e.target.value })} disabled={readOnly} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea rows={2} value={head.observacoes} onChange={(e) => setHead({ ...head, observacoes: e.target.value })} disabled={readOnly} />
                </div>
              </CardContent>
            </Card>

            {/* Itens */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Itens solicitados ({itens.length})</h3>
              {!readOnly && (
                <Button size="sm" variant="outline" onClick={addItem} className="gap-1"><Plus className="w-4 h-4" /> Adicionar item</Button>
              )}
            </div>

            {itens.map((it, idx) => (
              <Card key={idx}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground">Item #{idx + 1}</span>
                    {!readOnly && itens.length > 1 && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeItem(idx)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={it.tipo_item} onValueChange={(v) => updateItem(idx, { tipo_item: v, epi_id: v === "EPI" ? it.epi_id : null })} disabled={readOnly}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EPI">EPI</SelectItem>
                          <SelectItem value="EPC">EPC</SelectItem>
                          <SelectItem value="Material de Segurança">Material de Segurança</SelectItem>
                          <SelectItem value="Ferramenta">Ferramenta</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {it.tipo_item === "EPI" && (
                      <div className="sm:col-span-4">
                        <Label className="text-xs">Buscar do cadastro de EPIs</Label>
                        <Select value={it.epi_id || "__manual"} onValueChange={(v) => v === "__manual" ? updateItem(idx, { epi_id: null }) : pickEpi(idx, v)} disabled={readOnly}>
                          <SelectTrigger><SelectValue placeholder="Selecione um EPI..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__manual">— Digitar manualmente —</SelectItem>
                            {epis.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}{e.ca ? ` — CA ${e.ca}` : ""}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="sm:col-span-4">
                      <Label className="text-xs">Nome do item *</Label>
                      <Input value={it.nome_item} onChange={(e) => updateItem(idx, { nome_item: e.target.value })} disabled={readOnly} />
                    </div>
                    <div>
                      <Label className="text-xs">CA</Label>
                      <Input value={it.ca} onChange={(e) => updateItem(idx, { ca: e.target.value })} disabled={readOnly} />
                    </div>
                    <div>
                      <Label className="text-xs">Unidade</Label>
                      <Select value={it.unidade_medida} onValueChange={(v) => updateItem(idx, { unidade_medida: v })} disabled={readOnly}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["un", "par", "caixa", "metro", "kit", "kg", "litro"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Qtd solicitada *</Label>
                      <Input type="number" min={0} step={1} value={it.quantidade_solicitada} onChange={(e) => updateItem(idx, { quantidade_solicitada: Number(e.target.value) })} disabled={readOnly} />
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs">Justificativa do item</Label>
                      <Input value={it.justificativa_item} onChange={(e) => updateItem(idx, { justificativa_item: e.target.value })} disabled={readOnly} />
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs">Observações</Label>
                      <Input value={it.observacoes} onChange={(e) => updateItem(idx, { observacoes: e.target.value })} disabled={readOnly} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="border-t p-3 flex flex-col sm:flex-row gap-2 sm:justify-end bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          {!readOnly && (
            <>
              <Button variant="secondary" onClick={() => save("rascunho")} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar rascunho
              </Button>
              <Button onClick={() => save("enviada")} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar solicitação
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
