import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Search, Settings2, Loader2, Info, Globe, Building2, Trash2, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { separarValidade, unirValidade, type UnidadeDeValidade } from "@/lib/arquivoDigital";

const TABELA_AUSENTE = new Set(["42P01", "PGRST205", "PGRST202"]);
const ehTabelaAusente = (e: any) =>
  !!e && (TABELA_AUSENTE.has(e.code) || /does not exist|schema cache/i.test(e.message || ""));

const CATEGORIAS = [
  { valor: "capacitacao", rotulo: "Capacitação" },
  { valor: "saude", rotulo: "Saúde ocupacional" },
  { valor: "pessoal", rotulo: "Documento pessoal" },
  { valor: "equipamento", rotulo: "Equipamento / EPI" },
  { valor: "veiculo", rotulo: "Veículo" },
  { valor: "empresa", rotulo: "Empresa" },
];

interface Tipo {
  id: string; nome: string; categoria: string; validade_meses: number | null; validade_dias: number | null;
  empresa_id: string | null; ativo: boolean;
}
interface Requisito { id: string; tipo_documento_id: string; cargo: string | null; obrigatorio: boolean }

/**
 * Configuração de Tipos de Documentos.
 *
 * Duas coisas moram aqui: o catálogo de tipos e — mais importante — QUEM
 * precisa de cada um. Sem o requisito por função, o dossiê não tem como
 * distinguir "faltou enviar" de "não se aplica", e passaria a cobrar
 * NR-35 de quem trabalha sentado.
 */
