import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Save } from "lucide-react";

export function FormEstabelecimento({ formData, setFormData, onSave, onCancel }: any) {
  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-600" />
          {formData.id ? "Editar Estabelecimento" : "Novo Estabelecimento"}
        </CardTitle>
        <CardDescription>Dados da filial, obra ou matriz (CNO/CNPJ).</CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-4">
        <div className="space-y-2">
          <Label>Nome do Estabelecimento / Unidade *</Label>
          <Input 
            value={formData.nome || ""} 
            onChange={e => setFormData({...formData, nome: e.target.value})} 
            placeholder="Ex: Filial Norte" 
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de Estabelecimento *</Label>
            <Select 
              value={formData.tipo || "proprio"} 
              onValueChange={v => setFormData({...formData, tipo: v})}
            >
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="proprio">Próprio / Matriz / Filial</SelectItem>
                <SelectItem value="terceiro">Terceiro / Cliente</SelectItem>
                <SelectItem value="obra">Obra / Frente de Trabalho</SelectItem>
                <SelectItem value="administrativo">Administrativo Exclusivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Grau de Risco (NR-04)</Label>
            <Select 
              value={formData.grau_risco?.toString() || ""} 
              onValueChange={v => setFormData({...formData, grau_risco: parseInt(v)})}
            >
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Grau 1</SelectItem>
                <SelectItem value="2">Grau 2</SelectItem>
                <SelectItem value="3">Grau 3</SelectItem>
                <SelectItem value="4">Grau 4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input 
              value={formData.cnpj || ""} 
              onChange={e => setFormData({...formData, cnpj: e.target.value})} 
              placeholder="00.000.000/0000-00" 
            />
          </div>
          <div className="space-y-2">
            <Label>CNO (Cadastro Nacional de Obras)</Label>
            <Input 
              value={formData.cno || ""} 
              onChange={e => setFormData({...formData, cno: e.target.value})} 
              placeholder="Para obras" 
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          {onCancel && <Button variant="outline" onClick={onCancel}>Cancelar</Button>}
          <Button onClick={onSave} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="w-4 h-4 mr-2" /> Salvar Estabelecimento
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
