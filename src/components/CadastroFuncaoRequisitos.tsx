import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2, Search, Briefcase, X, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

interface RequisitoCliente {
  id: string;
  nome_cliente: string;
  curso_nome: string;
  funcoes_exigidas: string[] | null;
  carga_horaria_minima: number;
  validade_meses: number;
  descricao: string | null;
}

interface CursoDocumento {
  nome: string;
  validade_meses: number;
}

interface CadastroFuncaoRequisitosProps {
  onUpdate?: () => void;
}

export default function CadastroFuncaoRequisitos({ onUpdate }: CadastroFuncaoRequisitosProps) {
  const { empresaId } = useAuth();
  const { toast } = useToast();
  const [requisitos, setRequisitos] = useState<RequisitoCliente[]>([]);
  const [cursos, setCursos] = useState<CursoDocumento[]>([]);
  const [cargosExistentes, setCargosExistentes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RequisitoCliente | null>(null);
  const [search, setSearch] = useState("");

  // Form state
  const [funcaoNome, setFuncaoNome] = useState("");
  const [funcoesMultiplas, setFuncoesMultiplas] = useState<string[]>([]);
  const [funcaoInput, setFuncaoInput] = useState("");
  const [cursosSelecionados, setCursosSelecionados] = useState<{ curso_nome: string; carga_horaria: number; validade_meses: number; permanente: boolean }[]>([]);
  const [cursoPopoverOpen, setCursoPopoverOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: reqData }, { data: cursosData }, { data: funcsData }] = await Promise.all([
      (supabase.from as any)("requisitos_cliente").select("*").order("curso_nome"),
      (supabase.from as any)("cursos_documentos").select("nome, validade_meses").order("nome"),
      supabase.from("funcionarios").select("cargo"),
    ]);
    if (reqData) setRequisitos(reqData);
    if (cursosData) setCursos(cursosData);
    if (funcsData) {
      const unique = [...new Set(funcsData.map((f: any) => f.cargo).filter(Boolean))] as string[];
      setCargosExistentes(unique.sort());
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Group requisitos by funcao for display
  const funcaoGroups = useMemo(() => {
    const map = new Map<string, RequisitoCliente[]>();
    requisitos.forEach(r => {
      const funcoes = r.funcoes_exigidas || [];
      funcoes.forEach(f => {
        if (!map.has(f)) map.set(f, []);
        map.get(f)!.push(r);
      });
    });
    // Sort by function name
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [requisitos]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return funcaoGroups;
    const term = search.toLowerCase();
    return funcaoGroups.filter(([funcao, reqs]) =>
      funcao.toLowerCase().includes(term) || reqs.some(r => r.curso_nome.toLowerCase().includes(term))
    );
  }, [funcaoGroups, search]);

  const openNew = () => {
    setEditing(null);
    setFuncaoNome("");
    setFuncoesMultiplas([]);
    setFuncaoInput("");
    setCursosSelecionados([]);
    setOpen(true);
  };

  const openEditFuncao = (funcao: string, reqs: RequisitoCliente[]) => {
    setEditing(null);
    setFuncaoNome(funcao);
    setFuncoesMultiplas([funcao]);
    setFuncaoInput("");
    setCursosSelecionados(reqs.map(r => ({
      curso_nome: r.curso_nome,
      carga_horaria: r.carga_horaria_minima,
      validade_meses: r.validade_meses,
      permanente: r.validade_meses === 0,
    })));
    setOpen(true);
  };

  const addFuncao = (nome: string) => {
    const trimmed = nome.trim();
    if (!trimmed || funcoesMultiplas.includes(trimmed)) return;
    setFuncoesMultiplas(prev => [...prev, trimmed]);
    setFuncaoInput("");
  };

  const removeFuncao = (nome: string) => {
    setFuncoesMultiplas(prev => prev.filter(f => f !== nome));
  };

  const isEditingMode = funcoesMultiplas.length === 1 && funcaoNome === funcoesMultiplas[0];

  const toggleCurso = (cursoNome: string) => {
    const exists = cursosSelecionados.find(c => c.curso_nome === cursoNome);
    if (exists) {
      setCursosSelecionados(prev => prev.filter(c => c.curso_nome !== cursoNome));
    } else {
      const dbCurso = cursos.find(c => c.nome === cursoNome);
      setCursosSelecionados(prev => [...prev, {
        curso_nome: cursoNome,
        carga_horaria: 0,
        validade_meses: dbCurso?.validade_meses || 0,
        permanente: dbCurso?.validade_meses === 0,
      }]);
    }
  };

  const handleSave = async () => {
    if (funcoesMultiplas.length === 0 || cursosSelecionados.length === 0) {
      toast({ title: "Adicione ao menos uma função e selecione ao menos um curso", variant: "destructive" });
      return;
    }

    for (const currentFuncao of funcoesMultiplas) {
      // Delete existing requisitos for this funcao
      const existingForFuncao = requisitos.filter(r =>
        r.funcoes_exigidas?.includes(currentFuncao)
      );

      for (const req of existingForFuncao) {
        const newFuncoes = (req.funcoes_exigidas || []).filter(f => f !== currentFuncao);
        if (newFuncoes.length === 0) {
          await (supabase.from as any)("requisitos_cliente").delete().eq("id", req.id);
        } else {
          await (supabase.from as any)("requisitos_cliente").update({ funcoes_exigidas: newFuncoes }).eq("id", req.id);
        }
      }

      // Add/update requisitos for each selected curso
      for (const curso of cursosSelecionados) {
        const existingReq = requisitos.find(r => r.curso_nome === curso.curso_nome && !r.funcoes_exigidas?.includes(currentFuncao));
        if (existingReq) {
          const updatedFuncoes = [...(existingReq.funcoes_exigidas || []), currentFuncao];
          await (supabase.from as any)("requisitos_cliente").update({
            funcoes_exigidas: updatedFuncoes,
            carga_horaria_minima: curso.carga_horaria || existingReq.carga_horaria_minima,
            validade_meses: curso.permanente ? 0 : curso.validade_meses,
          }).eq("id", existingReq.id);
        } else {
          await (supabase.from as any)("requisitos_cliente").insert({
            nome_cliente: "Matriz Unificada",
            curso_nome: curso.curso_nome,
            funcoes_exigidas: [currentFuncao],
            carga_horaria_minima: curso.carga_horaria,
            validade_meses: curso.permanente ? 0 : curso.validade_meses,
            empresa_id: empresaId,
          });
        }
      }
    }

    toast({ title: `Requisitos salvos para ${funcoesMultiplas.length} função(ões)!` });
    setOpen(false);
    await fetchData();
    onUpdate?.();
  };

  const handleDeleteFuncao = async (funcao: string, reqs: RequisitoCliente[]) => {
    if (!confirm(`Remover todos os requisitos da função "${funcao}"?`)) return;
    for (const req of reqs) {
      const newFuncoes = (req.funcoes_exigidas || []).filter(f => f !== funcao);
      if (newFuncoes.length === 0) {
        await (supabase.from as any)("requisitos_cliente").delete().eq("id", req.id);
      } else {
        await (supabase.from as any)("requisitos_cliente").update({ funcoes_exigidas: newFuncoes }).eq("id", req.id);
      }
    }
    toast({ title: "Requisitos removidos!" });
    await fetchData();
    onUpdate?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Requisitos por Função
          </h3>
          <p className="text-sm text-muted-foreground">
            Defina quais cursos e documentos são obrigatórios para cada cargo/função
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4 mr-1" />Adicionar Função
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Pesquisar por função ou curso..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>Nenhum requisito por função cadastrado</p>
          <p className="text-xs mt-1">Clique em "Adicionar Função" para configurar os cursos obrigatórios de cada cargo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map(([funcao, reqs]) => (
            <Card key={funcao} className="border-l-4 border-l-primary/60">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="w-4 h-4 text-primary" />
                      <h4 className="font-bold text-sm">{funcao}</h4>
                      <Badge variant="secondary" className="text-xs">{reqs.length} curso(s)</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {reqs.map(r => (
                        <Badge
                          key={r.id}
                          variant="outline"
                          className={r.validade_meses === 0
                            ? "bg-blue-50 text-blue-700 border-blue-200 text-xs"
                            : "bg-primary/5 text-primary border-primary/20 text-xs"}
                        >
                          {r.curso_nome}
                          {r.validade_meses > 0 && <span className="ml-1 opacity-60">({r.validade_meses}m)</span>}
                          {r.validade_meses === 0 && <span className="ml-1 opacity-60">(∞)</span>}
                          {r.carga_horaria_minima > 0 && <span className="ml-1 opacity-60">• {r.carga_horaria_minima}h</span>}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditFuncao(funcao, reqs)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDeleteFuncao(funcao, reqs)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {funcaoNome ? `Editar Requisitos: ${funcaoNome}` : "Nova Função — Matriz de Competência"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nome da Função */}
            <div>
              <Label>Nome da Função / Cargo *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Ex: Técnico de Planejamento, Eletricista..."
                    value={funcaoInput}
                    onChange={e => setFuncaoInput(e.target.value)}
                    list="cargos-existentes"
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); addFuncao(funcaoInput); }
                    }}
                  />
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={() => addFuncao(funcaoInput)} disabled={!funcaoInput.trim()}>
                  <Plus className="w-4 h-4 mr-1" />Adicionar
                </Button>
              </div>
              <datalist id="cargos-existentes">
                {cargosExistentes.filter(c => !funcoesMultiplas.includes(c)).map(c => <option key={c} value={c} />)}
              </datalist>
              <p className="text-xs text-muted-foreground mt-1">
                {isEditingMode
                  ? "Editando os requisitos desta função"
                  : "Adicione uma ou mais funções que compartilham os mesmos requisitos. Pressione Enter ou clique em Adicionar."}
              </p>
              {funcoesMultiplas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {funcoesMultiplas.map(f => (
                    <Badge key={f} variant="secondary" className="text-xs gap-1 pr-1">
                      {f}
                      <button type="button" onClick={() => removeFuncao(f)} className="ml-0.5 hover:bg-destructive/20 rounded-full p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Cursos Obrigatórios */}
            <div>
              <Label className="text-base font-semibold mb-2 block">Cursos Obrigatórios</Label>
              <Popover open={cursoPopoverOpen} onOpenChange={setCursoPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between h-auto min-h-9">
                    <span className="text-muted-foreground text-sm">
                      {cursosSelecionados.length > 0 ? `${cursosSelecionados.length} curso(s) selecionado(s)` : "Selecione os cursos obrigatórios..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pesquisar curso..." />
                    <CommandList>
                      <CommandEmpty>Nenhum curso encontrado.</CommandEmpty>
                      <CommandGroup>
                        {cursos.map(c => {
                          const isSelected = cursosSelecionados.some(cs => cs.curso_nome === c.nome);
                          return (
                            <CommandItem key={c.nome} value={c.nome} onSelect={() => toggleCurso(c.nome)}>
                              <Check className={`mr-2 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                              <span className="flex-1">{c.nome}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {c.validade_meses === 0 ? "∞ Permanente" : `${c.validade_meses} meses`}
                              </span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Selected courses list */}
            {cursosSelecionados.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Cursos selecionados</Label>
                {cursosSelecionados.map((cs, idx) => (
                  <Card key={cs.curso_nome} className="border-dashed">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1">
                        <span className="text-sm font-medium">{cs.curso_nome}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs whitespace-nowrap">Carga H.</Label>
                          <Input
                            type="number"
                            className="w-16 h-7 text-xs"
                            value={cs.carga_horaria || ""}
                            placeholder="h"
                            onChange={e => {
                              const updated = [...cursosSelecionados];
                              updated[idx] = { ...updated[idx], carga_horaria: Number(e.target.value) };
                              setCursosSelecionados(updated);
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            id={`perm-${idx}`}
                            checked={cs.permanente}
                            onCheckedChange={(checked) => {
                              const updated = [...cursosSelecionados];
                              updated[idx] = { ...updated[idx], permanente: !!checked, validade_meses: checked ? 0 : (cursos.find(c => c.nome === cs.curso_nome)?.validade_meses || 12) };
                              setCursosSelecionados(updated);
                            }}
                          />
                          <Label htmlFor={`perm-${idx}`} className="text-xs cursor-pointer whitespace-nowrap">Permanente</Label>
                        </div>
                        {!cs.permanente && (
                          <div className="flex items-center gap-1">
                            <Label className="text-xs whitespace-nowrap">Val.</Label>
                            <Input
                              type="number"
                              className="w-14 h-7 text-xs"
                              value={cs.validade_meses || ""}
                              placeholder="m"
                              onChange={e => {
                                const updated = [...cursosSelecionados];
                                updated[idx] = { ...updated[idx], validade_meses: Number(e.target.value) };
                                setCursosSelecionados(updated);
                              }}
                            />
                            <span className="text-xs text-muted-foreground">m</span>
                          </div>
                        )}
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCursosSelecionados(prev => prev.filter((_, i) => i !== idx))}>
                          <X className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={funcoesMultiplas.length === 0 || cursosSelecionados.length === 0}>
              Salvar Requisitos ({funcoesMultiplas.length} função{funcoesMultiplas.length !== 1 ? "ões" : ""} • {cursosSelecionados.length} curso{cursosSelecionados.length !== 1 ? "s" : ""})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
