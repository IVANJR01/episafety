import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LayoutGrid, Save } from "lucide-react";
import { SstAmbiente } from "@/types/sst";

export function FormSetor({ formData, setFormData, onSave, onCancel, ambientes }: { formData: any, setFormData: any, onSave: any, onCancel: any, ambientes: SstAmbiente[] }) {
  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-indigo-600" />
          {formData.id ? "Editar Setor" : "Novo Setor"}
        </CardTitle>
        <CardDescription>Divisão administrativa ou operacional da empresa.</CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-4">
        <div className="space-y-2">
          <Label>Ambiente Vinculado</Label>
          <Select 
            value={formData.ambiente_id || ""} 
            onValueChange={v => setFormData({...formData, ambiente_id: v})}
          >
            <SelectTrigger><SelectValue placeholder="Selecione onde este setor fica (Opcional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum (Geral)</SelectItem>
              {ambientes.map(amb => (
                <SelectItem key={amb.id} value={amb.id}>{amb.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Nome do Setor *</Label>
          <Input 
            value={formData.nome || ""} 
            onChange={e => setFormData({...formData, nome: e.target.value})} 
            placeholder="Ex: Administrativo, Manutenção" 
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Responsável (Opcional)</Label>
            <Input 
              value={formData.responsavel_setor || ""} 
              onChange={e => setFormData({...formData, responsavel_setor: e.target.value})} 
              placeholder="Nome do gestor do setor" 
            />
          </div>
          <div className="space-y-2">
            <Label>Jornada / Turnos</Label>
            <Input 
              value={formData.jornada_turnos || ""} 
              onChange={e => setFormData({...formData, jornada_turnos: e.target.value})} 
              placeholder="Ex: 08:00 às 18:00" 
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          {onCancel && <Button variant="outline" onClick={onCancel}>Cancelar</Button>}
          <Button onClick={onSave} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="w-4 h-4 mr-2" /> Salvar Setor
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
