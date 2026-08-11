import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Home, Save } from "lucide-react";
import { SstEstabelecimento } from "@/types/sst";

export function FormAmbiente({ formData, setFormData, onSave, onCancel, estabelecimentos }: { formData: any, setFormData: any, onSave: any, onCancel: any, estabelecimentos: SstEstabelecimento[] }) {
  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <Home className="w-5 h-5 text-indigo-600" />
          {formData.id ? "Editar Ambiente" : "Novo Ambiente"}
        </CardTitle>
        <CardDescription>O espaço físico da empresa (características construtivas).</CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-4">
        <div className="space-y-2">
          <Label>Estabelecimento Vinculado</Label>
          <Select 
            value={formData.estabelecimento_id || ""} 
            onValueChange={v => setFormData({...formData, estabelecimento_id: v})}
          >
            <SelectTrigger><SelectValue placeholder="Selecione um estabelecimento (Opcional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum (Geral)</SelectItem>
              {estabelecimentos.map(est => (
                <SelectItem key={est.id} value={est.id}>{est.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Nome do Ambiente *</Label>
          <Input 
            value={formData.nome || ""} 
            onChange={e => setFormData({...formData, nome: e.target.value})} 
            placeholder="Ex: Galpão Principal, Escritório" 
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de Ambiente</Label>
            <Select 
              value={formData.tipo_ambiente || "interno"} 
              onValueChange={v => setFormData({...formData, tipo_ambiente: v})}
            >
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="interno">Interno / Fechado</SelectItem>
                <SelectItem value="externo">Externo / Céu Aberto</SelectItem>
                <SelectItem value="misto">Misto (Parcialmente fechado)</SelectItem>
                <SelectItem value="confinado">Espaço Confinado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Pé-Direito</Label>
            <Input 
              value={formData.pe_direito || ""} 
              onChange={e => setFormData({...formData, pe_direito: e.target.value})} 
              placeholder="Ex: 3 metros" 
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Piso</Label>
            <Input 
              value={formData.piso || ""} 
              onChange={e => setFormData({...formData, piso: e.target.value})} 
              placeholder="Ex: Cerâmico, Concreto" 
            />
          </div>
          <div className="space-y-2">
            <Label>Paredes / Fechamentos</Label>
            <Input 
              value={formData.paredes || ""} 
              onChange={e => setFormData({...formData, paredes: e.target.value})} 
              placeholder="Ex: Alvenaria" 
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Ventilação</Label>
            <Input 
              value={formData.ventilacao || ""} 
              onChange={e => setFormData({...formData, ventilacao: e.target.value})} 
              placeholder="Ex: Natural / Exaustores" 
            />
          </div>
          <div className="space-y-2">
            <Label>Iluminação</Label>
            <Input 
              value={formData.iluminacao || ""} 
              onChange={e => setFormData({...formData, iluminacao: e.target.value})} 
              placeholder="Ex: Artificial Fluorescente" 
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          {onCancel && <Button variant="outline" onClick={onCancel}>Cancelar</Button>}
          <Button onClick={onSave} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="w-4 h-4 mr-2" /> Salvar Ambiente
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
