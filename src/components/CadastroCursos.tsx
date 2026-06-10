import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Search, BookOpen, GraduationCap, FileText, Infinity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { addToSyncQueue, getCachedData, isOnline, setCachedData } from "@/lib/offlineStorage";

interface CursoDocumento {
  id: string;
  nome: string;
  validade_meses: number;
  empresa_id: string | null;
}

interface CadastroCursosProps {
  onUpdate?: () => void;
}

export default function CadastroCursos({ onUpdate }: CadastroCursosProps) {
  const { empresaId, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<CursoDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CursoDocumento | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ nome: "", validade_meses: 0 });

  const fetchData = async () => {
    setLoading(true);
    if (!isOnline()) {
      setItems(getCachedData<CursoDocumento>("cursos_documentos") || []);
      setLoading(false);
      return;
    }

    const { data } = await (supabase.from as any)("cursos_documentos")
      .select("*")
      .order("nome");
    if (data) {
      setItems(data);
      setCachedData("cursos_documentos", data);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = items.filter(i => {
    if (!search.trim()) return true;
    return i.nome.toLowerCase().includes(search.toLowerCase());
  });

  // Separate: courses WITH validity vs permanent documents WITHOUT validity
  const cursos = filtered.filter(i => i.validade_meses > 0);
  const documentos = filtered.filter(i => i.validade_meses === 0);

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", validade_meses: 0 });
    setOpen(true);
  };

  const openEdit = (item: CursoDocumento) => {
    setEditing(item);
    setForm({ nome: item.nome, validade_meses: item.validade_meses });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome", variant: "destructive" });
      return;
    }
    const newName = form.nome.trim();
    const payload = { nome: newName, validade_meses: form.validade_meses, empresa_id: empresaId };

    if (!isOnline()) {
      const cachedItems = getCachedData<CursoDocumento>("cursos_documentos") || items;

      if (editing) {
        const oldName = editing.nome;
        addToSyncQueue({ table: "cursos_documentos", type: "update", payload: { id: editing.id, ...payload } });

        const nextItems = cachedItems.map((item) =>
          item.id === editing.id ? { ...item, ...payload } : item
        );
        setItems(nextItems);
        setCachedData("cursos_documentos", nextItems);

        if (oldName !== newName) {
          const requisitos = getCachedData<any>("requisitos_cliente") || [];
          const requisitosUpdated = requisitos.map((row: any) =>
            row.curso_nome === oldName ? { ...row, curso_nome: newName } : row
          );
          requisitos
            .filter((row: any) => row.curso_nome === oldName)
            .forEach((row: any) => {
              addToSyncQueue({
                table: "requisitos_cliente",
                type: "update",
                payload: { id: row.id, curso_nome: newName },
              });
            });
          setCachedData("requisitos_cliente", requisitosUpdated);

          const treinamentos = getCachedData<any>("controle_treinamentos") || [];
          const treinamentosUpdated = treinamentos.map((row: any) =>
            row.nome_curso === oldName ? { ...row, nome_curso: newName } : row
          );
          treinamentos
            .filter((row: any) => row.nome_curso === oldName)
            .forEach((row: any) => {
              addToSyncQueue({
                table: "controle_treinamentos",
                type: "update",
                payload: { id: row.id, nome_curso: newName },
              });
            });
          setCachedData("controle_treinamentos", treinamentosUpdated);

          const dispensas = getCachedData<any>("dispensas_requisito") || [];
          const dispensasUpdated = dispensas.map((row: any) =>
            row.curso_nome === oldName ? { ...row, curso_nome: newName } : row
          );
          dispensas
            .filter((row: any) => row.curso_nome === oldName)
            .forEach((row: any) => {
              addToSyncQueue({
                table: "dispensas_requisito",
                type: "update",
                payload: { id: row.id, curso_nome: newName },
              });
            });
          setCachedData("dispensas_requisito", dispensasUpdated);
        }

        toast({ title: "Atualizado offline", description: "Será sincronizado quando houver conexão." });
      } else {
        const newItem: CursoDocumento = { id: crypto.randomUUID(), ...payload };
        addToSyncQueue({ table: "cursos_documentos", type: "insert", payload: newItem });

        const nextItems = [newItem, ...cachedItems];
        setItems(nextItems);
        setCachedData("cursos_documentos", nextItems);

        toast({ title: "Cadastrado offline", description: "Será sincronizado quando houver conexão." });
      }

      setOpen(false);
      onUpdate?.();
      return;
    }

    if (editing) {
      const oldName = editing.nome;
      // If editing a global course (empresa_id is null) and we are not a super admin, 
      // we should create a new company-specific version instead of updating the global one.
      // This avoids RLS errors and allows customization.
      if (!editing.empresa_id && empresaId && !isSuperAdmin) {
        const { error } = await (supabase.from as any)("cursos_documentos").insert(payload);
        if (error) { toast({ title: "Erro ao criar versão da empresa", description: error.message, variant: "destructive" }); return; }
        toast({ title: "Criada versão específica para sua empresa." });
      } else {
        const { error } = await (supabase.from as any)("cursos_documentos").update(payload).eq("id", editing.id);
        if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }

        // Atualização em cascata: propagar renomeação para tabelas relacionadas
        if (oldName !== newName) {
          const cascadeUpdates = [
            (supabase.from as any)("requisitos_cliente")
              .update({ curso_nome: newName })
              .eq("curso_nome", oldName)
              .eq("empresa_id", empresaId),
            (supabase.from as any)("controle_treinamentos")
              .update({ nome_curso: newName })
              .eq("nome_curso", oldName)
              .eq("empresa_id", empresaId),
            (supabase.from as any)("dispensas_requisito")
              .update({ curso_nome: newName })
              .eq("curso_nome", oldName)
              .eq("empresa_id", empresaId),
          ];
          await Promise.allSettled(cascadeUpdates);
        }
        toast({ title: "Atualizado com sucesso!", description: oldName !== newName ? "Nome atualizado em todos os módulos." : undefined });
      }
    } else {
      const { error } = await (supabase.from as any)("cursos_documentos").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Cadastrado com sucesso!" });
    }
    setOpen(false);
    fetchData();
    onUpdate?.();
  };

  const handleDelete = async (id: string) => {
    if (!isOnline()) {
      addToSyncQueue({ table: "cursos_documentos", type: "delete", payload: { id } });
      const nextItems = (getCachedData<CursoDocumento>("cursos_documentos") || items).filter((item) => item.id !== id);
      setItems(nextItems);
      setCachedData("cursos_documentos", nextItems);
      toast({ title: "Removido offline", description: "Será sincronizado quando houver conexão." });
      onUpdate?.();
      return;
    }

    await (supabase.from as any)("cursos_documentos").delete().eq("id", id);
    fetchData();
    onUpdate?.();
  };

  const renderTable = (data: CursoDocumento[], type: "curso" | "documento") => (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome {type === "curso" ? "do Curso" : "do Documento"}</TableHead>
                <TableHead className="w-[150px]">{type === "curso" ? "Validade (meses)" : "Tipo"}</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Nenhum {type === "curso" ? "curso" : "documento"} cadastrado
                  </TableCell>
                </TableRow>
              ) : data.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nome}</TableCell>
                  <TableCell>
                    {item.validade_meses > 0 ? (
                      <Badge variant="outline" className="text-xs">{item.validade_meses} meses</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-300">
                        <Infinity className="w-3 h-3 mr-1" />Permanente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Cursos e Documentação</h2>
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="w-4 h-4 mr-1" />Adicionar
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Pesquisar curso ou documento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs defaultValue="cursos" className="w-full">
        <TabsList>
          <TabsTrigger value="cursos" className="gap-1.5">
            <GraduationCap className="w-4 h-4" />
            Cursos com Validade
            <Badge variant="secondary" className="text-[10px] ml-1">{cursos.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1.5">
            <FileText className="w-4 h-4" />
            Documentos Permanentes
            <Badge variant="secondary" className="text-[10px] ml-1">{documentos.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cursos">
          {renderTable(cursos, "curso")}
        </TabsContent>

        <TabsContent value="documentos">
          {renderTable(documentos, "documento")}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Curso/Documento" : "Novo Curso/Documento"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input placeholder="Ex: NR-10 Básico, ASO, Ficha de EPI..." value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Validade (em meses)</Label>
              <Input type="number" min={0} value={form.validade_meses} onChange={e => setForm({ ...form, validade_meses: parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-muted-foreground mt-1">0 = documento permanente (sem vencimento)</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>{editing ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}