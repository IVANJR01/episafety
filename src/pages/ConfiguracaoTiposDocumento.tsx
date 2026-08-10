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
import { Plus, Search, Settings2, Loader2, Info, Globe, Building2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
  id: string; nome: string; categoria: string; validade_meses: number | null;
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
  const [novo, setNovo] = useState({ nome: "", categoria: "capacitacao", validade_meses: "" });
  const [salvando, setSalvando] = useState(false);

  const [editando, setEditando] = useState<Tipo | null>(null);
  const [exigeTodos, setExigeTodos] = useState(false);
  const [cargosSel, setCargosSel] = useState<string[]>([]);

  const carregar = async () => {
    setCarregando(true);
    const { data, error } = await (supabase.from as any)("internal_document_types")
      .select("id, nome, categoria, validade_meses, empresa_id, ativo")
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
      const meses = novo.validade_meses.trim() ? parseInt(novo.validade_meses, 10) : null;
      const { error } = await (supabase.from as any)("internal_document_types").insert({
        empresa_id: empresaId, nome: novo.nome.trim(), categoria: novo.categoria,
        validade_meses: meses && meses > 0 ? meses : null, created_by: user?.id,
      });
      if (error) throw error;
      toast({ title: "Tipo criado" });
      setNovoAberto(false);
      setNovo({ nome: "", categoria: "capacitacao", validade_meses: "" });
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

  const descreverExigencia = (t: Tipo) => {
    const atuais = reqsPorTipo.get(t.id) || [];
    if (atuais.some((r) => !r.cargo)) return "Todos os colaboradores";
    if (atuais.length === 0) return "Ninguém (não aplicável)";
    return `${atuais.length} função(ões)`;
  };

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

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        Tipo marcado com <Globe className="w-3 h-3 inline" /> é do catálogo compartilhado (vale para
        todas as empresas e não pode ser editado aqui). Os requisitos por função, porém, são sempre
        da sua empresa — configure-os mesmo nos tipos compartilhados.
      </p>

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

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Exigido de</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregando && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
                )}
                {!carregando && listados.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum tipo cadastrado.
                  </TableCell></TableRow>
                )}
                {listados.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium text-sm flex items-center gap-1.5">
                        {t.empresa_id
                          ? <Building2 className="w-3.5 h-3.5 text-muted-foreground" aria-label="Da empresa" />
                          : <Globe className="w-3.5 h-3.5 text-muted-foreground" aria-label="Catálogo compartilhado" />}
                        {t.nome}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {CATEGORIAS.find((c) => c.valor === t.categoria)?.rotulo || t.categoria}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.validade_meses ? `${t.validade_meses} meses` : "Permanente"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">{descreverExigencia(t)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {perms.canEdit && (
                        <div className="flex justify-end items-center gap-2">
                          <Button size="sm" variant="outline" className="h-8 text-xs"
                            onClick={() => abrirRequisitos(t)}>
                            <Settings2 className="w-3.5 h-3.5 mr-1" />Requisitos
                          </Button>
                          {t.empresa_id && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => excluirTipo(t.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
              <Label>Validade (meses)</Label>
              <Input type="number" min={0} value={novo.validade_meses}
                onChange={(e) => setNovo({ ...novo, validade_meses: e.target.value })}
                placeholder="Vazio = permanente" />
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
