import React, { useState } from "react";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, ShieldAlert } from "lucide-react";
import { FormExposicaoDialog } from "./forms/FormExposicaoDialog";

export function ExposicoesMestreTab() {
  const {
    exposicoes,
    estabelecimentos,
    ambientes,
    setores,
    processos,
    gesList,
    funcoes,
    perigosCatalogo,
    saveExposicao,
  } = useNucleoMestreSst();

  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const handleOpenNew = () => {
    setFormData({
      nivel_origem: "ges",
      severidade: 1,
      probabilidade: 1,
      epi_eficacia_conclusao: "nao_avaliada"
    });
    setOpenModal(true);
  };

  const handleOpenEdit = (exp: any) => {
    setFormData(exp);
    setOpenModal(true);
  };

  const handleSave = async () => {
    try {
      await saveExposicao(formData);
      // The modal closes itself via onOpenChange or we could do it here
      setOpenModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Helper to resolve names
  const getOriginName = (exp: any) => {
    if (exp.nivel_origem === "ges" && exp.ges_id) {
      const g = gesList.find(x => x.id === exp.ges_id);
      return g ? `GES: ${g.nome}` : "GES Desconhecido";
    }
    if (exp.nivel_origem === "funcao" && exp.funcao_id) {
      const f = funcoes.find(x => x.id === exp.funcao_id);
      return f ? `Função: ${f.nome}` : "Função Desconhecida";
    }
    return "Não vinculado";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            Matriz Mestre de Riscos Ocupacionais (PGR / LTCAT)
          </h3>
          <p className="text-sm text-slate-500">
            Esta é a visão central de todos os riscos e controles mapeados na empresa.
          </p>
        </div>
        <Button onClick={handleOpenNew} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" /> Avaliar Novo Risco
        </Button>
      </div>

      <div className="border border-slate-200 rounded-lg shadow-sm bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="text-xs border-collapse min-w-[1200px]">
            <TableHeader>
              <TableRow className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <TableHead className="w-[200px] border-r">Nível / Origem</TableHead>
                <TableHead className="w-[150px] border-r">Perigo / Agente</TableHead>
                <TableHead className="w-[200px] border-r">Fonte Geradora</TableHead>
                <TableHead className="w-[100px] border-r text-center">Tipo Exp.</TableHead>
                <TableHead className="w-[80px] border-r text-center">P x S</TableHead>
                <TableHead className="w-[120px] border-r text-center">Risco (GRO)</TableHead>
                <TableHead className="w-[200px] border-r text-center">Controles (EPI/EPC)</TableHead>
                <TableHead className="w-[80px] text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exposicoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    Nenhum risco avaliado nesta empresa. Clique em "Avaliar Novo Risco" para iniciar o inventário.
                  </TableCell>
                </TableRow>
              ) : (
                exposicoes.map((exp: any) => {
                  const prob = exp.probabilidade || 1;
                  const sev = exp.severidade || 1;
                  const total = prob * sev;
                  let classif = "Baixo";
                  let classifColor = "bg-emerald-100 text-emerald-800 border-emerald-300";
                  if (total >= 15) {
                    classif = "Alto";
                    classifColor = "bg-red-100 text-red-800 border-red-300";
                  } else if (total >= 8) {
                    classif = "Moderado";
                    classifColor = "bg-amber-100 text-amber-800 border-amber-300";
                  }

                  return (
                    <TableRow key={exp.id} className="hover:bg-slate-50 border-b border-slate-200">
                      <TableCell className="border-r border-slate-200 font-medium text-slate-700 p-3">
                        <Badge variant="outline" className={exp.nivel_origem === 'ges' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-700'}>
                          {getOriginName(exp)}
                        </Badge>
                      </TableCell>
                      <TableCell className="border-r border-slate-200 p-3">
                        {/* Try to get agent name from catalog if needed, or fallback to perigo_descricao from legacy */}
                        <span className="font-semibold">{exp.agente_categoria || exp.fonte_geradora || "Perigo"}</span>
                      </TableCell>
                      <TableCell className="border-r border-slate-200 p-3 text-slate-600">
                        {exp.fonte_geradora || "-"}
                      </TableCell>
                      <TableCell className="border-r border-slate-200 p-3 text-center">
                        {exp.tipo_exposicao === 'habitual_permanente' ? 'Habitual' : 
                         exp.tipo_exposicao === 'intermitente' ? 'Intermitente' : 'Eventual'}
                      </TableCell>
                      <TableCell className="border-r border-slate-200 p-3 text-center font-bold text-slate-700">
                        {prob} x {sev}
                      </TableCell>
                      <TableCell className="border-r border-slate-200 p-3 text-center">
                        <Badge variant="outline" className={`font-bold ${classifColor}`}>
                          {total} - {classif}
                        </Badge>
                      </TableCell>
                      <TableCell className="border-r border-slate-200 p-3 text-center">
                        {exp.epi_nome ? <span className="text-emerald-700 font-medium">EPI: {exp.epi_nome}</span> : <span className="text-slate-400">N.A</span>}
                      </TableCell>
                      <TableCell className="p-3 text-center">
                        <Button onClick={() => handleOpenEdit(exp)} variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Edit2 className="w-4 h-4 text-slate-500" />
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

      <FormExposicaoDialog 
        open={openModal}
        onOpenChange={setOpenModal}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSave}
        estabelecimentos={estabelecimentos}
        ambientes={ambientes}
        setores={setores}
        processos={processos}
        gesList={gesList}
        funcoes={funcoes}
        perigosCatalogo={perigosCatalogo}
      />
    </div>
  );
}
