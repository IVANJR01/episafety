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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  FORMAS_PAGAMENTO, FORMAS_COM_DETALHE, NUPAY_KEY, INFINITEPAY_LINK_KEY,
  CartaoConfig, CartaoModo, CartaoPreset, CARTAO_PRESET_LABEL, taxasDoPreset,
  PagamentoConfig, DEFAULT_AVISTA, DEFAULT_CARTAO, DEFAULT_NUPAY, DEFAULT_INFINITEPAY,
  calcularDescontoAvista, calcularNupay, gerarTabelaParcelas, gerarTabelaInfinitepay, hydratePagamentoConfig,
} from "@/lib/orcamentoPagamento";
import {
  ArrowLeft, Save, Send, CheckCircle2, XCircle, Ban, FileDown, FileSpreadsheet,
  MessageCircle, Mail, Plus, Trash2, Eye,
} from "lucide-react";
import { formatBRL, calcularTotais, calcularTotalItem, formatDate, DescontoTipo } from "@/lib/orcamentoCalc";
import { OrcamentoStatus, TIPOS_ITEM } from "@/lib/orcamentoTypes";

const FINAL_STATUSES: OrcamentoStatus[] = ["aprovado", "recusado", "cancelado"];

const CARTAO_CREDITO_KEY = "Cartão de crédito";


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
    observacoes: "", condicoes_pagamento: "", condicoes_pagamento_detalhe: "",
    pagamento_config: { formas: [], avista: { ...DEFAULT_AVISTA }, cartao: { ...DEFAULT_CARTAO } } as PagamentoConfig,
    prazo_execucao: "", validade_proposta: "",
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
    queryKey: ["catalogo_servicos", empresaId],
    enabled: !!empresaId,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("catalogo_servicos")
        .select("id,nome,categoria,unidade,valor_padrao,descricao,ativo,empresa_id")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome");
      if (error) { console.error("[catalogo_servicos]", error); return []; }
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
      const pagamento_config = hydratePagamentoConfig(orc);
      setForm({
        ...orc,
        data_validade: orc.data_validade || "",
        pagamento_config,
      });
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
    const pc: PagamentoConfig = form.pagamento_config || { formas: [], avista: { ...DEFAULT_AVISTA }, cartao: { ...DEFAULT_CARTAO } };
    const formas: string[] = pc.formas || [];
    if (!formas.length) { toast.error("Selecione ao menos uma forma de pagamento"); return null; }
    const precisaDetalhe = formas.some((f) => FORMAS_COM_DETALHE.has(f));
    if (precisaDetalhe && !form.condicoes_pagamento_detalhe?.trim()) {
      toast.error("Preencha os detalhes da condição de pagamento"); return null;
    }
    const usaAvista = formas.includes("À vista") || (formas.includes("PIX") && pc.avista.aplica_pix);
    if (usaAvista && pc.avista.desconto_valor < 0) {
      toast.error("Desconto à vista não pode ser negativo"); return null;
    }
    if (usaAvista && pc.avista.desconto_tipo === "percentual" && pc.avista.desconto_valor > 100) {
      toast.error("Desconto percentual não pode passar de 100%"); return null;
    }
    if (formas.includes(CARTAO_CREDITO_KEY)) {
      const cc = pc.cartao;
      if (!cc.max_parcelas || cc.max_parcelas < 1 || cc.max_parcelas > 12) { toast.error("Máximo de parcelas inválido"); return null; }
      if (cc.parcelas_sem_juros < 0 || cc.parcelas_sem_juros > cc.max_parcelas) { toast.error("Parcelas sem juros inválidas"); return null; }
      if (cc.parcelas_sem_juros < cc.max_parcelas && (cc.juros_mensal === undefined || cc.juros_mensal < 0)) {
        toast.error("Informe o juros ao mês"); return null;
      }
    }
    if (!itens.some((i) => i.descricao.trim())) { toast.error("Adicione ao meno um item"); return null; }
    setSaving(true);
    try {
      let orcId = isNew ? null : id!;
      // Legado (retrocompat leitura antiga)
      const legacyCartao: CartaoConfig | null = formas.includes(CARTAO_CREDITO_KEY)
        ? {
            parcelas: pc.cartao.max_parcelas,
            tipo: pc.cartao.parcelas_sem_juros >= pc.cartao.max_parcelas ? "sem_juros" : "com_juros",
            juros_mensal: pc.cartao.juros_mensal,
            valor_parcela: +(totais.total / pc.cartao.max_parcelas).toFixed(2),
            total_com_juros: totais.total,
          }
        : null;
      const payload: any = {
        ...form,
        empresa_id: empresaId,
        data_validade: form.data_validade || null,
        formas_pagamento: formas,
        pagamento_config: pc,
        cartao_credito_config: legacyCartao,
        condicoes_pagamento: formas.join(" | "),
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

  const buildPdfData = () => {
    const pc: PagamentoConfig = form.pagamento_config || { formas: [], avista: { ...DEFAULT_AVISTA }, cartao: { ...DEFAULT_CARTAO } };
    return {
      numero_orcamento: form.numero_orcamento || "PREVIEW",
      titulo: form.titulo, status: form.status,
      data_emissao: form.data_emissao, data_validade: form.data_validade || null,
      cliente_nome: form.cliente_nome, cliente_cnpj_cpf: form.cliente_cnpj_cpf,
      cliente_email: form.cliente_email, cliente_telefone: form.cliente_telefone,
      cliente_endereco: form.cliente_endereco, responsavel_cliente: form.responsavel_cliente,
      observacoes: form.observacoes, condicoes_pagamento: form.condicoes_pagamento,
      condicoes_pagamento_detalhe: form.condicoes_pagamento_detalhe,
      formas_pagamento: pc.formas,
      pagamento_config: pc,
      cartao_credito_config: null,
      prazo_execucao: form.prazo_execucao, validade_proposta: form.validade_proposta,
      subtotal: totais.subtotal, desconto_tipo: form.desconto_tipo, desconto_valor: form.desconto_valor,
      impostos_valor: form.impostos_valor, taxa_extra: form.taxa_extra, total: totais.total,
    };
  };


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

      <div className="grid gap-4 lg:grid-cols-3">
        <fieldset disabled={isFinalizado} className="lg:col-span-2 space-y-4 min-w-0">
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
              <div className="sm:col-span-2">
                <Label>Formas de pagamento *</Label>
                {(() => {
                  const pc: PagamentoConfig = form.pagamento_config || { formas: [], avista: { ...DEFAULT_AVISTA }, cartao: { ...DEFAULT_CARTAO } };
                  const setPc = (patch: Partial<PagamentoConfig>) => setForm({ ...form, pagamento_config: { ...pc, ...patch } });
                  const setAvista = (patch: Partial<typeof pc.avista>) => setPc({ avista: { ...pc.avista, ...patch } });
                  const setCartao = (patch: Partial<typeof pc.cartao>) => setPc({ cartao: { ...pc.cartao, ...patch } });
                  const toggleForma = (f: string, on: boolean) => {
                    const next = on ? [...pc.formas, f] : pc.formas.filter((x) => x !== f);
                    setPc({ formas: next });
                  };
                  const formasSel = pc.formas || [];
                  const showAvista = formasSel.includes("À vista") || (formasSel.includes("PIX") && pc.avista.aplica_pix);
                  const descAv = calcularDescontoAvista(totais.total, pc.avista.desconto_tipo, pc.avista.desconto_valor);
                  const tabela = gerarTabelaParcelas(totais.total, pc.cartao);
                  return (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2 mt-1">
                        {FORMAS_PAGAMENTO.map((f) => {
                          const checked = formasSel.includes(f);
                          return (
                            <label key={f} className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer min-h-11 ${checked ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
                              <Checkbox checked={checked} onCheckedChange={(v) => toggleForma(f, !!v)} />
                              <span className="text-sm">{f}</span>
                            </label>
                          );
                        })}
                      </div>

                      {formasSel.some((f) => FORMAS_COM_DETALHE.has(f)) && (
                        <div className="mt-3">
                          <Label>Detalhes da condição *</Label>
                          <Input
                            value={form.condicoes_pagamento_detalhe || ""}
                            onChange={(e) => setForm({ ...form, condicoes_pagamento_detalhe: e.target.value })}
                            placeholder="ex: Entrada de R$ 500,00 + 2 parcelas mensais"
                          />
                        </div>
                      )}

                      {showAvista && (
                        <div className="mt-3 border rounded-md p-3 bg-muted/20 space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="text-xs font-semibold text-muted-foreground">Desconto à vista / PIX</div>
                            {formasSel.includes("PIX") && (
                              <label className="flex items-center gap-2 text-xs">
                                <Checkbox
                                  checked={pc.avista.aplica_pix}
                                  onCheckedChange={(v) => setAvista({ aplica_pix: !!v })}
                                />
                                Aplicar no PIX também
                              </label>
                            )}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div>
                              <Label className="text-xs">Tipo</Label>
                              <Select value={pc.avista.desconto_tipo} onValueChange={(v: DescontoTipo) => setAvista({ desconto_tipo: v })}>
                                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percentual">% (percentual)</SelectItem>
                                  <SelectItem value="valor">R$ (valor)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Valor do desconto</Label>
                              <Input type="number" step="0.01" min={0} value={pc.avista.desconto_valor}
                                onChange={(e) => setAvista({ desconto_valor: Number(e.target.value) })} />
                            </div>
                            <div>
                              <Label className="text-xs">Valor final</Label>
                              <div className="h-10 flex items-center justify-end px-2 border rounded-md bg-background font-semibold text-sm text-emerald-700 dark:text-emerald-400">
                                {formatBRL(descAv.valor_final)}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Economia de {formatBRL(descAv.desconto)} sobre {formatBRL(totais.total)}
                          </div>
                        </div>
                      )}

                      {formasSel.includes(NUPAY_KEY) && (() => {
                        const taxa = pc.nupay?.taxa ?? DEFAULT_NUPAY.taxa;
                        const np = calcularNupay(totais.total, taxa);
                        const setNupay = (patch: Partial<NonNullable<typeof pc.nupay>>) => setPc({ nupay: { taxa, ...(pc.nupay || {}), ...patch } });
                        return (
                          <div className="mt-3 border rounded-md p-3 bg-muted/20 space-y-3">
                            <div className="text-xs font-semibold text-muted-foreground">Pagar com Nubank / NuPay</div>
                            <div className="grid gap-2 sm:grid-cols-3">
                              <div>
                                <Label className="text-xs">Taxa real (%)</Label>
                                <Input type="number" step="0.01" min={0} value={taxa}
                                  onChange={(e) => setNupay({ taxa: Number(e.target.value) })} />
                              </div>
                              <div>
                                <Label className="text-xs">Acréscimo</Label>
                                <div className="h-10 flex items-center justify-end px-2 border rounded-md bg-background text-sm">{formatBRL(np.acrescimo)}</div>
                              </div>
                              <div>
                                <Label className="text-xs">Valor final</Label>
                                <div className="h-10 flex items-center justify-end px-2 border rounded-md bg-background font-semibold text-sm text-primary">{formatBRL(np.valor_final)}</div>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Base {formatBRL(totais.total)} × (1 + {taxa.toFixed(2)}%) = {formatBRL(np.valor_final)}. Confira a taxa real no seu checkout Nubank antes de enviar.
                            </div>
                          </div>
                        );
                      })()}


                      {formasSel.includes(CARTAO_CREDITO_KEY) && (() => {
                        const modo: CartaoModo = pc.cartao.modo || "juros_composto";
                        const preset: CartaoPreset = pc.cartao.preset || "personalizado";
                        const maxP = pc.cartao.max_parcelas;
                        const taxas = pc.cartao.taxas || {};
                        const setPreset = (p: CartaoPreset) => {
                          const novasTaxas = p === "personalizado" ? { ...taxas } : taxasDoPreset(p, maxP);
                          setCartao({ preset: p, taxas: novasTaxas });
                        };
                        const setTaxa = (n: number, v: number) => {
                          setCartao({ preset: "personalizado", taxas: { ...taxas, [n]: v } });
                        };
                        return (
                        <div className="mt-3 border rounded-md p-3 bg-muted/20 space-y-3">
                          <div className="flex flex-wrap items-center gap-2 justify-between">
                            <div className="text-xs font-semibold text-muted-foreground">Parcelamento no cartão de crédito</div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Modo</Label>
                              <Select value={modo} onValueChange={(v: CartaoModo) => {
                                if (v === "taxa_por_parcela" && (!pc.cartao.taxas || Object.keys(pc.cartao.taxas).length === 0)) {
                                  setCartao({ modo: v, preset: "nubank_cnpj_atual", taxas: taxasDoPreset("nubank_cnpj_atual", maxP) });
                                } else {
                                  setCartao({ modo: v });
                                }
                              }}>
                                <SelectTrigger className="h-8 w-[220px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="juros_composto">Juros compostos (mensal)</SelectItem>
                                  <SelectItem value="taxa_por_parcela">Taxa por parcela (tabela)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3">
                            <div>
                              <Label className="text-xs">Máximo de parcelas</Label>
                              <Select value={String(maxP)} onValueChange={(v) => {
                                const max = Number(v);
                                const novasTaxas: Record<number, number> = {};
                                for (let n = 1; n <= max; n++) novasTaxas[n] = Number(taxas[n] ?? 0);
                                setCartao({ max_parcelas: max, parcelas_sem_juros: Math.min(pc.cartao.parcelas_sem_juros, max), taxas: novasTaxas });
                              }}>
                                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                                    <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {modo === "juros_composto" ? (
                              <>
                                <div>
                                  <Label className="text-xs">Sem juros até</Label>
                                  <Select value={String(pc.cartao.parcelas_sem_juros)} onValueChange={(v) => setCartao({ parcelas_sem_juros: Number(v) })}>
                                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {Array.from({ length: maxP + 1 }, (_, i) => i).map((n) => (
                                        <SelectItem key={n} value={String(n)}>{n === 0 ? "Nenhuma" : `${n}x`}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">Juros ao mês (%)</Label>
                                  <Input type="number" step="0.01" min={0}
                                    disabled={pc.cartao.parcelas_sem_juros >= maxP}
                                    value={pc.cartao.juros_mensal}
                                    onChange={(e) => setCartao({ juros_mensal: Number(e.target.value) })} />
                                </div>
                              </>
                            ) : (
                              <div className="sm:col-span-2">
                                <Label className="text-xs">Preset de taxas</Label>
                                <Select value={preset} onValueChange={(v: CartaoPreset) => setPreset(v)}>
                                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {(Object.keys(CARTAO_PRESET_LABEL) as CartaoPreset[]).map((p) => (
                                      <SelectItem key={p} value={p}>{CARTAO_PRESET_LABEL[p]}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>

                          {modo === "taxa_por_parcela" && (
                            <div className="border-t pt-2 space-y-2">
                              <div className="text-xs font-semibold text-muted-foreground">Taxas por parcela (%)</div>
                              <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
                                {Array.from({ length: maxP }, (_, i) => i + 1).map((n) => (
                                  <div key={n} className="flex items-center gap-1">
                                    <span className="text-xs w-8 text-right font-medium">{n}x</span>
                                    <Input type="number" step="0.01" min={0} className="h-8 text-xs"
                                      value={taxas[n] ?? 0}
                                      onChange={(e) => setTaxa(n, Number(e.target.value))} />
                                    <span className="text-xs text-muted-foreground">%</span>
                                  </div>
                                ))}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                As taxas podem variar conforme sua conta e devem ser conferidas no app Nubank antes do envio da proposta.
                              </div>
                            </div>
                          )}

                          <div className="border-t pt-2">
                            <div className="text-xs font-semibold text-muted-foreground mb-1">Tabela de parcelas</div>
                            {/* Desktop */}
                            <div className="hidden sm:block max-h-56 overflow-y-auto rounded border">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/40 sticky top-0">
                                  <tr>
                                    <th className="text-left px-2 py-1">Parcela</th>
                                    {modo === "taxa_por_parcela" && <th className="text-right px-2 py-1">Taxa</th>}
                                    <th className="text-right px-2 py-1">Valor</th>
                                    <th className="text-right px-2 py-1">Total</th>
                                    <th className="text-left px-2 py-1">Juros</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {tabela.map((p) => (
                                    <tr key={p.n} className="border-t">
                                      <td className="px-2 py-1">{p.n}x</td>
                                      {modo === "taxa_por_parcela" && <td className="px-2 py-1 text-right">{(p.taxa ?? 0).toFixed(2)}%</td>}
                                      <td className="px-2 py-1 text-right">{formatBRL(p.valor_parcela)}</td>
                                      <td className="px-2 py-1 text-right">{formatBRL(p.total)}</td>
                                      <td className={`px-2 py-1 ${p.tem_juros ? "text-orange-700 dark:text-orange-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                                        {p.tem_juros ? "com juros" : "sem juros"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {/* Mobile cards */}
                            <div className="sm:hidden space-y-1.5">
                              {tabela.map((p) => (
                                <div key={p.n} className={`rounded border px-2 py-1.5 text-xs flex items-center justify-between ${p.tem_juros ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20" : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"}`}>
                                  <div className="font-semibold">{p.n}x{modo === "taxa_por_parcela" && ` · ${(p.taxa ?? 0).toFixed(2)}%`}</div>
                                  <div className="text-right">
                                    <div>{formatBRL(p.valor_parcela)}</div>
                                    <div className="text-[10px] text-muted-foreground">Total {formatBRL(p.total)} {p.tem_juros ? "· c/ juros" : "· s/ juros"}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        );
                      })()}
                    </>
                  );
                })()}
              </div>

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
                        <SelectContent>
                          {catalogo.length === 0 ? (
                            <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                              Nenhum item ativo encontrado no catálogo desta empresa.
                            </div>
                          ) : catalogo.map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.nome}{s.categoria ? ` · ${s.categoria}` : ""} — {formatBRL(s.valor_padrao)}
                            </SelectItem>
                          ))}
                        </SelectContent>
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
        </fieldset>

        {/* Lateral: totais + ações */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader className="pb-2"><CardTitle className="text-base">Totais</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Tipo do desconto comercial</Label>
                  <Select value={form.desconto_tipo} onValueChange={(v: DescontoTipo) => setForm({ ...form, desconto_tipo: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="valor">R$ (valor)</SelectItem>
                      <SelectItem value="percentual">% (percentual)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Desconto comercial</Label>
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
                <div className="flex justify-between text-muted-foreground"><span>Desconto comercial</span><span>- {formatBRL(totais.descontoAplicado)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Impostos</span><span>{formatBRL(totais.impostos)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Taxa</span><span>{formatBRL(totais.taxa)}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total base da proposta</span><span>{formatBRL(totais.total)}</span></div>

              </div>

              <div className="grid gap-2">
                {!isFinalizado && (
                  <Button onClick={() => save()} disabled={saving}><Save className="w-4 h-4 mr-2" />Salvar</Button>
                )}
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

              {!isNew && !isFinalizado && (() => {
                const permitidas = TRANSICOES_PERMITIDAS[form.status as OrcamentoStatus] || [];
                if (permitidas.length === 0) return null;
                return (
                  <div className="border-t pt-2 grid gap-1.5">
                    <div className="text-xs font-semibold text-muted-foreground">Status</div>
                    {permitidas.includes("enviado") && (
                      <Button size="sm" variant="outline" onClick={() => changeStatus("enviado", { enviado_em: new Date().toISOString() })}>
                        <Send className="w-3.5 h-3.5 mr-1" />Marcar enviado
                      </Button>
                    )}
                    {permitidas.includes("visualizado") && (
                      <Button size="sm" variant="outline" onClick={() => changeStatus("visualizado", { visualizado_em: new Date().toISOString() })}>
                        <Eye className="w-3.5 h-3.5 mr-1" />Marcar visualizado
                      </Button>
                    )}
                    {permitidas.includes("aprovado") && (
                      <Button size="sm" variant="outline" onClick={() => changeStatus("aprovado", { aprovado_em: new Date().toISOString() })}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" />Aprovar
                      </Button>
                    )}
                    {permitidas.includes("recusado") && (
                      <Button size="sm" variant="outline" onClick={() => setRecusarOpen(true)}>
                        <XCircle className="w-3.5 h-3.5 mr-1 text-red-600" />Recusar
                      </Button>
                    )}
                    {permitidas.includes("cancelado") && (
                      <Button size="sm" variant="outline" onClick={() => changeStatus("cancelado", { cancelado_em: new Date().toISOString() })}>
                        <Ban className="w-3.5 h-3.5 mr-1" />Cancelar
                      </Button>
                    )}
                  </div>
                );
              })()}
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
