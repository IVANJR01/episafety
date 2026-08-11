import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Workflow, Save } from "lucide-react";
import { SstSetor } from "@/types/sst";

export function FormProcesso({ formData, setFormData, onSave, onCancel, setores }: { formData: any, setFormData: any, onSave: any, onCancel: any, setores: SstSetor[] }) {
  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <Workflow className="w-5 h-5 text-indigo-600" />
          {formData.id ? "Editar Processo" : "Novo Processo"}
        </CardTitle>
        <CardDescription>Atividade macro, processo ou operação.</CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-4">
        <div className="space-y-2">
          <Label>Setor Vinculado *</Label>
          <Select 
            value={formData.setor_id || ""} 
            onValueChange={v => setFormData({...formData, setor_id: v})}
          >
            <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
            <SelectContent>
              {setores.map(set => (
                <SelectItem key={set.id} value={set.id}>{set.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Nome do Processo / Operação *</Label>
          <Input 
            value={formData.nome || ""} 
            onChange={e => setFormData({...formData, nome: e.target.value})} 
            placeholder="Ex: Soldagem TIG, Atendimento ao Cliente" 
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Característica</Label>
            <Select 
              value={formData.caracteristica_atividade || "rotineira"} 
              onValueChange={v => setFormData({...formData, caracteristica_atividade: v})}
            >
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rotineira">Rotineira</SelectItem>
                <SelectItem value="nao_rotineira">Não Rotineira (Eventual)</SelectItem>
                <SelectItem value="emergencia">Emergência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Frequência</Label>
            <Input 
              value={formData.frequencia || ""} 
              onChange={e => setFormData({...formData, frequencia: e.target.value})} 
              placeholder="Ex: Diário, Semanal" 
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Máquinas e Equipamentos Utilizados</Label>
          <Input 
            value={formData.maquinas_equipamentos || ""} 
            onChange={e => setFormData({...formData, maquinas_equipamentos: e.target.value})} 
            placeholder="Ex: Máquina de solda, lixadeira" 
          />
        </div>
        <div className="space-y-2">
          <Label>Produtos Químicos Manipulados</Label>
          <Input 
            value={formData.produtos_quimicos || ""} 
            onChange={e => setFormData({...formData, produtos_quimicos: e.target.value})} 
            placeholder="Ex: Solvente, Tinta, Óleo Mineral" 
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          {onCancel && <Button variant="outline" onClick={onCancel}>Cancelar</Button>}
          <Button onClick={onSave} className="bg-indigo-600 hover:bg-indigo-700" disabled={!formData.setor_id}>
            <Save className="w-4 h-4 mr-2" /> Salvar Processo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
