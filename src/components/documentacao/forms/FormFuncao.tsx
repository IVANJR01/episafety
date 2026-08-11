import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Briefcase, Save } from "lucide-react";
import { SstSetor, SstProcesso } from "@/types/sst";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export function FormFuncao({ formData, setFormData, onSave, onCancel, setores, processos }: { formData: any, setFormData: any, onSave: any, onCancel: any, setores: SstSetor[], processos: SstProcesso[] }) {
  // Filter processos based on selected setor
  const processosFiltered = formData.setor_id 
    ? processos.filter(p => p.setor_id === formData.setor_id) 
    : processos;

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-indigo-600" />
          {formData.id ? "Editar Função / Cargo" : "Nova Função"}
        </CardTitle>
        <CardDescription>Cargo, função e atividades desempenhadas.</CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Setor (Opcional)</Label>
            <Select 
              value={formData.setor_id || ""} 
              onValueChange={v => {
                setFormData({...formData, setor_id: v, processo_id: ""});
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (Geral)</SelectItem>
                {setores.map(set => (
                  <SelectItem key={set.id} value={set.id}>{set.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Processo Vinculado (Opcional)</Label>
            <Select 
              value={formData.processo_id || ""} 
              onValueChange={v => setFormData({...formData, processo_id: v})}
              disabled={!formData.setor_id || formData.setor_id === "none"}
            >
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {processosFiltered.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>Nome da Função / Cargo *</Label>
            <Input 
              value={formData.nome || ""} 
              onChange={e => setFormData({...formData, nome: e.target.value})} 
              placeholder="Ex: Soldador, Assistente Administrativo" 
            />
          </div>
          <div className="space-y-2">
            <Label>CBO</Label>
            <Input 
              value={formData.cbo || ""} 
              onChange={e => setFormData({...formData, cbo: e.target.value})} 
              placeholder="Ex: 7243-15" 
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Descrição das Atividades</Label>
          <Textarea 
            value={formData.descricao_atividades || ""} 
            onChange={e => setFormData({...formData, descricao_atividades: e.target.value})} 
            placeholder="O que o trabalhador faz no dia a dia..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-700">Requisitos Especiais de Segurança</Label>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="nr10" 
                checked={!!formData.exige_nr10} 
                onCheckedChange={c => setFormData({...formData, exige_nr10: !!c})}
              />
              <Label htmlFor="nr10" className="font-normal cursor-pointer">Exige Treinamento NR-10 (Elétrica)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="nr33" 
                checked={!!formData.exige_nr33} 
                onCheckedChange={c => setFormData({...formData, exige_nr33: !!c})}
              />
              <Label htmlFor="nr33" className="font-normal cursor-pointer">Exige Treinamento NR-33 (Espaço Confinado)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="nr35" 
                checked={!!formData.exige_nr35} 
                onCheckedChange={c => setFormData({...formData, exige_nr35: !!c})}
              />
              <Label htmlFor="nr35" className="font-normal cursor-pointer">Exige Treinamento NR-35 (Trabalho em Altura)</Label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          {onCancel && <Button variant="outline" onClick={onCancel}>Cancelar</Button>}
          <Button onClick={onSave} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="w-4 h-4 mr-2" /> Salvar Função
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
