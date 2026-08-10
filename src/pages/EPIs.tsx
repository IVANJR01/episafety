import { useState, useMemo } from "react";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Plus, Pencil, Trash2, Search, Loader2, Download, Package, ChevronDown, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import { useSupabaseCrud } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";

interface EPI {
  id: string; nome: string; ca: string | null; validade: string | null;
  estoque: number; estoque_minimo: number; categoria: string | null;
  descricao: string | null; fabricante: string | null; aprovado_para: string | null;
  valor: number | null; tamanho: string | null;
}

const emptyForm = {
  nome: "", ca: "", validade: "", estoque: 0, estoque_minimo: 5,
  categoria: "", descricao: "", fabricante: "", aprovado_para: "", valor: "" as string | number,
  tamanho: "",
  /** Cadastro em lote: um EPI por tamanho marcado (so em cadastro novo). */
  tamanhos: [] as string[],
  ajuste_tipo: "" as "" | "entrada" | "saida",
  ajuste_quantidade: 0,
  ajuste_motivo: ""
};

/** Atalhos de tamanho. Qualquer outro pode ser digitado no campo livre. */
const TAMANHOS_LETRA = ["PP", "P", "M", "G", "GG", "XG", "XGG"];
const TAMANHOS_NUMERO = ["34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];

/**
 * O cadastro existente usa o tamanho no proprio nome ("FARDAMENTO - GG"), e o
 * resto do sistema (entregas, solicitacoes, fichas) so mostra o nome. Mantem-se
 * essa convencao, sem repetir quando o nome digitado ja termina com o tamanho.
 */
/**
 * Tamanho do registro. Cadastros antigos deixaram o tamanho so no nome
 * ("CALCADO TIPO BOTINA - 44", coluna tamanho vazia) — sem ler o sufixo, esses
 * apareceriam como "ainda nao cadastrados" ao acrescentar tamanhos.
 */
function tamanhoDoRegistro(e: { nome: string; tamanho: string | null }) {
  if (e.tamanho?.trim()) return e.tamanho.trim().toUpperCase();
  const sufixo = e.nome.split(" - ").pop()?.trim().toUpperCase() || "";
  return TAMANHOS_LETRA.includes(sufixo) || TAMANHOS_NUMERO.includes(sufixo) ? sufixo : "";
}

/** Nome sem o sufixo de tamanho, para gerar os nomes dos outros tamanhos. */
function nomeBase(nome: string, tamanho: string) {
  const base = nome.trim();
  const sufixo = base.split(" - ").pop()?.trim() || "";
  const eTamanho = sufixo.toUpperCase() === tamanho.trim().toUpperCase()
    || TAMANHOS_LETRA.includes(sufixo.toUpperCase())
    || TAMANHOS_NUMERO.includes(sufixo.toUpperCase());
  if (!sufixo || !eTamanho) return base;
  return base.slice(0, base.length - sufixo.length).replace(/[\s-]+$/, "");
}

/** Evita "FARDAMENTO - GG (GG)" nas listagens. */
function tamanhoVisivel(e: { nome: string; tamanho: string | null }) {
  if (!e.tamanho) return null;
  return e.nome.trim().toUpperCase().endsWith(e.tamanho.trim().toUpperCase()) ? null : e.tamanho;
}

function nomeComTamanho(nome: string, tamanho: string) {
  const base = nome.trim().replace(/[\s-]+$/, "");
  if (!tamanho) return base;
  if (base.toUpperCase().endsWith(`- ${tamanho.toUpperCase()}`)) return base;
  if (base.toUpperCase().endsWith(tamanho.toUpperCase())) return base;
  return `${base} - ${tamanho}`;
}

export default function EPIs() {
  const { data: epis, loading, add, update, remove, refetch } = useSupabaseCrud<EPI>("epis", "created_at");
  const { canEdit, canCreate, canDelete } = usePermissions("epis");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EPI | null>(null);
  const { form, setForm, resetForm, hasDraft } = useFormDraft("epis", emptyForm);
  const [consultando, setConsultando] = useState(false);
  const [tamanhoLivre, setTamanhoLivre] = useState("");
  const [busca, setBusca] = useState("");
  const { toast } = useToast();

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const episFiltrados = epis.filter(e => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase();
    return e.nome.toLowerCase().includes(termo) || (e.ca && e.ca.toLowerCase().includes(termo));
  });

  const groupedEpis = useMemo(() => {
    const groups: Record<string, {
      key: string;
      nomeBase: string;
      ca: string | null;
      categoria: string | null;
      fabricante: string | null;
      validade: string | null;
      aprovado_para: string | null;
      descricao: string | null;
      estoqueTotal: number;
      estoqueMinimoMax: number;
      valorMin: number | null;
      valorMax: number | null;
      itens: EPI[];
    }> = {};

    episFiltrados.forEach(e => {
      const caKey = e.ca?.trim();
      const tamanho = tamanhoDoRegistro(e);
      const base = nomeBase(e.nome, tamanho);
      const key = caKey ? `ca-${caKey}` : `nome-${base.toLowerCase()}`;

      if (!groups[key]) {
        groups[key] = {
          key,
          nomeBase: base,
          ca: e.ca,
          categoria: e.categoria,
          fabricante: e.fabricante,
          validade: e.validade,
          aprovado_para: e.aprovado_para,
          descricao: e.descricao,
          estoqueTotal: 0,
          estoqueMinimoMax: 0,
          valorMin: null,
          valorMax: null,
          itens: []
        };
      }

      groups[key].estoqueTotal += e.estoque || 0;
      groups[key].estoqueMinimoMax = Math.max(groups[key].estoqueMinimoMax, e.estoque_minimo || 0);
      
      if (e.valor !== null && e.valor !== undefined) {
        const val = Number(e.valor);
        if (groups[key].valorMin === null || val < groups[key].valorMin) groups[key].valorMin = val;
        if (groups[key].valorMax === null || val > groups[key].valorMax) groups[key].valorMax = val;
      }
      
      groups[key].itens.push(e);
    });

    Object.values(groups).forEach(g => {
      g.itens.sort((a, b) => {
        const ta = tamanhoDoRegistro(a);
        const tb = tamanhoDoRegistro(b);
        const na = Number(ta);
        const nb = Number(tb);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return ta.localeCompare(tb);
      });
    });

    const finalGroups = Object.values(groups);
    finalGroups.sort((a, b) => a.nomeBase.localeCompare(b.nomeBase));
    
    return finalGroups;
  }, [episFiltrados]);

  /** Tamanhos que este CA ja tem — marcados como cadastrados e nunca duplicados. */
  const tamanhosJaCadastrados = (() => {
    const caAtual = form.ca.trim();
    if (!caAtual) return [] as string[];
    // Inclui o proprio registro em edicao: o tamanho dele ja existe e nao pode
    // ser criado de novo pela lista de "adicionar outros tamanhos".
    const doCa = epis.filter(e => (e.ca || "").trim() === caAtual).map(tamanhoDoRegistro);
    const doForm = editing && form.tamanho.trim() ? [form.tamanho.trim().toUpperCase()] : [];
    return [...doCa, ...doForm].filter(Boolean);
  })();


  const openNew = () => { setEditing(null); if (!hasDraft()) resetForm(); setOpen(true); };
  const openEdit = (e: EPI) => {
    setEditing(e);
    resetForm({
      nome: e.nome, ca: e.ca || "", validade: e.validade || "",
      estoque: e.estoque, estoque_minimo: e.estoque_minimo,
      categoria: e.categoria || "", descricao: e.descricao || "",
      fabricante: e.fabricante || "", aprovado_para: e.aprovado_para || "",
      valor: e.valor !== null && e.valor !== undefined ? String(e.valor) : "", tamanho: e.tamanho || "", tamanhos: [],
      ajuste_tipo: "", ajuste_quantidade: 0, ajuste_motivo: ""
    });
    setOpen(true);
  };

  const consultarCA = async () => {
    if (!form.ca.trim()) {
      toast({ title: "Informe o nº do CA", variant: "destructive" });
      return;
    }
    setConsultando(true);
    try {
      const { data, error } = await supabase.functions.invoke("consulta-ca", {
        body: { ca: form.ca.trim() }
      });
      if (error) throw error;
      if (data?.success && data.data) {
        const d = data.data;
        setForm(prev => ({
          ...prev,
          nome: d.nome || prev.nome,
          categoria: d.categoria || prev.categoria,
          validade: d.validade || prev.validade,
          descricao: d.descricao || prev.descricao,
          fabricante: d.fabricante || prev.fabricante,
          aprovado_para: d.aprovado_para || prev.aprovado_para,
        }));
        toast({ title: "CA encontrado!", description: `${d.nome || "EPI"} - ${d.situacao || ""}` });
      } else {
        toast({ title: "CA não encontrado", description: data?.error || "Verifique o número e tente novamente", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro na consulta", description: err.message || "Falha ao consultar CA", variant: "destructive" });
    } finally {
      setConsultando(false);
    }
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    
    // Calculate stock adjustment
    let estoqueAjustado = form.estoque;
    if (editing && form.ajuste_tipo && form.ajuste_quantidade > 0) {
      if (form.ajuste_tipo === "entrada") {
        estoqueAjustado = editing.estoque + form.ajuste_quantidade;
      } else if (form.ajuste_tipo === "saida") {
        estoqueAjustado = Math.max(0, editing.estoque - form.ajuste_quantidade);
      }
    }
    
    const data = {
      nome: form.nome, ca: form.ca || null, validade: form.validade || null,
      estoque: estoqueAjustado, estoque_minimo: form.estoque_minimo,
      categoria: form.categoria || null, descricao: form.descricao || null,
      fabricante: form.fabricante || null, aprovado_para: form.aprovado_para || null,
      valor: form.valor === "" ? null : Number(form.valor), tamanho: form.tamanho || null
    };
    if (editing) {
      await update(editing.id, data);
      if (form.ajuste_tipo && form.ajuste_quantidade > 0) {
        toast({ title: `${form.ajuste_tipo === "entrada" ? "Entrada" : "Saída"} registrada`, description: `${form.ajuste_quantidade} unidade(s) ${form.ajuste_tipo === "entrada" ? "adicionada(s) ao" : "removida(s) do"} estoque` });
      }

      // Propagar campos em comum (como valor) para outros tamanhos (irmãos) do mesmo grupo
      const caKey = editing.ca?.trim();
      const editingTamanho = tamanhoDoRegistro(editing);
      const editingBase = nomeBase(editing.nome, editingTamanho);
      
      const irmaos = epis.filter(e => {
        if (e.id === editing.id) return false;
        if (caKey && e.ca?.trim() === caKey) return true;
        if (!caKey && !e.ca?.trim() && nomeBase(e.nome, tamanhoDoRegistro(e)).toLowerCase() === editingBase.toLowerCase()) return true;
        return false;
      });

      if (irmaos.length > 0) {
        const idsIrmaos = irmaos.map(i => i.id);
        const updateDadosGlobais = {
           ca: data.ca, categoria: data.categoria, fabricante: data.fabricante,
           validade: data.validade, descricao: data.descricao, aprovado_para: data.aprovado_para,
           valor: data.valor, estoque_minimo: data.estoque_minimo
        };
        const { error } = await supabase.from("epis").update(updateDadosGlobais).in("id", idsIrmaos);
        if (!error) {
           await refetch();
        }
      }
    }

    // Tamanhos marcados viram um EPI cada, com os mesmos dados — no cadastro
    // novo e tambem ao editar um EPI que ja existe (ali servem para acrescentar
    // os tamanhos que faltam sem redigitar o CA).
    if (form.tamanhos.length > 0) {
      const novos = form.tamanhos.filter(t => !tamanhosJaCadastrados.includes(t.toUpperCase()));
      const repetidos = form.tamanhos.filter(t => tamanhosJaCadastrados.includes(t.toUpperCase()));
      // Ao editar, o nome ja carrega o tamanho do proprio registro ("BOTINA - P");
      // os novos partem do nome sem esse sufixo.
      const base = editing ? nomeBase(form.nome, form.tamanho) : form.nome;

      let criados = 0;
      for (const t of novos) {
        // Estoque e movimentacao pertencem ao registro editado, nao aos novos.
        const ok = await add({ ...data, estoque: editing ? 0 : data.estoque, nome: nomeComTamanho(base, t), tamanho: t });
        if (ok) criados++;
      }
      if (criados === 0 && repetidos.length > 0) {
        toast({ title: "Nada a cadastrar", description: `Esse CA já tem ${repetidos.join(", ")} cadastrado(s).`, variant: "destructive" });
        return;
      }
      toast({
        title: `${criados} tamanho(s) cadastrado(s)`,
        description: repetidos.length
          ? `Já existentes neste CA foram ignorados: ${repetidos.join(", ")}.`
          : `Tamanhos: ${novos.join(", ")}`
      });
    } else if (!editing) {
      await add(data);
    }
    resetForm();
    setOpen(false);
  };

  const toggleTamanho = (t: string) => {
    setForm(prev => ({
      ...prev,
      tamanhos: prev.tamanhos.includes(t) ? prev.tamanhos.filter(x => x !== t) : [...prev.tamanhos, t]
    }));
  };

  const addTamanhoLivre = () => {
    const t = tamanhoLivre.trim().toUpperCase();
    if (!t) return;
    setForm(prev => ({ ...prev, tamanhos: prev.tamanhos.includes(t) ? prev.tamanhos : [...prev.tamanhos, t] }));
    setTamanhoLivre("");
  };

  const exportarExcel = () => {
    const dados = epis.map(e => ({
      "Nome": e.nome, "CA": e.ca || "", "Categoria": e.categoria || "",
      "Fabricante": e.fabricante || "", "Validade CA": e.validade || "",
      "Aprovado Para": e.aprovado_para || "",
      "Valor Unitário (R$)": e.valor ? Number(e.valor).toFixed(2) : "0.00",
      "Estoque Atual": e.estoque, "Estoque Mínimo": e.estoque_minimo,
      "Valor Total Estoque (R$)": ((e.valor || 0) * e.estoque).toFixed(2),
      "Status": e.estoque <= e.estoque_minimo ? "BAIXO" : "OK",
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    ws["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque EPIs");
    XLSX.writeFile(wb, `Relatorio_Estoque_EPIs_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "Relatório exportado com sucesso!" });
  };

  const sincronizarEpisAntigos = async () => {
    setConsultando(true);
    try {
      let atualizados = 0;
      for (const g of groupedEpis) {
        if (g.itens.length <= 1) continue; // Grupo com 1 item já está ok
        
        // Pega os melhores dados do grupo para servir de base
        const valorPadrao = g.valorMax || g.valorMin || null;
        const estoqueMinimoBase = g.estoqueMinimoMax || 5;
        
        const updateDadosGlobais = {
           ca: g.ca, categoria: g.categoria, fabricante: g.fabricante,
           validade: g.validade, descricao: g.descricao, aprovado_para: g.aprovado_para,
           valor: valorPadrao, estoque_minimo: estoqueMinimoBase
        };

        const ids = g.itens.map(i => i.id);
        const { error } = await supabase.from("epis").update(updateDadosGlobais).in("id", ids);
        if (!error) atualizados += ids.length;
      }
      toast({ title: "Sincronização concluída", description: `${atualizados} registros atualizados.` });
      refetch();
    } catch (err: any) {
      toast({ title: "Erro na sincronização", variant: "destructive" });
    } finally {
      setConsultando(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Cadastro de EPIs"
        subtitle="Gerenciar equipamentos de proteção"
        actions={
          <>
            {canEdit && (
              <Button variant="outline" onClick={sincronizarEpisAntigos} disabled={consultando} className="text-xs sm:text-sm">
                {consultando ? <Loader2 className="w-4 h-4 mr-1 sm:mr-2 animate-spin" /> : <Loader2 className="w-4 h-4 mr-1 sm:mr-2" />} Sincronizar Antigos
              </Button>
            )}
            <Button variant="outline" onClick={exportarExcel} disabled={epis.length === 0} className="text-xs sm:text-sm">
              <Download className="w-4 h-4 mr-1 sm:mr-2" />Exportar
            </Button>
            {canCreate && (
              <Button onClick={openNew} className="text-xs sm:text-sm">
                <Plus className="w-4 h-4 mr-1 sm:mr-2" />Novo EPI
              </Button>
            )}
          </>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou CA..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="space-y-3 lg:hidden">
            {groupedEpis.length === 0 ? (
              <EmptyState
                icon={Package}
                title={busca ? "Nenhum EPI encontrado" : "Nenhum EPI cadastrado"}
                description={busca ? "Tente ajustar sua busca ou limpar o filtro." : "Clique em Novo EPI para começar."}
                action={!busca && canCreate ? (
                  <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo EPI</Button>
                ) : undefined}
              />
            ) : groupedEpis.map(g => {
              const isExpanded = expandedGroups[g.key];
              const hasMultiple = g.itens.length > 1;
              const zerado = g.estoqueTotal === 0;
              const baixo = !zerado && g.estoqueTotal <= g.estoqueMinimoMax;
              
              const statusBadge = zerado
                ? <StatusBadge tone="danger" size="sm">Zerado</StatusBadge>
                : baixo
                  ? <StatusBadge tone="warning" size="sm">Baixo</StatusBadge>
                  : <StatusBadge tone="success" size="sm">OK</StatusBadge>;

              const valorFormatado = g.valorMin === null
                ? "—"
                : g.valorMin === g.valorMax
                  ? `R$ ${g.valorMin.toFixed(2)}`
                  : `R$ ${g.valorMin.toFixed(2)} - R$ ${g.valorMax.toFixed(2)}`;

              return (
                <Card key={g.key} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${zerado ? "bg-destructive/10" : baixo ? "bg-amber-100 dark:bg-amber-900/30" : "bg-primary/10"}`}>
                          <Package className={`w-5 h-5 ${zerado ? "text-destructive" : baixo ? "text-amber-600" : "text-primary"}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm leading-tight">
                              {g.nomeBase}
                              {!hasMultiple && g.itens[0]?.tamanho && (
                                <span className="ml-1 text-[10px] text-muted-foreground font-normal">({g.itens[0].tamanho})</span>
                              )}
                            </p>
                            {statusBadge}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {g.ca && <span className="text-[11px] font-mono text-muted-foreground">CA: {g.ca}</span>}
                            {g.categoria && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{g.categoria}</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {hasMultiple ? (
                          <Button size="icon" variant="outline" className="h-11 w-11" onClick={() => toggleGroup(g.key)}>
                            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                          </Button>
                        ) : (
                          <>
                            {canEdit && <Button size="icon" variant="outline" className="h-11 w-11" aria-label="Editar" onClick={() => openEdit(g.itens[0])}><Pencil className="w-5 h-5" /></Button>}
                            {canDelete && <Button size="icon" variant="outline" className="h-11 w-11" aria-label="Excluir" onClick={() => remove(g.itens[0].id)}><Trash2 className="w-5 h-5 text-destructive" /></Button>}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-muted/40 px-2 py-1.5">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Estoque total</div>
                        <div className={`font-mono font-semibold text-sm ${zerado ? "text-destructive" : baixo ? "text-amber-600" : ""}`}>
                          {g.estoqueTotal} <span className="text-[10px] text-muted-foreground font-normal">/ mín {g.estoqueMinimoMax}</span>
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/40 px-2 py-1.5">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Valor unitário</div>
                        <div className="font-mono text-sm">{valorFormatado}</div>
                      </div>
                      {g.validade && (
                        <div className="rounded-md bg-muted/40 px-2 py-1.5 col-span-2">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide mr-2">Validade CA:</span>
                          <span className="font-mono text-sm font-semibold">{g.validade}</span>
                        </div>
                      )}
                    </div>

                    {hasMultiple && isExpanded && (
                      <div className="pt-2 border-t space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground">Tamanhos disponíveis:</p>
                        <div className="space-y-1.5">
                          {g.itens.map(e => (
                            <div key={e.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-xs">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-bold">{tamanhoDoRegistro(e) || "Sem tamanho"}</Badge>
                                <span className="text-muted-foreground">Estoque: <b>{e.estoque}</b></span>
                                {e.valor ? <span className="text-muted-foreground font-mono">| R$ {Number(e.valor).toFixed(2)}</span> : null}
                              </div>
                              <div className="flex gap-1">
                                {canEdit && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>}
                                {canDelete && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(e.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop table */}
          <Card className="hidden lg:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CA</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Fabricante</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedEpis.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">{busca ? "Nenhum EPI encontrado" : "Nenhum EPI cadastrado"}</TableCell></TableRow>
                  ) : groupedEpis.map(g => {
                    const isExpanded = expandedGroups[g.key];
                    const hasMultiple = g.itens.length > 1;
                    const zerado = g.estoqueTotal === 0;
                    const baixo = !zerado && g.estoqueTotal <= g.estoqueMinimoMax;
                    
                    const valorFormatado = g.valorMin === null
                      ? "—"
                      : g.valorMin === g.valorMax
                        ? `R$ ${g.valorMin.toFixed(2)}`
                        : `R$ ${g.valorMin.toFixed(2)} - R$ ${g.valorMax.toFixed(2)}`;

                    return (
                      <>
                        <TableRow key={g.key} className="hover:bg-muted/30 cursor-pointer" onClick={() => hasMultiple && toggleGroup(g.key)}>
                          <TableCell className="text-center">
                            {hasMultiple && (
                              <span className="text-muted-foreground hover:text-foreground">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            <span>{g.nomeBase}</span>
                            {hasMultiple && (
                              <span className="ml-2 text-xs text-muted-foreground font-normal">
                                ({g.itens.length} tamanhos)
                              </span>
                            )}
                            {!hasMultiple && g.itens[0]?.tamanho && (
                              <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">{g.itens[0].tamanho}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{g.ca || "—"}</TableCell>
                          <TableCell><Badge variant="secondary">{g.categoria || "—"}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{g.fabricante || "—"}</TableCell>
                          <TableCell>{g.validade || "—"}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{valorFormatado}</TableCell>
                          <TableCell className="text-right">
                            <span className={baixo ? "text-destructive font-semibold" : ""}>{g.estoqueTotal}</span>
                          </TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            {!hasMultiple ? (
                              <div className="flex gap-1 justify-end">
                                {canEdit && <Button size="icon" variant="ghost" onClick={() => openEdit(g.itens[0])}><Pencil className="w-3.5 h-3.5" /></Button>}
                                {canDelete && <Button size="icon" variant="ghost" onClick={() => remove(g.itens[0].id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
                              </div>
                            ) : null}
                          </TableCell>
                        </TableRow>

                        {/* Linhas filhas (tamanhos específicos) */}
                        {hasMultiple && isExpanded && g.itens.map(e => (
                          <TableRow key={e.id} className="bg-muted/20 border-l-2 border-primary">
                            <TableCell></TableCell>
                            <TableCell className="pl-6 text-xs text-muted-foreground flex items-center gap-2">
                              <span>Tamanho:</span>
                              <Badge variant="outline" className="text-[10px] px-1 py-0 font-semibold">{tamanhoDoRegistro(e) || "Sem tamanho"}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">—</TableCell>
                            <TableCell>—</TableCell>
                            <TableCell>—</TableCell>
                            <TableCell>—</TableCell>
                            <TableCell className="text-right font-mono text-xs">{e.valor ? `R$ ${Number(e.valor).toFixed(2)}` : "—"}</TableCell>
                            <TableCell className="text-right">
                              <span className={e.estoque <= e.estoque_minimo ? "text-destructive font-semibold" : ""}>{e.estoque}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 justify-end">
                                {canEdit && <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>}
                                {canDelete && <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar EPI" : "Novo EPI"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Nº do CA</Label>
              <div className="flex gap-2">
                <Input value={form.ca} onChange={e => setForm({...form, ca: e.target.value})} placeholder="Ex: 37536" className="flex-1" />
                <Button type="button" variant="secondary" onClick={consultarCA} disabled={consultando || !form.ca.trim()}>
                  {consultando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span className="ml-2 hidden sm:inline">Consultar</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Insira o CA e clique em Consultar para preencher automaticamente</p>
            </div>
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Capacete de Segurança" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Categoria</Label><Input value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} placeholder="Ex: Cabeça" /></div>
              <div><Label>Validade do CA</Label><Input type="date" value={form.validade} onChange={e => setForm({...form, validade: e.target.value})} /></div>
            </div>
            {editing && (
              <div><Label>Tamanho deste EPI</Label><Input value={form.tamanho} onChange={e => setForm({...form, tamanho: e.target.value})} placeholder="Ex: P, M, G, GG, 38, 42..." /></div>
            )}
            {(
              <div className="border rounded-lg p-3 space-y-3">
                <div>
                  <Label>{editing ? "Adicionar outros tamanhos deste CA" : "Tamanhos"}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {editing
                      ? "Marque os tamanhos que faltam. Cada um vira um EPI novo com estes mesmos dados — sem redigitar o CA."
                      : "Marque todos os tamanhos deste CA. É cadastrado um EPI por tamanho, com os mesmos dados — não precisa repetir o CA."}
                  </p>
                </div>
                <div className="space-y-2">
                  {[TAMANHOS_LETRA, TAMANHOS_NUMERO].map((grupo, gi) => (
                    <div key={gi} className="flex flex-wrap gap-1.5">
                      {grupo.map(t => {
                        const jaTem = tamanhosJaCadastrados.includes(t);
                        return (
                          <Button key={t} type="button" size="sm" className="h-8 px-3" disabled={jaTem}
                            title={jaTem ? "Já cadastrado neste CA" : undefined}
                            variant={form.tamanhos.includes(t) ? "default" : "outline"}
                            onClick={() => toggleTamanho(t)}>
                            {t}{jaTem && <span className="ml-1 text-[10px]">✓</span>}
                          </Button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {tamanhosJaCadastrados.length > 0 && (
                  <p className="text-xs text-muted-foreground">✓ = já cadastrado neste CA.</p>
                )}
                <div className="flex gap-2">
                  <Input value={tamanhoLivre} onChange={e => setTamanhoLivre(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTamanhoLivre(); } }}
                    placeholder="Outro tamanho (ex: 48, XXG)" className="flex-1 h-9" />
                  <Button type="button" variant="secondary" size="sm" className="h-9" onClick={addTamanhoLivre} disabled={!tamanhoLivre.trim()}>Adicionar</Button>
                </div>
                {form.tamanhos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t">
                    <span className="text-xs text-muted-foreground">{editing ? "Vai criar" : "Vai cadastrar"} {form.tamanhos.length}:</span>
                    {form.tamanhos.map(t => (
                      <Badge key={t} variant="secondary" className="gap-1 pr-1">
                        {t}
                        <button type="button" aria-label={`Remover ${t}`} className="hover:text-destructive" onClick={() => toggleTamanho(t)}>×</button>
                      </Badge>
                    ))}
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={() => setForm(prev => ({ ...prev, tamanhos: [] }))}>Limpar</Button>
                  </div>
                )}
                {!editing && <p className="text-xs text-muted-foreground">Sem nenhum marcado, cadastra um único EPI sem tamanho.</p>}
              </div>
            )}
            <div><Label>Fabricante</Label><Input value={form.fabricante} onChange={e => setForm({...form, fabricante: e.target.value})} placeholder="Preenchido automaticamente pela consulta" /></div>
            <div><Label>Aprovado Para</Label><Textarea value={form.aprovado_para} onChange={e => setForm({...form, aprovado_para: e.target.value})} placeholder="Proteção contra..." rows={2} /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Descrição técnica do EPI" rows={3} /></div>
            <div><Label>Valor Unitário (R$)</Label><Input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} placeholder="0.00" /></div>
            {editing && (
              <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
                <Label className="text-sm font-semibold">Movimentação de Estoque</Label>
                <p className="text-xs text-muted-foreground">Estoque atual: <span className="font-mono font-bold">{editing.estoque}</span> unidades</p>
                <div className="flex gap-2">
                  <Button type="button" variant={form.ajuste_tipo === "entrada" ? "default" : "outline"} size="sm" className="flex-1"
                    onClick={() => setForm(prev => ({ ...prev, ajuste_tipo: prev.ajuste_tipo === "entrada" ? "" : "entrada", ajuste_quantidade: prev.ajuste_tipo === "entrada" ? 0 : prev.ajuste_quantidade }))}>
                    + Entrada
                  </Button>
                  <Button type="button" variant={form.ajuste_tipo === "saida" ? "destructive" : "outline"} size="sm" className="flex-1"
                    onClick={() => setForm(prev => ({ ...prev, ajuste_tipo: prev.ajuste_tipo === "saida" ? "" : "saida", ajuste_quantidade: prev.ajuste_tipo === "saida" ? 0 : prev.ajuste_quantidade }))}>
                    - Saída
                  </Button>
                </div>
                {form.ajuste_tipo && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Quantidade</Label>
                      <Input type="number" min="1" value={form.ajuste_quantidade || ""} onChange={e => setForm(prev => ({ ...prev, ajuste_quantidade: Number(e.target.value) }))} placeholder="Qtd" />
                    </div>
                    <div>
                      <Label className="text-xs">Motivo</Label>
                      <Input value={form.ajuste_motivo} onChange={e => setForm(prev => ({ ...prev, ajuste_motivo: e.target.value }))} placeholder={form.ajuste_tipo === "entrada" ? "Ex: Compra" : "Ex: Descarte"} />
                    </div>
                    {form.ajuste_quantidade > 0 && (
                      <p className="col-span-2 text-xs font-medium">
                        Novo estoque: <span className="font-mono">{form.ajuste_tipo === "entrada" ? editing.estoque + form.ajuste_quantidade : Math.max(0, editing.estoque - form.ajuste_quantidade)}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estoque {editing ? "(manual)" : ""}</Label>
                <Input type="number" value={form.estoque} onChange={e => setForm({...form, estoque: Number(e.target.value)})} disabled={!!editing && !!form.ajuste_tipo} />
                {!editing && form.tamanhos.length > 1 && <p className="text-[11px] text-muted-foreground mt-1">Aplicado a cada tamanho.</p>}
              </div>
              <div><Label>Estoque Mín.</Label><Input type="number" value={form.estoque_minimo} onChange={e => setForm({...form, estoque_minimo: Number(e.target.value)})} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>
              {editing
                ? form.tamanhos.length > 0 ? `Salvar e criar ${form.tamanhos.length} tamanho(s)` : "Salvar"
                : form.tamanhos.length > 1 ? `Cadastrar ${form.tamanhos.length} tamanhos` : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
