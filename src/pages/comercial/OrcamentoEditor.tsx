import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Send, CheckCircle2, XCircle, Ban, FileDown, FileSpreadsheet,
  MessageCircle, Mail, Plus, Trash2, Eye,
} from "lucide-react";
import { formatBRL, calcularTotais, calcularTotalItem, formatDate, DescontoTipo } from "@/lib/orcamentoCalc";
import { OrcamentoStatus, TIPOS_ITEM } from "@/lib/orcamentoTypes";

const FINAL_STATUSES: OrcamentoStatus[] = ["aprovado", "recusado", "cancelado"];

const TRANSICOES_PERMITIDAS: Record<OrcamentoStatus, OrcamentoStatus[]> = {
  rascunho: ["enviado", "cancelado"],
  enviado: ["visualizado", "aprovado", "recusado", "cancelado"],
  visualizado: ["aprovado", "recusado", "cancelado"],
  vencido: ["aprovado", "recusado", "cancelado"],
  aprovado: [],
  recusado: [],
  cancelado: [],
};

function normalizarTelefoneBR(tel: string): string {
  const digits = (tel || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}
import { StatusBadgeOrcamento } from "@/components/comercial/StatusBadgeOrcamento";
import { gerarOrcamentoPdf } from "@/lib/orcamentoPdf";
import { exportarOrcamentoExcel } from "@/lib/orcamentoExcel";

type Item = {
  id?: string;
  tipo: string;
  codigo?: string | null;
  descricao: string;
  detalhe?: string | null;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  desconto: number;
  total_item: number;
  ordem: number;
};

const emptyItem = (ordem: number): Item => ({
  tipo: "servico", descricao: "", unidade: "un",
  quantidade: 1, valor_unitario: 0, desconto: 0, total_item: 0, ordem,
});

export default function OrcamentoEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "novo";
  const { empresaId } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<any>({
    titulo: "", cliente_id: null, cliente_nome: "", cliente_cnpj_cpf: "",
    cliente_email: "", cliente_telefone: "", cliente_endereco: "", responsavel_cliente: "",
    data_emissao: new Date().toISOString().slice(0, 10),
    data_validade: "",
    status: "rascunho" as OrcamentoStatus,
    observacoes: "", condicoes_pagamento: "", prazo_execucao: "", validade_proposta: "",
    desconto_tipo: "valor" as DescontoTipo, desconto_valor: 0, impostos_valor: 0, taxa_extra: 0,
  });
  const [itens, setItens] = useState<Item[]>([emptyItem(0)]);
  const [loaded, setLoaded] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [recusarOpen, setRecusarOpen] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState("");

  const { data: clientes = [] } = useQuery({
    queryKey: ["comercial_clientes_min", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("clientes_comerciais").select("id,nome,cnpj_cpf,email,telefone,endereco,contato_responsavel").order("nome");
      return data || [];
    },
  });

  const { data: catalogo = [] } = useQuery({
    queryKey: ["comercial_catalogo_min", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("catalogo_servicos").select("id,nome,categoria,unidade,valor_padrao,descricao").eq("ativo", true).order("nome");
      return data || [];
    },
  });

  const { data: empresa } = useQuery({
    queryKey: ["empresa_config_pdf", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("empresa_config").select("nome,cnpj,telefone,email,endereco").eq("id", empresaId).maybeSingle();
      return data || {};
    },
  });

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const { data: orc, error } = await (supabase.from as any)("orcamentos").select("*").eq("id", id).single();
      if (error) { toast.error("Orçamento não encontrado"); nav("/comercial/orcamentos"); return; }
      const { data: its } = await (supabase.from as any)("orcamentos_itens").select("*").eq("orcamento_id", id).order("ordem");
      setForm({ ...orc, data_validade: orc.data_validade || "" });
      setItens((its || []).length ? (its as Item[]) : [emptyItem(0)]);
      setLoaded(true);
    })();
  }, [id, isNew, nav]);

  const totais = useMemo(() => calcularTotais({
    itens: itens.map((i) => ({ quantidade: i.quantidade, valor_unitario: i.valor_unitario, desconto: i.desconto })),
    desconto_tipo: form.desconto_tipo,
    desconto_valor: form.desconto_valor,
    impostos_valor: form.impostos_valor,
    taxa_extra: form.taxa_extra,
  }), [itens, form.desconto_tipo, form.desconto_valor, form.impostos_valor, form.taxa_extra]);

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItens((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const merged = { ...it, ...patch };
      merged.total_item = calcularTotalItem(merged.quantidade, merged.valor_unitario, merged.desconto);
      return merged;
    }));
  };
  const addItem = () => setItens((p) => [...p, emptyItem(p.length)]);
  const removeItem = (idx: number) => setItens((p) => p.length > 1 ? p.filter((_, i) => i !== idx) : p);

  const pickCliente = (cid: string) => {
    const c = clientes.find((x: any) => x.id === cid);
    if (!c) return;
    setForm((f: any) => ({
      ...f, cliente_id: c.id, cliente_nome: c.nome, cliente_cnpj_cpf: c.cnpj_cpf,
      cliente_email: c.email, cliente_telefone: c.telefone, cliente_endereco: c.endereco,
      responsavel_cliente: c.contato_responsavel,
    }));
  };

  const pickCatalogo = (idx: number, sid: string) => {
    const s = catalogo.find((x: any) => x.id === sid);
    if (!s) return;
    updateItem(idx, { descricao: s.nome, detalhe: s.descricao, unidade: s.unidade || "un", valor_unitario: Number(s.valor_padrao) || 0 });
  };

  const save = async (newStatus?: OrcamentoStatus): Promise<string | null> => {
    if (!empresaId) { toast.error("Empresa ativa não definida"); return null; }
    if (!form.titulo?.trim()) { toast.error("Informe o título da proposta"); return null; }
    if (!itens.some((i) => i.descricao.trim())) { toast.error("Adicione ao menos um item"); return null; }
    setSaving(true);
    try {
      let orcId = isNew ? null : id!;
      const payload: any = {
        ...form,
        empresa_id: empresaId,
        data_validade: form.data_validade || null,
        subtotal: totais.subtotal,
        total: totais.total,
      };
      if (newStatus) payload.status = newStatus;
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;

      if (isNew) {
        const { data: numero, error: e0 } = await (supabase as any).rpc("next_orcamento_numero", { _empresa_id: empresaId });
        if (e0) throw e0;
        payload.numero_orcamento = numero;
        const { data, error } = await (supabase.from as any)("orcamentos").insert(payload).select("id").single();
        if (error) throw error;
        orcId = data.id;

        const itensPayload = itens
          .filter((i) => i.descricao.trim())
          .map((i, idx) => ({
            empresa_id: empresaId, orcamento_id: orcId,
            tipo: i.tipo, codigo: i.codigo || null, descricao: i.descricao, detalhe: i.detalhe || null,
            unidade: i.unidade, quantidade: i.quantidade, valor_unitario: i.valor_unitario,
            desconto: i.desconto, total_item: i.total_item, ordem: idx,
          }));
        if (itensPayload.length) {
          const { error } = await (supabase.from as any)("orcamentos_itens").insert(itensPayload);
          if (error) throw error;
        }
      } else {
        const { error } = await (supabase.from as any)("orcamentos").update(payload).eq("id", orcId);
        if (error) throw error;

        // Substitui itens atomicamente via RPC (rollback em caso de falha)
        const itensJson = itens
          .filter((i) => i.descricao.trim())
          .map((i, idx) => ({
            tipo: i.tipo, codigo: i.codigo || null, descricao: i.descricao, detalhe: i.detalhe || null,
            unidade: i.unidade, quantidade: i.quantidade, valor_unitario: i.valor_unitario,
            desconto: i.desconto, total_item: i.total_item, ordem: idx,
          }));
        const { error: eRpc } = await (supabase as any).rpc("salvar_orcamento_itens", {
          _orcamento_id: orcId, _itens: itensJson,
        });
        if (eRpc) throw eRpc;
      }

      toast.success("Orçamento salvo");
      qc.invalidateQueries({ queryKey: ["orcamentos_list", empresaId] });
      if (isNew && orcId) nav(`/comercial/orcamentos/${orcId}`, { replace: true });
      return orcId;
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const isFinalizado = FINAL_STATUSES.includes(form.status as OrcamentoStatus);

  const changeStatus = async (novo: OrcamentoStatus, extra: Record<string, any> = {}) => {
    if (isNew) { toast.error("Salve primeiro"); return; }
    const atual = form.status as OrcamentoStatus;
    const permitidas = TRANSICOES_PERMITIDAS[atual] || [];
    if (!permitidas.includes(novo)) {
      toast.error("Não é possível alterar o status de uma proposta finalizada.");
      return;
    }
    if (novo === "aprovado" && form.data_validade && form.data_validade < new Date().toISOString().slice(0, 10)) {
      toast.error("Validade expirada. Atualize a validade antes de aprovar.");
      return;
    }
    const { error } = await (supabase.from as any)("orcamentos").update({ status: novo, ...extra }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setForm((f: any) => ({ ...f, status: novo, ...extra }));
    qc.invalidateQueries({ queryKey: ["orcamentos_list", empresaId] });
    toast.success(`Status: ${novo}`);
  };

  const buildPdfData = () => ({
    numero_orcamento: form.numero_orcamento || "PREVIEW",
    titulo: form.titulo, status: form.status,
    data_emissao: form.data_emissao, data_validade: form.data_validade || null,
    cliente_nome: form.cliente_nome, cliente_cnpj_cpf: form.cliente_cnpj_cpf,
    cliente_email: form.cliente_email, cliente_telefone: form.cliente_telefone,
    cliente_endereco: form.cliente_endereco, responsavel_cliente: form.responsavel_cliente,
    observacoes: form.observacoes, condicoes_pagamento: form.condicoes_pagamento,
    prazo_execucao: form.prazo_execucao, validade_proposta: form.validade_proposta,
    subtotal: totais.subtotal, desconto_tipo: form.desconto_tipo, desconto_valor: form.desconto_valor,
    impostos_valor: form.impostos_valor, taxa_extra: form.taxa_extra, total: totais.total,
  });

  const baixarPdf = () => {
    const doc = gerarOrcamentoPdf(buildPdfData(), itens, empresa || {});
    doc.save(`orcamento-${form.numero_orcamento || "preview"}.pdf`);
  };

  const baixarExcel = () => {
    exportarOrcamentoExcel({ ...buildPdfData(), status: form.status }, itens);
  };

  const enviarWhatsapp = () => {
    const validadeTxt = form.data_validade ? ` Validade: ${formatDate(form.data_validade)}.` : "";
    const msg = `Olá! Segue a proposta nº ${form.numero_orcamento || "(pendente)"} referente a ${form.titulo}. Valor total: ${formatBRL(totais.total)}.${validadeTxt}`;
    const tel = normalizarTelefoneBR(form.cliente_telefone || "");
    if (!tel) { toast.error("Telefone do cliente não informado"); return; }
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  const enviarEmail = () => {
    const subject = `Proposta ${form.numero_orcamento || ""} — ${form.titulo}`;
    const body = `Olá,\n\nSegue proposta nº ${form.numero_orcamento || ""} no valor total de ${formatBRL(totais.total)}.${form.data_validade ? `\nValidade: ${formatDate(form.data_validade)}.` : ""}\n\nAtenciosamente.`;
    const url = `mailto:${form.cliente_email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!loaded) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto pb-24">
      <PageHeader
        title={isNew ? "Novo Orçamento" : `Orçamento ${form.numero_orcamento || ""}`}
        subtitle={form.titulo || "Preencha os dados da proposta"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => nav("/comercial/orcamentos")}><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
            {!isNew && <StatusBadgeOrcamento status={form.status} validade={form.data_validade} className="self-center" />}
          </div>
        }
      />

      {isFinalizado && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-sm dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800">
          Esta proposta está finalizada ({form.status}). Para alterar, duplique a proposta.
        </div>
      )}

      <fieldset disabled={isFinalizado} className="grid gap-4 lg:grid-cols-3 disabled:opacity-95">
        <div className="lg:col-span-2 space-y-4">
          {/* Cliente */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Cliente</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Cliente cadastrado</Label>
                <Select value={form.cliente_id || ""} onValueChange={pickCliente}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                  <SelectContent>
                    {clientes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2"><Label>Nome / Razão Social</Label><Input value={form.cliente_nome || ""} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} /></div>
              <div><Label>CNPJ/CPF</Label><Input value={form.cliente_cnpj_cpf || ""} onChange={(e) => setForm({ ...form, cliente_cnpj_cpf: e.target.value })} /></div>
              <div><Label>Responsável</Label><Input value={form.responsavel_cliente || ""} onChange={(e) => setForm({ ...form, responsavel_cliente: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.cliente_telefone || ""} onChange={(e) => setForm({ ...form, cliente_telefone: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input value={form.cliente_email || ""} onChange={(e) => setForm({ ...form, cliente_email: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Endereço</Label><Input value={form.cliente_endereco || ""} onChange={(e) => setForm({ ...form, cliente_endereco: e.target.value })} /></div>
            </CardContent>
          </Card>

          {/* Dados */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Dados da Proposta</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Título *</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
              <div><Label>Data de emissão</Label><Input type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} /></div>
              <div><Label>Validade</Label><Input type="date" value={form.data_validade || ""} onChange={(e) => setForm({ ...form, data_validade: e.target.value })} /></div>
              <div><Label>Prazo de execução</Label><Input value={form.prazo_execucao || ""} onChange={(e) => setForm({ ...form, prazo_execucao: e.target.value })} placeholder="ex: 30 dias" /></div>
              <div><Label>Condições de pagamento</Label><Input value={form.condicoes_pagamento || ""} onChange={(e) => setForm({ ...form, condicoes_pagamento: e.target.value })} placeholder="ex: 50% + 50%" /></div>
              <div className="sm:col-span-2"><Label>Observações</Label><Textarea value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} /></div>
            </CardContent>
          </Card>

          {/* Itens */}
          <Card>
            <CardHeader className="pb-2 flex flex-row justify-between items-center">
              <CardTitle className="text-base">Itens</CardTitle>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-4 h-4 mr-1" />Item</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {itens.map((it, idx) => (
                <div key={idx} className="p-3 border rounded-md space-y-2 bg-muted/20">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Item {idx + 1}</span>
                    <Button size="sm" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select value={it.tipo} onValueChange={(v) => updateItem(idx, { tipo: v })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{TIPOS_ITEM.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs">Catálogo</Label>
                      <Select value="" onValueChange={(v) => pickCatalogo(idx, v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Escolher do catálogo..." /></SelectTrigger>
                        <SelectContent>{catalogo.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome} — {formatBRL(s.valor_padrao)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Descrição *</Label>
                    <Input value={it.descricao} onChange={(e) => updateItem(idx, { descricao: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Detalhe</Label>
                    <Textarea value={it.detalhe || ""} onChange={(e) => updateItem(idx, { detalhe: e.target.value })} rows={2} />
                  </div>
                  <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
                    <div><Label className="text-xs">Unid.</Label><Input value={it.unidade} onChange={(e) => updateItem(idx, { unidade: e.target.value })} /></div>
                    <div><Label className="text-xs">Qtd</Label><Input type="number" step="0.001" value={it.quantidade} onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Vl. Unit.</Label><Input type="number" step="0.01" value={it.valor_unitario} onChange={(e) => updateItem(idx, { valor_unitario: Number(e.target.value) })} /></div>
                    <div><Label className="text-xs">Desconto</Label><Input type="number" step="0.01" value={it.desconto} onChange={(e) => updateItem(idx, { desconto: Number(e.target.value) })} /></div>
                    <div>
                      <Label className="text-xs">Total</Label>
                      <div className="h-9 flex items-center justify-end px-2 border rounded-md bg-background font-semibold text-sm">{formatBRL(it.total_item)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Lateral: totais + ações */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader className="pb-2"><CardTitle className="text-base">Totais</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Tipo desconto</Label>
                  <Select value={form.desconto_tipo} onValueChange={(v: DescontoTipo) => setForm({ ...form, desconto_tipo: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="valor">R$ (valor)</SelectItem>
                      <SelectItem value="percentual">% (percentual)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Desconto</Label>
                  <Input type="number" step="0.01" value={form.desconto_valor} onChange={(e) => setForm({ ...form, desconto_valor: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Impostos (R$)</Label>
                  <Input type="number" step="0.01" value={form.impostos_valor} onChange={(e) => setForm({ ...form, impostos_valor: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Taxa extra (R$)</Label>
                  <Input type="number" step="0.01" value={form.taxa_extra} onChange={(e) => setForm({ ...form, taxa_extra: Number(e.target.value) })} />
                </div>
              </div>
              <div className="border-t pt-2 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatBRL(totais.subtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Desconto</span><span>- {formatBRL(totais.descontoAplicado)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Impostos</span><span>{formatBRL(totais.impostos)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Taxa</span><span>{formatBRL(totais.taxa)}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2"><span>TOTAL</span><span>{formatBRL(totais.total)}</span></div>
              </div>

              <div className="grid gap-2">
                <Button onClick={() => save()} disabled={saving}><Save className="w-4 h-4 mr-2" />Salvar</Button>
                {!isNew && (
                  <>
                    <Button variant="outline" onClick={baixarPdf}><FileDown className="w-4 h-4 mr-2" />PDF</Button>
                    <Button variant="outline" onClick={baixarExcel}><FileSpreadsheet className="w-4 h-4 mr-2" />Excel</Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={enviarWhatsapp}><MessageCircle className="w-4 h-4 mr-1" />WhatsApp</Button>
                      <Button variant="outline" size="sm" onClick={enviarEmail}><Mail className="w-4 h-4 mr-1" />E-mail</Button>
                    </div>
                  </>
                )}
              </div>

              {!isNew && (
                <div className="border-t pt-2 grid gap-1.5">
                  <div className="text-xs font-semibold text-muted-foreground">Status</div>
                  <Button size="sm" variant="outline" onClick={() => changeStatus("enviado", { enviado_em: new Date().toISOString() })}>
                    <Send className="w-3.5 h-3.5 mr-1" />Marcar enviado
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => changeStatus("visualizado", { visualizado_em: new Date().toISOString() })}>
                    <Eye className="w-3.5 h-3.5 mr-1" />Marcar visualizado
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => changeStatus("aprovado", { aprovado_em: new Date().toISOString() })}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" />Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRecusarOpen(true)}>
                    <XCircle className="w-3.5 h-3.5 mr-1 text-red-600" />Recusar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => changeStatus("cancelado", { cancelado_em: new Date().toISOString() })}>
                    <Ban className="w-3.5 h-3.5 mr-1" />Cancelar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={recusarOpen} onOpenChange={setRecusarOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recusar proposta</DialogTitle></DialogHeader>
          <div>
            <Label>Motivo da recusa *</Label>
            <Textarea value={motivoRecusa} onChange={(e) => setMotivoRecusa(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecusarOpen(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (!motivoRecusa.trim()) { toast.error("Informe o motivo"); return; }
                await changeStatus("recusado", { recusado_em: new Date().toISOString(), motivo_recusa: motivoRecusa });
                setRecusarOpen(false); setMotivoRecusa("");
              }}
            >Confirmar recusa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