export default function ConfiguracaoTiposDocumento() {
  const { empresaId, user } = useAuth();
  const perms = usePermissions("arquivo_digital");

  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [requisitos, setRequisitos] = useState<Requisito[]>([]);
  const [cargos, setCargos] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [indisponivel, setIndisponivel] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [novoAberto, setNovoAberto] = useState(false);
  const [novo, setNovo] = useState({ nome: "", categoria: "capacitacao", validade: "", unidade: "meses" as "meses" | "dias" });
  const [salvando, setSalvando] = useState(false);

  /*
   * Só os tipos da própria empresa entram em edição. Os do catálogo
   * compartilhado valem para todo mundo, e alterar a validade de um deles
   * mudaria o vencimento dos documentos de outras empresas — é a mesma razão
   * pela qual eles já não podiam ser excluídos.
   */
  const [edicao, setEdicao] = useState<
    { id: string; nome: string; categoria: string; validade: string; unidade: UnidadeDeValidade } | null
  >(null);

  const abrirEdicao = (t: Tipo) => {
    const { valor, unidade } = unirValidade(t);
    setEdicao({ id: t.id, nome: t.nome, categoria: t.categoria, validade: valor, unidade });
  };

  const salvarEdicao = async () => {
    if (!edicao) return;
    if (!edicao.nome.trim()) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
    setSalvando(true);
    try {
      const { meses, dias } = separarValidade(edicao.validade, edicao.unidade);
      const { error } = await (supabase.from as any)("internal_document_types")
        .update({ nome: edicao.nome.trim(), categoria: edicao.categoria, validade_meses: meses, validade_dias: dias })
        .eq("id", edicao.id);
      if (error) throw error;
      /*
       * O prazo novo vale das próximas versões em diante. Os documentos já
       * enviados guardam a data que foi calculada na hora do envio, e é assim
       * que tem que ser: mudar o tipo hoje não pode reescrever o vencimento
       * de um ASO que já circulou com outra data impressa.
       */
      toast({
        title: "Tipo atualizado",
        description: "O prazo novo vale para os próximos envios. Documentos já enviados mantêm o vencimento que receberam.",
      });
      setEdicao(null);
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    } finally { setSalvando(false); }
  };

  const [editando, setEditando] = useState<Tipo | null>(null);
  const [exigeTodos, setExigeTodos] = useState(false);
  const [cargosSel, setCargosSel] = useState<string[]>([]);

  const carregar = async () => {
    setCarregando(true);
    const { data, error } = await (supabase.from as any)("internal_document_types")
      .select("id, nome, categoria, validade_meses, validade_dias, empresa_id, ativo")
      .eq("ativo", true).order("nome");
    if (error) { if (ehTabelaAusente(error)) setIndisponivel(true); setCarregando(false); return; }
    setTipos((data || []) as Tipo[]);
    if (empresaId) {
      const { data: reqs } = await (supabase.from as any)("internal_document_requirements")
        .select("id, tipo_documento_id, cargo, obrigatorio").eq("empresa_id", empresaId);
      setRequisitos(reqs || []);
    }
    setCarregando(false);
  };

  useEffect(() => { void carregar(); }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;
    supabase.from("funcionarios").select("cargo").eq("empresa_id", empresaId).then(({ data }) => {
      const unicos = [...new Set((data || []).map((f: any) => f.cargo).filter(Boolean))] as string[];
      setCargos(unicos.sort((a, b) => a.localeCompare(b)));
    });
  }, [empresaId]);

  const reqsPorTipo = useMemo(() => {
    const m = new Map<string, Requisito[]>();
    requisitos.forEach((r) => {
      const l = m.get(r.tipo_documento_id) || [];
      l.push(r);
      m.set(r.tipo_documento_id, l);
    });
    return m;
  }, [requisitos]);

  const listados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return tipos.filter((t) => !b || t.nome.toLowerCase().includes(b));
  }, [tipos, busca]);

  const criarTipo = async () => {
    if (!novo.nome.trim()) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
    if (!empresaId) return;
    setSalvando(true);
    try {
      const { meses, dias } = separarValidade(novo.validade, novo.unidade);
      const { error } = await (supabase.from as any)("internal_document_types").insert({
        empresa_id: empresaId, nome: novo.nome.trim(), categoria: novo.categoria,
        validade_meses: meses, validade_dias: dias, created_by: user?.id,
      });
      if (error) throw error;
      toast({ title: "Tipo criado" });
      setNovoAberto(false);
      setNovo({ nome: "", categoria: "capacitacao", validade: "", unidade: "meses" });
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro ao criar tipo", description: e?.message, variant: "destructive" });
    } finally { setSalvando(false); }
  };

  const excluirTipo = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este tipo de documento?")) return;
    setSalvando(true);
    try {
      const { error } = await (supabase.from as any)("internal_document_types")
        .update({ ativo: false })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Tipo excluído" });
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e?.message, variant: "destructive" });
    } finally { setSalvando(false); }
  };

  const abrirRequisitos = (t: Tipo) => {
    const atuais = reqsPorTipo.get(t.id) || [];
    setEditando(t);
    setExigeTodos(atuais.some((r) => !r.cargo));
    setCargosSel(atuais.filter((r) => r.cargo).map((r) => r.cargo!) as string[]);
  };

  const salvarRequisitos = async () => {
    if (!editando || !empresaId) return;
    setSalvando(true);
    try {
      // Troca o conjunto inteiro: apaga os do tipo e regrava o que ficou
      // marcado. Requisito é configuração, não histórico — não há prova a
      // preservar aqui, ao contrário do documento em si.
      await (supabase.from as any)("internal_document_requirements")
        .delete().eq("empresa_id", empresaId).eq("tipo_documento_id", editando.id);

      const novos = exigeTodos
        ? [{ empresa_id: empresaId, tipo_documento_id: editando.id, cargo: null, obrigatorio: true, created_by: user?.id }]
        : cargosSel.map((c) => ({
            empresa_id: empresaId, tipo_documento_id: editando.id, cargo: c,
            obrigatorio: true, created_by: user?.id,
          }));

      if (novos.length) {
        const { error } = await (supabase.from as any)("internal_document_requirements").insert(novos);
        if (error) throw error;
      }
      toast({ title: "Requisitos salvos" });
      setEditando(null);
      await carregar();
    } catch (e: any) {
      toast({ title: "Erro ao salvar requisitos", description: e?.message, variant: "destructive" });
    } finally { setSalvando(false); }
  };

  /**
   * Como a exigência aparece na lista.
   *
   * Antes toda linha trazia um selo, inclusive as vinte que dizem "Ninguém
   * (não aplicável)" — vinte selos disputando atenção para informar que não
   * há nada a ver ali. O que precisa saltar é onde HÁ exigência; a ausência
   * dela é um traço discreto.
   */
  const exigencia = (t: Tipo): { texto: string; destaque: boolean; dica: string } => {
    const atuais = reqsPorTipo.get(t.id) || [];
    if (atuais.some((r) => !r.cargo)) {
      return { texto: "Todos os colaboradores", destaque: true, dica: "Exigido de todo o quadro" };
    }
    if (atuais.length === 0) {
      return { texto: "—", destaque: false, dica: "Nenhuma função exige este documento" };
    }
    return {
      texto: `${atuais.length} ${atuais.length === 1 ? "função" : "funções"}`,
      destaque: true,
      dica: "Exigido apenas das funções configuradas",
    };
  };

  const rotuloCategoria = (t: Tipo) =>
    CATEGORIAS.find((c) => c.valor === t.categoria)?.rotulo || t.categoria;

  /** "Permanente" não é prazo: fica discreto, para o prazo real saltar. */
  const rotuloValidade = (t: Tipo) => {
    if (t.validade_dias) return <span className="tabular-nums">{t.validade_dias} dias</span>;
    if (t.validade_meses) return <span className="tabular-nums">{t.validade_meses} meses</span>;
    return <span className="text-muted-foreground">Permanente</span>;
  };

  /*
   * Ações com a mesma largura em toda linha.
   *
   * Tipo do catálogo compartilhado não tem editar nem excluir, e a fila
   * encolhia: "Requisitos" saltava para a direita numa linha e para a
   * esquerda na outra, o que fazia a coluna inteira parecer desalinhada.
   * Aqui os dois espaços continuam reservados quando não há botão.
   */
  const Acoes = ({ tipo }: { tipo: Tipo }) => (
    <div className="flex items-center justify-end gap-1">
      <Button size="sm" variant="outline" className="h-8" onClick={() => abrirRequisitos(tipo)}>
        <Settings2 className="mr-1.5 h-3.5 w-3.5" />Requisitos
      </Button>
      {tipo.empresa_id ? (
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar" title="Editar"
          onClick={() => abrirEdicao(tipo)}>
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </Button>
      ) : <span className="h-8 w-8" aria-hidden />}
      {tipo.empresa_id ? (
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label="Excluir" title="Excluir" onClick={() => excluirTipo(tipo.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : <span className="h-8 w-8" aria-hidden />}
    </div>
  );

  if (!perms.canView) return null;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {indisponivel && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            O Arquivo Digital ainda não foi ativado neste banco (migrations pendentes).
          </CardContent>
        </Card>
      )}

      {/*
        A legenda saiu do meio da frase.
        O ícone do globo era desenhado dentro do texto corrido — "Tipo marcado
        com [globo] é do catálogo" —, e a quebra de linha separava "com" do
        símbolo, deixando a frase truncada na tela. Legenda é lista, não
        parágrafo.
      */}
      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
          Como ler esta lista
        </p>
        <ul className="mt-2 space-y-1.5 text-muted-foreground">
          <li className="flex items-start gap-2">
            <Globe className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b className="font-medium text-foreground">Catálogo compartilhado.</b> Vale para todas
              as empresas e não pode ser editado aqui.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b className="font-medium text-foreground">Tipo da sua empresa.</b> Só existe aqui, e
              você edita ou exclui.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Settings2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b className="font-medium text-foreground">Requisitos são sempre seus.</b> Quem precisa
              entregar cada documento é configuração da sua empresa, inclusive nos tipos
              compartilhados.
            </span>
          </li>
        </ul>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar tipo de documento…" className="pl-8" />
            </div>
            {perms.canEdit && (
              <Button onClick={() => setNovoAberto(true)} className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" />Novo tipo</Button>
            )}
          </div>

          {/*
            Uma linha por tipo, e a mesma informação em cartão no celular — a
            tabela de cinco colunas não cabe em 390 px sem rolagem lateral,
            e rolagem lateral em tela de configuração faz perder a coluna de
            ações justamente quem só tem o celular à mão.
          */}
          <div className="hidden rounded-lg border sm:block">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-11 min-w-[260px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Tipo
                  </TableHead>
                  <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Categoria
                  </TableHead>
                  <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Validade
                  </TableHead>
                  <TableHead className="h-11 min-w-[160px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Exigido de
                  </TableHead>
                  <TableHead className="h-11 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregando && (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Carregando…</TableCell></TableRow>
                )}
                {!carregando && listados.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Nenhum tipo cadastrado.
                  </TableCell></TableRow>
                )}
                {listados.map((t) => {
                  const ex = exigencia(t);
                  return (
                    <TableRow key={t.id} className="hover:bg-muted/40">
                      <TableCell className="py-3">
                        <div className="flex items-start gap-2">
                          {t.empresa_id
                            ? <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Tipo da sua empresa" />
                            : <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Catálogo compartilhado" />}
                          <span className="font-medium leading-snug text-foreground">{t.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3 text-muted-foreground">{rotuloCategoria(t)}</TableCell>
                      <TableCell className="py-3">{rotuloValidade(t)}</TableCell>
                      <TableCell className="py-3">
                        {ex.destaque
                          ? <Badge variant="outline" className="whitespace-nowrap font-normal" title={ex.dica}>{ex.texto}</Badge>
                          : <span className="text-muted-foreground" title={ex.dica}>{ex.texto}</span>}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        {perms.canEdit && <Acoes tipo={t} />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2 sm:hidden">
            {carregando && <p className="py-8 text-center text-muted-foreground">Carregando…</p>}
            {!carregando && listados.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">Nenhum tipo cadastrado.</p>
            )}
            {listados.map((t) => {
              const ex = exigencia(t);
              return (
                <div key={t.id} className="rounded-lg border p-3">
                  <div className="flex items-start gap-2">
                    {t.empresa_id
                      ? <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Tipo da sua empresa" />
                      : <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Catálogo compartilhado" />}
                    <span className="font-medium leading-snug">{t.nome}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Categoria</dt>
                      <dd>{rotuloCategoria(t)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Validade</dt>
                      <dd>{rotuloValidade(t)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Exigido de</dt>
                      <dd>{ex.destaque ? ex.texto : "Nenhuma função"}</dd>
                    </div>
                  </dl>
                  {perms.canEdit && <div className="mt-3 flex justify-end"><Acoes tipo={t} /></div>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Novo tipo ── */}
      <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo tipo de documento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                placeholder="Ex.: Termo de Confidencialidade" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={novo.categoria} onValueChange={(v) => setNovo({ ...novo, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => <SelectItem key={c.valor} value={c.valor}>{c.rotulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Validade</Label>
              {/*
                * Meses ou dias, à escolha. Só meses não representava prazo de
                * ASO fora do anual — 90 ou 120 dias, conforme o risco e o
                * tipo de exame —, e quem precisava deles tinha que corrigir a
                * data em cada anexo. Quem esquecesse gravava um vencimento
                * errado, e nada avisava.
                */}
              <div className="mt-1 flex gap-2">
                <Input type="number" min={0} value={novo.validade} className="flex-1"
                  onChange={(e) => setNovo({ ...novo, validade: e.target.value })}
                  placeholder="Vazio = permanente" />
                <Select value={novo.unidade}
                  onValueChange={(v) => setNovo({ ...novo, unidade: v as "meses" | "dias" })}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meses">meses</SelectItem>
                    <SelectItem value="dias">dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoAberto(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={criarTipo} disabled={salvando}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Editar tipo ── */}
      <Dialog open={!!edicao} onOpenChange={(v) => { if (!v) setEdicao(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar tipo de documento</DialogTitle>
            <DialogDescription>
              O prazo novo vale para os próximos envios. Documentos já enviados mantêm o
              vencimento que receberam quando foram anexados.
            </DialogDescription>
          </DialogHeader>
          {edicao && (
            <div className="space-y-3 py-2">
              <div>
                <Label>Nome *</Label>
                <Input value={edicao.nome} className="mt-1"
                  onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={edicao.categoria}
                  onValueChange={(v) => setEdicao({ ...edicao, categoria: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c.valor} value={c.valor}>{c.rotulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Validade</Label>
                <div className="mt-1 flex gap-2">
                  <Input type="number" min={0} value={edicao.validade} className="flex-1"
                    onChange={(e) => setEdicao({ ...edicao, validade: e.target.value })}
                    placeholder="Vazio = permanente" />
                  <Select value={edicao.unidade}
                    onValueChange={(v) => setEdicao({ ...edicao, unidade: v as UnidadeDeValidade })}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meses">meses</SelectItem>
                      <SelectItem value="dias">dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdicao(null)} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvarEdicao} disabled={salvando}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Requisitos por função ── */}
      <Dialog open={!!editando} onOpenChange={(v) => { if (!v) setEditando(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quem precisa de “{editando?.nome}”?</DialogTitle>
            <DialogDescription>
              Quem não estiver marcado verá este documento como “Não aplicável” no dossiê, em vez
              de aparecer como pendência.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={exigeTodos} onCheckedChange={(v) => setExigeTodos(!!v)} />
              Exigido de todos os colaboradores
            </label>
            {!exigeTodos && (
              <div>
                <Label className="text-xs text-muted-foreground">Ou selecione as funções:</Label>
                <div className="border rounded max-h-[40vh] overflow-y-auto mt-1 divide-y">
                  {cargos.length === 0 && (
                    <p className="text-xs text-muted-foreground p-3">
                      Nenhuma função encontrada — cadastre o cargo dos colaboradores primeiro.
                    </p>
                  )}
                  {cargos.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm p-2 cursor-pointer hover:bg-muted/50">
                      <Checkbox checked={cargosSel.includes(c)}
                        onCheckedChange={(v) => setCargosSel((prev) =>
                          v ? [...prev, c] : prev.filter((x) => x !== c))} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvarRequisitos} disabled={salvando}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
