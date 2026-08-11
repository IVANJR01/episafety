import React, { useState } from "react";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, Users, Briefcase, Search, Loader2, ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export function GesManagementTab() {
  const {
    gesList,
    funcoes,
    gesVinculos,
    isLoading,
    saveGes,
    saveGesVinculos
  } = useNucleoMestreSst();

  const [activeGesId, setActiveGesId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [selectedFuncoes, setSelectedFuncoes] = useState<string[]>([]);
  const [searchFuncao, setSearchFuncao] = useState("");

  // Handling Ges Selection
  const handleSelectGes = (gesId: string) => {
    setActiveGesId(gesId);
    const ges = gesList.find(g => g.id === gesId);
    setFormData(ges || {});
    
    // Load current bindings
    const currentBindings = gesVinculos
      .filter(v => v.ges_id === gesId && v.tipo_vinculo === 'funcao')
      .map(v => v.item_id);
    setSelectedFuncoes(currentBindings);
  };

  const handleCreateNewGes = () => {
    setActiveGesId("new");
    setFormData({
      codigo: `GHE-${Math.floor(100 + Math.random() * 900)}`
    });
    setSelectedFuncoes([]);
  };

  const handleToggleFuncao = (funcaoId: string) => {
    setSelectedFuncoes(prev => 
      prev.includes(funcaoId) 
        ? prev.filter(id => id !== funcaoId)
        : [...prev, funcaoId]
    );
  };

  const handleSave = async () => {
    try {
      // 1. Save GES Header
      const savedGes = await saveGes(formData);
      const actualGesId = savedGes.id;
      
      // 2. Save Vinculos
      const vinculados = selectedFuncoes.map(fid => ({
        tipo: 'funcao',
        item_id: fid
      }));
      await saveGesVinculos({ gesId: actualGesId, vinculados });
      
      if (activeGesId === "new") {
        setActiveGesId(actualGesId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const funcoesFiltradas = funcoes.filter(f => 
    f.nome.toLowerCase().includes(searchFuncao.toLowerCase()) ||
    (f.cbo && f.cbo.includes(searchFuncao))
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-2 text-indigo-600" />
        <span>Carregando Dados do GES...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[750px]">
      {/* LEFT PANE: LIST OF GES */}
      <Card className="col-span-1 md:col-span-4 flex flex-col h-full border-slate-200 shadow-sm overflow-hidden bg-slate-50">
        <div className="p-4 border-b bg-white flex justify-between items-center">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            Grupos Homogêneos
          </h3>
          <Button onClick={handleCreateNewGes} size="sm" className="h-8 px-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Novo GES
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {gesList.length === 0 && (
            <div className="text-center p-4 text-sm text-slate-500">
              Nenhum grupo cadastrado.
            </div>
          )}
          {gesList.map(ges => (
            <div 
              key={ges.id}
              onClick={() => handleSelectGes(ges.id)}
              className={`p-3 rounded-md cursor-pointer border transition-colors ${
                activeGesId === ges.id 
                  ? "bg-indigo-50 border-indigo-300 shadow-sm" 
                  : "bg-white border-slate-200 hover:border-indigo-300"
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <Badge variant="outline" className="text-[10px] bg-white">{ges.codigo}</Badge>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  {gesVinculos.filter(v => v.ges_id === ges.id).length}
                </div>
              </div>
              <div className="font-medium text-slate-800 text-sm">{ges.nome}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* RIGHT PANE: GES FORM & BINDINGS */}
      <Card className="col-span-1 md:col-span-8 flex flex-col h-full border-slate-200 shadow-sm overflow-hidden">
        {!activeGesId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Users className="w-12 h-12 text-slate-200 mb-2" />
            <p>Selecione um GES na lista ou crie um novo.</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* GES HEADER FORM */}
            <div className="p-5 border-b bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">
                  {activeGesId === "new" ? "Criar Novo GES" : "Editar GES"}
                </h3>
                <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
                  <Save className="w-4 h-4 mr-2" /> Salvar Grupo
                </Button>
              </div>
              
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-3 space-y-2">
                  <Label>Código</Label>
                  <Input 
                    value={formData.codigo || ""} 
                    onChange={e => setFormData({...formData, codigo: e.target.value})}
                    placeholder="Ex: GHE-01"
                  />
                </div>
                <div className="col-span-9 space-y-2">
                  <Label>Nome do Grupo *</Label>
                  <Input 
                    value={formData.nome || ""} 
                    onChange={e => setFormData({...formData, nome: e.target.value})}
                    placeholder="Ex: Soldadores Administrativo"
                  />
                </div>
                <div className="col-span-12 space-y-2">
                  <Label>Critério de Agrupamento</Label>
                  <Textarea 
                    value={formData.criterio_agrupamento || formData.descricao || ""} 
                    onChange={e => setFormData({...formData, criterio_agrupamento: e.target.value})}
                    placeholder="Por que esses trabalhadores estão agrupados?"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* BINDINGS PANEL */}
            <div className="flex-1 flex flex-col bg-slate-50 p-5 overflow-hidden">
              <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-slate-500" />
                Funções Pertencentes a este Grupo
              </h4>
              <p className="text-sm text-slate-500 mb-4">
                Selecione as funções da Estrutura Ocupacional que farão parte deste GES. Todos os trabalhadores nestas funções herdarão os riscos do GES.
              </p>

              <div className="relative mb-4">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <Input 
                  placeholder="Buscar função por nome ou CBO..." 
                  className="pl-9"
                  value={searchFuncao}
                  onChange={e => setSearchFuncao(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-y-auto border rounded-md bg-white">
                {funcoesFiltradas.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    Nenhuma função encontrada. Crie funções na aba "Estrutura".
                  </div>
                ) : (
                  <div className="divide-y">
                    {funcoesFiltradas.map(func => {
                      const isSelected = selectedFuncoes.includes(func.id);
                      return (
                        <div 
                          key={func.id} 
                          className={`flex items-center p-3 hover:bg-slate-50 cursor-pointer ${isSelected ? "bg-indigo-50/50" : ""}`}
                          onClick={() => handleToggleFuncao(func.id)}
                        >
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => handleToggleFuncao(func.id)}
                            className="mr-4"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm text-slate-800">{func.nome}</div>
                            <div className="text-xs text-slate-500">CBO: {func.cbo || "N/A"}</div>
                          </div>
                          {isSelected && (
                            <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                              Vinculado
                            </Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
