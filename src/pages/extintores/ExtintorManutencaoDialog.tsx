import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Wrench } from "lucide-react";
import { isTableMissingError, salvarManutencaoLocal } from "@/lib/extintoresStorageFallback";

interface ExtintorManutencaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extintor: any;
  onSuccess: () => void;
}

export function ExtintorManutencaoDialog({ open, onOpenChange, extintor, onSuccess }: ExtintorManutencaoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState("RECARGA");
  const [dataManutencao, setDataManutencao] = useState(new Date().toISOString().slice(0, 10));
  const [validadeEtiqueta, setValidadeEtiqueta] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [proximoTh, setProximoTh] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 5);
    return d.toISOString().slice(0, 10);
  });
  const [empresaPrestadora, setEmpresaPrestadora] = useState("");
  const [cnpjPrestadora, setCnpjPrestadora] = useState("");
  const [numeroOs, setNumeroOs] = useState("");
  const [seloInmetro, setSeloInmetro] = useState("");
  const [custo, setCusto] = useState("");
  const [observacoes, setObservacoes] = useState("");

  if (!extintor) return null;

  const handleTipoChange = (val: string) => {
    setTipo(val);
    const d = new Date(dataManutencao);
    if (val === "RECARGA") {
      d.setFullYear(d.getFullYear() + 1);
      setValidadeEtiqueta(d.toISOString().slice(0, 10));
    } else if (val === "TESTE_HIDROSTATICO") {
      d.setFullYear(d.getFullYear() + 1);
      setValidadeEtiqueta(d.toISOString().slice(0, 10));
      const th = new Date(dataManutencao);
      th.setFullYear(th.getFullYear() + 5);
      setProximoTh(th.toISOString().slice(0, 10));
    }
  };

  const handleSalvar = async () => {
    setLoading(true);
    const payload: any = {
      extintor_id: extintor.id,
      empresa_id: extintor.empresa_id,
      tipo,
      data_manutencao: dataManutencao,
      data_validade_etiqueta: tipo === "BAIXA" ? null : validadeEtiqueta,
      empresa_prestadora: empresaPrestadora.trim() || null,
      cnpj_prestadora: cnpjPrestadora.trim() || null,
      numero_os: numeroOs.trim() || null,
      selo_inmetro: seloInmetro.trim() || null,
      custo: custo ? parseFloat(custo) : null,
      observacoes: observacoes.trim() || null,
    };

    const extUpdate: any = {};
    if (tipo === "RECARGA") {
      extUpdate.data_ultima_recarga = dataManutencao;
      extUpdate.data_proxima_recarga = validadeEtiqueta;
      extUpdate.status = "ATIVO";
      if (seloInmetro) extUpdate.selo_inmetro = seloInmetro;
    } else if (tipo === "TESTE_HIDROSTATICO") {
      extUpdate.data_ultima_recarga = dataManutencao;
      extUpdate.data_proxima_recarga = validadeEtiqueta;
      extUpdate.data_ultimo_teste_hidrostatico = dataManutencao;
      extUpdate.data_proximo_teste_hidrostatico = proximoTh;
      extUpdate.status = "ATIVO";
      if (seloInmetro) extUpdate.selo_inmetro = seloInmetro;
    } else if (tipo === "BAIXA") {
      extUpdate.status = "BAIXADO";
    }

    try {
      // 1. Registra manutenção na tabela extintor_manutencoes
      const { error: manErr } = await (supabase.from as any)("extintor_manutencoes").insert(payload);
      if (manErr) throw manErr;

      // 2. Atualiza status e datas no extintor
      await (supabase.from as any)("extintores")
        .update(extUpdate)
        .eq("id", extintor.id);

      toast({
        title: "Manutenção registrada com sucesso",
        description: `Extintor ${extintor.numero} atualizado com novo prazo de validade.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      if (isTableMissingError(err)) {
        salvarManutencaoLocal(extintor.empresa_id, payload, extUpdate);
        toast({
          title: "Manutenção registrada (Local)",
          description: `Extintor ${extintor.numero} atualizado com sucesso.`,
        });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({
          title: "Erro ao registrar manutenção",
          description: err.message || "Falha ao gravar manutenção.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[92vh] p-3.5 sm:p-6 overflow-y-auto rounded-xl sm:rounded-2xl">
        <DialogHeader className="pb-1 border-b">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Lançar Manutenção · TAG {extintor.numero}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                {extintor.agente?.replace(/_/g, " ")} · {extintor.capacidade} {extintor.unidade_capacidade} · Setor: {extintor.local_setor || "Geral"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 py-2">
          <div className="sm:col-span-2">
            <Label htmlFor="man-tipo" className="text-xs font-semibold">Tipo de Manutenção</Label>
            <Select value={tipo} onValueChange={handleTipoChange}>
              <SelectTrigger id="man-tipo" className="h-11 sm:h-10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RECARGA">Recarga Anual (2º Nível)</SelectItem>
                <SelectItem value="TESTE_HIDROSTATICO">Teste Hidrostático Quinquenal (3º Nível)</SelectItem>
                <SelectItem value="CORRETIVA">Manutenção Corretiva (Válvula, Mangueira, Pintura)</SelectItem>
                <SelectItem value="BAIXA">Baixa Definitiva (Descarte / Condenado)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="man-data" className="text-xs font-semibold">Data do Serviço</Label>
            <Input
              id="man-data"
              type="date"
              className="h-11 sm:h-10 text-sm"
              value={dataManutencao}
              onChange={(e) => setDataManutencao(e.target.value)}
            />
          </div>

          {tipo !== "BAIXA" && (
            <div>
              <Label htmlFor="man-validade" className="text-xs font-semibold">Nova Validade da Recarga</Label>
              <Input
                id="man-validade"
                type="date"
                className="h-11 sm:h-10 text-sm"
                value={validadeEtiqueta}
                onChange={(e) => setValidadeEtiqueta(e.target.value)}
              />
            </div>
          )}

          {tipo === "TESTE_HIDROSTATICO" && (
            <div>
              <Label htmlFor="man-th" className="text-xs font-semibold">Próximo Teste Hidrostático (5 anos)</Label>
              <Input
                id="man-th"
                type="date"
                className="h-11 sm:h-10 text-sm"
                value={proximoTh}
                onChange={(e) => setProximoTh(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="man-selo" className="text-xs font-semibold">Novo Selo Inmetro</Label>
            <Input
              id="man-selo"
              placeholder="Ex: 009876/2026"
              className="h-11 sm:h-10 text-sm"
              value={seloInmetro}
              onChange={(e) => setSeloInmetro(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="man-empresa" className="text-xs font-semibold">Empresa Prestadora Credenciada</Label>
            <Input
              id="man-empresa"
              placeholder="Ex: Soluções Contra Incêndio Ltda"
              className="h-11 sm:h-10 text-sm"
              value={empresaPrestadora}
              onChange={(e) => setEmpresaPrestadora(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="man-os" className="text-xs font-semibold">Nº da Ordem de Serviço (OS)</Label>
            <Input
              id="man-os"
              placeholder="Ex: OS-4589"
              className="h-11 sm:h-10 text-sm"
              value={numeroOs}
              onChange={(e) => setNumeroOs(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="man-custo" className="text-xs font-semibold">Custo Total (R$)</Label>
            <Input
              id="man-custo"
              type="number"
              step="0.01"
              placeholder="0,00"
              className="h-11 sm:h-10 text-sm"
              value={custo}
              onChange={(e) => setCusto(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="man-obs" className="text-xs font-semibold">Observações do Serviço</Label>
            <Textarea
              id="man-obs"
              placeholder="Relatório de itens trocados, laudos ou observações..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto h-11 sm:h-10 text-sm"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={loading}
            className="w-full sm:w-auto h-11 sm:h-10 text-sm font-bold bg-primary text-primary-foreground shadow-sm"
          >
            {loading ? "Gravando..." : "Salvar Registro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
