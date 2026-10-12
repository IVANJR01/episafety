import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";

// Função para calcular nível e cor do risco
function getRiscoInfo(p: number, s: number) {
  const score = p * s;
  if (score === 0) return { label: "-", color: "bg-gray-100 text-gray-800" };
  if (score >= 1 && score <= 3) return { label: `${score} TRIVIAL`, color: "bg-blue-100 text-blue-800" };
  if (score >= 4 && score <= 8) return { label: `${score} TOLERÁVEL`, color: "bg-green-100 text-green-800" };
  if (score >= 9 && score <= 12) return { label: `${score} MODERADO`, color: "bg-yellow-100 text-yellow-800" };
  if (score >= 13 && score <= 15) return { label: `${score} SUBSTANCIAL`, color: "bg-orange-100 text-orange-800" };
  return { label: `${score} INTOLERÁVEL`, color: "bg-red-100 text-red-800" };
}

export default function SstInventario() {
  const { empresaAtivaId } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    ges: "", ambiente: "", setor: "", funcao: "", processo: "", 
    agente: "Físico", perigo: "", fonte: "", probabilidade: "1", severidade: "1"
  });

  const { data: riscos, isLoading } = useQuery({
    queryKey: ["sst-inventario", empresaAtivaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sst_inventario_riscos")
        .select("*")
        .eq("empresa_id", empresaAtivaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaAtivaId
  });

  const mutationAdd = useMutation({
    mutationFn: async (novoRisco: any) => {
      const { data, error } = await supabase
        .from("sst_inventario_riscos")
        .insert([{ ...novoRisco, empresa_id: empresaAtivaId }]);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sst-inventario"] });
      setModalOpen(false);
      toast.success("Risco adicionado com sucesso!");
    },
    onError: (error) => toast.error("Erro ao salvar: " + error.message)
  });

  const mutationDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sst_inventario_riscos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sst-inventario"] });
      toast.success("Risco excluído.");
    }
  });

  const handleSalvar = () => {
    mutationAdd.mutate({
      ...formData,
      ghe: formData.ges, // no banco é ghe, na UI é ges
      probabilidade: parseInt(formData.probabilidade),
      severidade: parseInt(formData.severidade),
    });
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando inventário...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Tabela de Riscos</h2>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
              <Plus className="w-4 h-4 mr-2" /> Novo Risco
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Adicionar Linha de Risco</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label>GES</Label>
                <Input placeholder="Ex: GES-01" value={formData.ges} onChange={e => setFormData({...formData, ges: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Ambiente</Label>
                <Input placeholder="Ex: Produção" value={formData.ambiente} onChange={e => setFormData({...formData, ambiente: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Setor</Label>
                <Input placeholder="Ex: Soldagem" value={formData.setor} onChange={e => setFormData({...formData, setor: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Agente</Label>
                <Select value={formData.agente} onValueChange={v => setFormData({...formData, agente: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Físico">Físico</SelectItem>
                    <SelectItem value="Químico">Químico</SelectItem>
                    <SelectItem value="Biológico">Biológico</SelectItem>
                    <SelectItem value="Ergonômico">Ergonômico</SelectItem>
                    <SelectItem value="Acidente">Acidente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Perigo</Label>
                <Input placeholder="Ex: Ruído contínuo" value={formData.perigo} onChange={e => setFormData({...formData, perigo: e.target.value})} />
              </div>
              
              <div className="space-y-2">
                <Label>Probabilidade (1 a 5)</Label>
                <Select value={formData.probabilidade} onValueChange={v => setFormData({...formData, probabilidade: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severidade (1 a 5)</Label>
                <Select value={formData.severidade} onValueChange={v => setFormData({...formData, severidade: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <div className="text-sm font-medium mb-2 text-muted-foreground">Classificação</div>
                {(() => {
                  const info = getRiscoInfo(parseInt(formData.probabilidade), parseInt(formData.severidade));
                  return (
                    <div className={`px-3 py-2 rounded font-semibold text-sm w-fit ${info.color}`}>
                      {info.label}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex justify-end mt-6 gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSalvar} disabled={mutationAdd.isPending}>
                {mutationAdd.isPending ? "Salvando..." : "Adicionar à Planilha"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GES</TableHead>
              <TableHead>Ambiente</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Agente</TableHead>
              <TableHead>Perigo</TableHead>
              <TableHead className="text-center">P</TableHead>
              <TableHead className="text-center">S</TableHead>
              <TableHead>Nível de Risco</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!riscos || riscos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhum risco cadastrado. Adicione um novo para começar.
                </TableCell>
              </TableRow>
            ) : (
              riscos.map((risco) => {
                const info = getRiscoInfo(risco.probabilidade || 0, risco.severidade || 0);
                return (
                  <TableRow key={risco.id}>
                    <TableCell className="font-medium">{risco.ghe}</TableCell>
                    <TableCell>{risco.ambiente}</TableCell>
                    <TableCell>{risco.setor}</TableCell>
                    <TableCell>{risco.agente}</TableCell>
                    <TableCell>{risco.perigo}</TableCell>
                    <TableCell className="text-center">{risco.probabilidade}</TableCell>
                    <TableCell className="text-center">{risco.severidade}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${info.color}`}>
                        {info.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => mutationDelete.mutate(risco.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
