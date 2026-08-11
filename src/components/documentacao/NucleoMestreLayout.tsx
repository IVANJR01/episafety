import React, { useState } from "react";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, Building2, Home, LayoutGrid, Workflow, Briefcase, ChevronRight, ChevronDown } from "lucide-react";
import { FormEstabelecimento } from "./forms/FormEstabelecimento";
import { FormAmbiente } from "./forms/FormAmbiente";
import { FormSetor } from "./forms/FormSetor";
import { FormProcesso } from "./forms/FormProcesso";
import { FormFuncao } from "./forms/FormFuncao";
import { Button } from "@/components/ui/button";

export function NucleoMestreLayout() {
  const {
    estabelecimentos,
    ambientes,
    setores,
    processos,
    funcoes,
    isLoading,
    saveEstabelecimento,
    saveAmbiente,
    saveSetor,
    saveProcesso,
    saveFuncao
  } = useNucleoMestreSst();

  const [activeNode, setActiveNode] = useState<{type: "estabelecimento" | "ambiente" | "setor" | "processo" | "funcao", id: string} | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  
  // Modal / Form state
  const [formData, setFormData] = useState<any>({});
  const [formType, setFormType] = useState<"estabelecimento" | "ambiente" | "setor" | "processo" | "funcao" | null>(null);

  const toggleNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectNode = (type: any, id: string) => {
    setActiveNode({ type, id });
    let item;
    if (type === "estabelecimento") item = estabelecimentos.find(e => e.id === id);
    if (type === "ambiente") item = ambientes.find(e => e.id === id);
    if (type === "setor") item = setores.find(e => e.id === id);
    if (type === "processo") item = processos.find(e => e.id === id);
    if (type === "funcao") item = funcoes.find(e => e.id === id);
    setFormData(item || {});
    setFormType(type);
  };

  const handleCreateNew = (type: "estabelecimento" | "ambiente" | "setor" | "processo" | "funcao", parentId?: string) => {
    setFormType(type);
    let initialData = {};
    if (type === "ambiente" && parentId) initialData = { estabelecimento_id: parentId };
    if (type === "setor" && parentId) initialData = { ambiente_id: parentId };
    if (type === "processo" && parentId) initialData = { setor_id: parentId };
    if (type === "funcao" && parentId) {
      // Determine if parent is setor or processo
      const isProcesso = processos.find(p => p.id === parentId);
      if (isProcesso) {
        initialData = { processo_id: parentId, setor_id: isProcesso.setor_id };
      } else {
        initialData = { setor_id: parentId };
      }
    }
    setFormData(initialData);
  };

  const handleSaveForm = async () => {
    try {
      if (formType === "estabelecimento") await saveEstabelecimento(formData);
      if (formType === "ambiente") await saveAmbiente(formData);
      if (formType === "setor") await saveSetor(formData);
      if (formType === "processo") await saveProcesso(formData);
      if (formType === "funcao") await saveFuncao(formData);
      
      // Keep it open to show saved state
      setFormData({...formData}); 
      // Could also show a success toast here
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-2 text-indigo-600" />
        <span>Carregando Estrutura Ocupacional...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[800px]">
      {/* TREE VIEW PANEL */}
      <Card className="col-span-1 md:col-span-4 p-4 overflow-y-auto bg-slate-50 border-slate-200">
        <div className="flex items-center justify-between mb-4 border-b pb-2">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Árvore da Empresa
          </h3>
          <Button variant="ghost" size="sm" onClick={() => handleCreateNew("estabelecimento")} className="h-7 px-2 text-xs text-indigo-600 hover:bg-indigo-50">
            <Plus className="w-3 h-3 mr-1" /> Estabelecimento
          </Button>
        </div>

        <div className="space-y-1">
          {estabelecimentos.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-4">Nenhuma estrutura cadastrada. Comece criando um estabelecimento.</div>
          )}

          {estabelecimentos.map(est => {
            const isEstExpanded = expandedNodes[est.id];
            const ambs = ambientes.filter(a => a.estabelecimento_id === est.id || (!a.estabelecimento_id && est.tipo === 'proprio'));
            
            return (
              <div key={est.id} className="text-sm">
                <div 
                  className={`flex items-center p-1.5 rounded cursor-pointer hover:bg-slate-200 ${activeNode?.id === est.id ? 'bg-indigo-100 text-indigo-900 font-medium' : 'text-slate-700'}`}
                  onClick={() => handleSelectNode("estabelecimento", est.id)}
                >
                  <span onClick={(e) => toggleNode(est.id, e)} className="mr-1 w-4 h-4 flex items-center justify-center text-slate-400">
                    {ambs.length > 0 ? (isEstExpanded ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>) : null}
                  </span>
                  <Building2 className="w-4 h-4 mr-2 text-slate-500" />
                  <span className="truncate">{est.nome}</span>
                </div>

                {isEstExpanded && (
                  <div className="ml-5 border-l border-slate-300 pl-2 mt-1 space-y-1">
                    {ambs.map(amb => {
                      const isAmbExpanded = expandedNodes[amb.id];
                      const sets = setores.filter(s => s.ambiente_id === amb.id);
                      
                      return (
                        <div key={amb.id}>
                          <div 
                            className={`flex items-center p-1.5 rounded cursor-pointer hover:bg-slate-200 ${activeNode?.id === amb.id ? 'bg-indigo-100 text-indigo-900 font-medium' : 'text-slate-700'}`}
                            onClick={() => handleSelectNode("ambiente", amb.id)}
                          >
                            <span onClick={(e) => toggleNode(amb.id, e)} className="mr-1 w-4 h-4 flex items-center justify-center text-slate-400">
                              {sets.length > 0 ? (isAmbExpanded ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>) : null}
                            </span>
                            <Home className="w-3.5 h-3.5 mr-2 text-slate-500" />
                            <span className="truncate">{amb.nome}</span>
                          </div>

                          {isAmbExpanded && (
                            <div className="ml-5 border-l border-slate-300 pl-2 mt-1 space-y-1">
                              {sets.map(setor => {
                                const isSetorExpanded = expandedNodes[setor.id];
                                const procs = processos.filter(p => p.setor_id === setor.id);
                                const funcs = funcoes.filter(f => f.setor_id === setor.id && !f.processo_id);

                                return (
                                  <div key={setor.id}>
                                    <div 
                                      className={`flex items-center p-1.5 rounded cursor-pointer hover:bg-slate-200 ${activeNode?.id === setor.id ? 'bg-indigo-100 text-indigo-900 font-medium' : 'text-slate-700'}`}
                                      onClick={() => handleSelectNode("setor", setor.id)}
                                    >
                                      <span onClick={(e) => toggleNode(setor.id, e)} className="mr-1 w-4 h-4 flex items-center justify-center text-slate-400">
                                        {(procs.length > 0 || funcs.length > 0) ? (isSetorExpanded ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>) : null}
                                      </span>
                                      <LayoutGrid className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                      <span className="truncate">{setor.nome}</span>
                                    </div>

                                    {isSetorExpanded && (
                                      <div className="ml-5 border-l border-slate-300 pl-2 mt-1 space-y-1">
                                        {/* Processos do Setor */}
                                        {procs.map(proc => {
                                          const isProcExpanded = expandedNodes[proc.id];
                                          const funcsProc = funcoes.filter(f => f.processo_id === proc.id);
                                          
                                          return (
                                            <div key={proc.id}>
                                              <div 
                                                className={`flex items-center p-1.5 rounded cursor-pointer hover:bg-slate-200 ${activeNode?.id === proc.id ? 'bg-indigo-100 text-indigo-900 font-medium' : 'text-slate-700'}`}
                                                onClick={() => handleSelectNode("processo", proc.id)}
                                              >
                                                <span onClick={(e) => toggleNode(proc.id, e)} className="mr-1 w-4 h-4 flex items-center justify-center text-slate-400">
                                                  {funcsProc.length > 0 ? (isProcExpanded ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>) : null}
                                                </span>
                                                <Workflow className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                                <span className="truncate">{proc.nome}</span>
                                              </div>

                                              {/* Funções do Processo */}
                                              {isProcExpanded && funcsProc.map(func => (
                                                <div 
                                                  key={func.id}
                                                  className={`flex items-center p-1.5 ml-5 rounded cursor-pointer hover:bg-slate-200 ${activeNode?.id === func.id ? 'bg-indigo-100 text-indigo-900 font-medium' : 'text-slate-700'}`}
                                                  onClick={() => handleSelectNode("funcao", func.id)}
                                                >
                                                  <Briefcase className="w-3 h-3 mr-2 text-slate-400" />
                                                  <span className="truncate">{func.nome}</span>
                                                </div>
                                              ))}
                                              <div className="ml-5 p-1">
                                                <Button variant="ghost" size="sm" onClick={() => handleCreateNew("funcao", proc.id)} className="h-6 px-2 text-[10px] text-slate-400 hover:text-indigo-600">
                                                  <Plus className="w-3 h-3 mr-1" /> Função
                                                </Button>
                                              </div>
                                            </div>
                                          )
                                        })}
                                        
                                        {/* Funções diretas do Setor */}
                                        {funcs.map(func => (
                                          <div 
                                            key={func.id}
                                            className={`flex items-center p-1.5 rounded cursor-pointer hover:bg-slate-200 ${activeNode?.id === func.id ? 'bg-indigo-100 text-indigo-900 font-medium' : 'text-slate-700'}`}
                                            onClick={() => handleSelectNode("funcao", func.id)}
                                          >
                                            <span className="mr-1 w-4 h-4"></span>
                                            <Briefcase className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                            <span className="truncate">{func.nome}</span>
                                          </div>
                                        ))}

                                        <div className="p-1 flex gap-2">
                                          <Button variant="ghost" size="sm" onClick={() => handleCreateNew("processo", setor.id)} className="h-6 px-2 text-[10px] text-slate-400 hover:text-indigo-600">
                                            <Plus className="w-3 h-3 mr-1" /> Processo
                                          </Button>
                                          <Button variant="ghost" size="sm" onClick={() => handleCreateNew("funcao", setor.id)} className="h-6 px-2 text-[10px] text-slate-400 hover:text-indigo-600">
                                            <Plus className="w-3 h-3 mr-1" /> Função
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                              <div className="p-1">
                                <Button variant="ghost" size="sm" onClick={() => handleCreateNew("setor", amb.id)} className="h-6 px-2 text-[10px] text-slate-400 hover:text-indigo-600">
                                  <Plus className="w-3 h-3 mr-1" /> Setor
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <div className="p-1">
                      <Button variant="ghost" size="sm" onClick={() => handleCreateNew("ambiente", est.id)} className="h-6 px-2 text-[10px] text-slate-400 hover:text-indigo-600">
                        <Plus className="w-3 h-3 mr-1" /> Ambiente
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        {/* Outphan nodes if any (Funções/Setores sem pai) */}
        {/* Simplified for now */}
      </Card>

      {/* FORM PANEL */}
      <Card className="col-span-1 md:col-span-8 p-6 overflow-y-auto">
        {!formType ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
            <LayoutGrid className="w-12 h-12 text-slate-200" />
            <p>Selecione um item na árvore para editar ou clique no [+] para adicionar um novo.</p>
          </div>
        ) : (
          <div>
            {formType === "estabelecimento" && (
              <FormEstabelecimento formData={formData} setFormData={setFormData} onSave={handleSaveForm} onCancel={() => setFormType(null)} />
            )}
            {formType === "ambiente" && (
              <FormAmbiente formData={formData} setFormData={setFormData} onSave={handleSaveForm} onCancel={() => setFormType(null)} estabelecimentos={estabelecimentos} />
            )}
            {formType === "setor" && (
              <FormSetor formData={formData} setFormData={setFormData} onSave={handleSaveForm} onCancel={() => setFormType(null)} ambientes={ambientes} />
            )}
            {formType === "processo" && (
              <FormProcesso formData={formData} setFormData={setFormData} onSave={handleSaveForm} onCancel={() => setFormType(null)} setores={setores} />
            )}
            {formType === "funcao" && (
              <FormFuncao formData={formData} setFormData={setFormData} onSave={handleSaveForm} onCancel={() => setFormType(null)} setores={setores} processos={processos} />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
