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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export default function SstPlanoAcao() {
  const { empresaAtivaId } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    ges: "", setor: "", oque: "", porque: "", como: "", onde: "", quanto: "",
    prioridade: "MÉDIA", responsavel: "", status: "PROGRAMADO", afericao: "", meses: [] as string[]
  });

  const { data: acoes, isLoading } = useQuery({
    queryKey: ["sst-plano", empresaAtivaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sst_plano_acao")
        .select("*")
        .eq("empresa_id", empresaAtivaId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaAtivaId
  });

  const mutationAdd = useMutation({
    mutationFn: async (novaAcao: any) => {
      const { data, error } = await supabase
        .from("sst_plano_acao")
        .insert([{ ...novaAcao, empresa_id: empresaAtivaId }]);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sst-plano"] });
      setModalOpen(false);
      toast.success("Ação adicionada com sucesso!");
    },
    onError: (error) => toast.error("Erro ao salvar: " + error.message)
  });

  const mutationDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sst_plano_acao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sst-plano"] });
      toast.success("Ação excluída.");
    }
  });

  const handleSalvar = () => {
    mutationAdd.mutate({
      ...formData,
      ghe: formData.ges, // no banco é ghe
    });
  };

  const toggleMes = (mes: string) => {
    const novos = formData.meses.includes(mes) 
      ? formData.meses.filter(m => m !== mes)
      : [...formData.meses, mes];
    setFormData({ ...formData, meses: novos });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ATRASADO": return "bg-red-500 text-white";
      case "REALIZADO": return "bg-green-500 text-white";
      case "PROGRAMADO": return "bg-blue-500 text-white";
      case "EM ANDAMENTO": return "bg-yellow-500 text-white";
      case "REPROGRAMADO": return "bg-purple-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando plano de ação...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Tabela 5W2H</h2>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
              <Plus className="w-4 h-4 mr-2" /> Nova Ação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Adicionar Ação (5W2H)</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 max-h-[60vh] overflow-y-auto p-1">
              <div className="space-y-2">
                <Label>O Que (What)</Label>
                <Input placeholder="Ação a ser feita" value={formData.oque} onChange={e => setFormData({...formData, oque: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Por Que (Why)</Label>
                <Input placeholder="Motivo" value={formData.porque} onChange={e => setFormData({...formData, porque: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Onde (Where)</Label>
                <Input placeholder="Setor / Local" value={formData.onde} onChange={e => setFormData({...formData, onde: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Como (How)</Label>
                <Input placeholder="Método" value={formData.como} onChange={e => setFormData({...formData, como: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Quem (Who / Responsável)</Label>
                <Input placeholder="Nome" value={formData.responsavel} onChange={e => setFormData({...formData, responsavel: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Quanto Custa (How much)</Label>
                <Input placeholder="R$ 0,00 ou N/A" value={formData.quanto} onChange={e => setFormData({...formData, quanto: e.target.value})} />
              </div>
              
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={formData.prioridade} onValueChange={v => setFormData({...formData, prioridade: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="MÉDIA">Média</SelectItem>
                    <SelectItem value="BAIXA">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROGRAMADO">Programado</SelectItem>
                    <SelectItem value="EM ANDAMENTO">Em Andamento</SelectItem>
                    <SelectItem value="REALIZADO">Realizado</SelectItem>
                    <SelectItem value="ATRASADO">Atrasado</SelectItem>
                    <SelectItem value="REPROGRAMADO">Reprogramado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2 md:col-span-2 mt-2">
                <Label>Cronograma (Meses)</Label>
                <div className="flex flex-wrap gap-4 p-3 border rounded-md">
                  {MESES.map(mes => (
                    <label key={mes} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox 
                        checked={formData.meses.includes(mes)} 
                        onCheckedChange={() => toggleMes(mes)} 
                      />
                      <span className="text-sm">{mes}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4 gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSalvar} disabled={mutationAdd.isPending}>
                {mutationAdd.isPending ? "Salvando..." : "Adicionar Ação"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>O Que</TableHead>
              <TableHead>Onde</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Meses (Cronograma)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!acoes || acoes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma ação cadastrada no plano.
                </TableCell>
              </TableRow>
            ) : (
              acoes.map((acao) => (
                <TableRow key={acao.id}>
                  <TableCell className="font-medium">{acao.oque}</TableCell>
                  <TableCell>{acao.onde}</TableCell>
                  <TableCell>{acao.responsavel}</TableCell>
                  <TableCell>{acao.prioridade}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(acao.meses || []).map((m: string) => (
                        <span key={m} className="bg-gray-100 text-gray-700 text-[10px] px-1.5 py-0.5 rounded font-bold">
                          {m}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${getStatusColor(acao.status)}`}>
                      {acao.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => mutationDelete.mutate(acao.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
