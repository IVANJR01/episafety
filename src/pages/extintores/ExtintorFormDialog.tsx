import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  carregarSetores,
  carregarLocais,
  carregarFabricantes,
  cadastrarItemApoio,
} from "@/lib/extintoresApoioService";
import {
  isTableMissingError,
  salvarExtintorLocal,
} from "@/lib/extintoresStorageFallback";

interface ExtintorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  extintor?: any | null;
  onSuccess: () => void;
}

const AGENTES = [
  { value: "PQS_ABC", label: "Pó Químico Seco ABC (PQS ABC)" },
  { value: "PQS_BC", label: "Pó Químico Seco BC (PQS BC)" },
  { value: "CO2", label: "Gás Carbônico (CO2)" },
  { value: "AGUA", label: "Água Pressurizada (AP)" },
  { value: "ESPUMA", label: "Espuma Mecânica" },
  { value: "CLASSE_K", label: "Classe K (Cozinhas Industriais)" },
  { value: "CLASSE_D", label: "Classe D (Metais Pirofóricos)" },
];

export function ExtintorFormDialog({ open, onOpenChange, empresaId, extintor, onSuccess }: ExtintorFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [numero, setNumero] = useState("");
  const [agente, setAgente] = useState("PQS_ABC");
  const [capacidade, setCapacidade] = useState("6");
  const [unidadeCapacidade, setUnidadeCapacidade] = useState("kg");
  const [fabricante, setFabricante] = useState("");
  const [numeroCilindro, setNumeroCilindro] = useState("");
  const [anoFabricacao, setAnoFabricacao] = useState("");
  const [seloInmetro, setSeloInmetro] = useState("");
  const [localSetor, setLocalSetor] = useState("");
  const [localDescricao, setLocalDescricao] = useState("");
  const [status, setStatus] = useState("ATIVO");
  const [dataUltimaRecarga, setDataUltimaRecarga] = useState("");
  const [dataProximaRecarga, setDataProximaRecarga] = useState("");
  const [dataUltimoTh, setDataUltimoTh] = useState("");
  const [dataProximoTh, setDataProximoTh] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Listas de sugestões cadastradas
  const [listaSetores, setListaSetores] = useState<string[]>([]);
  const [listaLocais, setListaLocais] = useState<string[]>([]);
  const [listaFabricantes, setListaFabricantes] = useState<string[]>([]);

  useEffect(() => {
    if (open && empresaId) {
      Promise.all([
        carregarSetores(empresaId),
        carregarLocais(empresaId),
        carregarFabricantes(empresaId),
      ]).then(([s, l, f]) => {
        setListaSetores(s);
        setListaLocais(l);
        setListaFabricantes(f);
      });
    }
  }, [open, empresaId]);

  useEffect(() => {
    if (extintor) {
      setNumero(extintor.numero || "");
      setAgente(extintor.agente || "PQS_ABC");
      setCapacidade(String(extintor.capacidade || "6"));
      setUnidadeCapacidade(extintor.unidade_capacidade || "kg");
      setFabricante(extintor.fabricante || "");
      setNumeroCilindro(extintor.numero_cilindro || "");
      setAnoFabricacao(extintor.ano_fabricacao ? String(extintor.ano_fabricacao) : "");
      setSeloInmetro(extintor.selo_inmetro || "");
      setLocalSetor(extintor.local_setor || "");
      setLocalDescricao(extintor.local_descricao || "");
      setStatus(extintor.status || "ATIVO");
      setDataUltimaRecarga(extintor.data_ultima_recarga || "");
      setDataProximaRecarga(extintor.data_proxima_recarga || "");
      setDataUltimoTh(extintor.data_ultimo_teste_hidrostatico || "");
      setDataProximoTh(extintor.data_proximo_teste_hidrostatico || "");
      setObservacoes(extintor.observacoes || "");
    } else {
      setNumero("");
      setAgente("PQS_ABC");
      setCapacidade("6");
      setUnidadeCapacidade("kg");
      setFabricante("");
      setNumeroCilindro("");
      setAnoFabricacao(String(new Date().getFullYear()));
      setSeloInmetro("");
      setLocalSetor("");
      setLocalDescricao("");
      setStatus("ATIVO");
      setDataUltimaRecarga("");
      setDataProximaRecarga("");
      setDataUltimoTh("");
      setDataProximoTh("");
      setObservacoes("");
    }
  }, [extintor, open]);

  // Se o agente for Água ou Espuma, sugere unidade "L"
  const handleAgenteChange = (val: string) => {
    setAgente(val);
    if (val === "AGUA" || val === "ESPUMA") {
      setUnidadeCapacidade("L");
      if (capacidade === "6" || capacidade === "4") setCapacidade("10");
    } else {
      setUnidadeCapacidade("kg");
      if (capacidade === "10") setCapacidade("6");
    }
  };

  const handleSalvar = async () => {
    if (!numero.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe o número / TAG do extintor.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        empresa_id: empresaId,
        numero: numero.trim().toUpperCase(),
        agente,
        capacidade: parseFloat(capacidade) || 0,
        unidade_capacidade: unidadeCapacidade,
        fabricante: fabricante.trim() || null,
        numero_cilindro: numeroCilindro.trim() || null,
        ano_fabricacao: anoFabricacao ? parseInt(anoFabricacao, 10) : null,
        selo_inmetro: seloInmetro.trim() || null,
        local_setor: localSetor.trim() || null,
        local_descricao: localDescricao.trim() || null,
        status,
        data_ultima_recarga: dataUltimaRecarga || null,
        data_proxima_recarga: dataProximaRecarga || null,
        data_ultimo_teste_hidrostatico: dataUltimoTh || null,
        data_proximo_teste_hidrostatico: dataProximoTh || null,
        observacoes: observacoes.trim() || null,
      };

      // Cadastra automaticamente na lista de apoio para reuso futuro
      if (payload.local_setor) cadastrarItemApoio(empresaId, "SETOR", payload.local_setor);
      if (payload.local_descricao) cadastrarItemApoio(empresaId, "LOCAL", payload.local_descricao);
      if (payload.fabricante) cadastrarItemApoio(empresaId, "FABRICANTE", payload.fabricante);

      if (extintor?.id) {
        const { error } = await (supabase.from as any)("extintores")
          .update(payload)
          .eq("id", extintor.id);

        if (error) {
          if (isTableMissingError(error)) {
            salvarExtintorLocal(empresaId, { ...payload, id: extintor.id });
            toast({
              title: "Extintor atualizado",
              description: `TAG ${payload.numero} salva com sucesso.`,
            });
            onSuccess();
            onOpenChange(false);
            return;
          }
          throw error;
        }

        toast({ title: "Extintor atualizado", description: `TAG ${payload.numero} salva com sucesso.` });
      } else {
        const { error } = await (supabase.from as any)("extintores")
          .insert(payload);

        if (error) {
          if (isTableMissingError(error)) {
            salvarExtintorLocal(empresaId, payload);
            toast({
              title: "Extintor cadastrado",
              description: `TAG ${payload.numero} salva com sucesso.`,
            });
            onSuccess();
            onOpenChange(false);
            return;
          }
          throw error;
        }

        toast({ title: "Extintor cadastrado", description: `TAG ${payload.numero} criada com sucesso.` });
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      // Fallback em caso de erro de rede ou tabela ausente
      if (isTableMissingError(err)) {
        salvarExtintorLocal(empresaId, {
          empresa_id: empresaId,
          numero: numero.trim().toUpperCase(),
          agente,
          capacidade: parseFloat(capacidade) || 0,
          unidade_capacidade: unidadeCapacidade,
          fabricante: fabricante.trim() || null,
          local_setor: localSetor.trim() || null,
          local_descricao: localDescricao.trim() || null,
          status,
          data_proxima_recarga: dataProximaRecarga || null,
          data_proximo_teste_hidrostatico: dataProximoTh || null,
          selo_inmetro: seloInmetro.trim() || null,
          observacoes: observacoes.trim() || null,
          id: extintor?.id,
        });
        toast({
          title: "Extintor cadastrado",
          description: `TAG ${numero.trim().toUpperCase()} salva com sucesso.`,
        });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({
          title: "Erro ao salvar extintor",
          description: err.message || "Verifique os dados informados.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[94vh] sm:max-h-[90vh] p-3.5 sm:p-6 overflow-y-auto rounded-xl sm:rounded-2xl">
        <DialogHeader className="pb-1 border-b">
          <DialogTitle className="text-lg sm:text-xl font-bold">
            {extintor ? `Editar Extintor ${extintor.numero}` : "Novo Extintor (NR-23)"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 py-2">
          {/* TAG / PATRIMÔNIO */}
          <div>
            <Label htmlFor="ext-numero" className="text-xs font-semibold">TAG / Patrimônio *</Label>
            <Input
              id="ext-numero"
              placeholder="Ex: EXT-01, PQS-05"
              className="h-11 sm:h-10 text-sm"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
          </div>

          {/* STATUS OPERACIONAL */}
          <div>
            <Label htmlFor="ext-status" className="text-xs font-semibold">Status Operacional</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="ext-status" className="h-11 sm:h-10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ATIVO">🟢 Ativo (Em uso)</SelectItem>
                <SelectItem value="EM_MANUTENCAO">🟡 Em Manutenção / Recarga</SelectItem>
                <SelectItem value="RESERVA">🔵 Reserva Técnica</SelectItem>
                <SelectItem value="BAIXADO">⚫ Baixado (Descartado)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* AGENTE EXTINTOR */}
          <div>
            <Label htmlFor="ext-agente" className="text-xs font-semibold">Agente Extintor *</Label>
            <Select value={agente} onValueChange={handleAgenteChange}>
              <SelectTrigger id="ext-agente" className="h-11 sm:h-10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENTES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CAPACIDADE E UNIDADE */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="ext-capacidade" className="text-xs font-semibold">Capacidade</Label>
              <Input
                id="ext-capacidade"
                type="number"
                step="0.5"
                className="h-11 sm:h-10 text-sm"
                value={capacidade}
                onChange={(e) => setCapacidade(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ext-unidade" className="text-xs font-semibold">Unidade</Label>
              <Select value={unidadeCapacidade} onValueChange={setUnidadeCapacidade}>
                <SelectTrigger id="ext-unidade" className="h-11 sm:h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg (Pó / Gás)</SelectItem>
                  <SelectItem value="L">L (Líquido)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* SETOR / ÁREA (CAMPO ÚNICO COM AUTOCOMPLETE) */}
          <div>
            <Label htmlFor="ext-setor" className="text-xs font-semibold">Setor / Área</Label>
            <Input
              id="ext-setor"
              list="ext-setores-datalist"
              placeholder="Selecione ou digite o setor (ex: Costura)"
              className="h-11 sm:h-10 text-sm"
              value={localSetor}
              onChange={(e) => setLocalSetor(e.target.value)}
            />
            <datalist id="ext-setores-datalist">
              {listaSetores.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* LOCALIZAÇÃO ESPECÍFICA (CAMPO ÚNICO COM AUTOCOMPLETE) */}
          <div>
            <Label htmlFor="ext-local-desc" className="text-xs font-semibold">Localização Específica</Label>
            <Input
              id="ext-local-desc"
              list="ext-locais-datalist"
              placeholder="Selecione ou digite o local (ex: Coluna B)"
              className="h-11 sm:h-10 text-sm"
              value={localDescricao}
              onChange={(e) => setLocalDescricao(e.target.value)}
            />
            <datalist id="ext-locais-datalist">
              {listaLocais.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>

          {/* PRÓXIMA RECARGA */}
          <div>
            <Label htmlFor="ext-recarga" className="text-xs font-semibold">Próxima Recarga (Anual)</Label>
            <Input
              id="ext-recarga"
              type="date"
              className="h-11 sm:h-10 text-sm"
              value={dataProximaRecarga}
              onChange={(e) => setDataProximaRecarga(e.target.value)}
            />
          </div>

          {/* PRÓXIMO TESTE HIDROSTÁTICO */}
          <div>
            <Label htmlFor="ext-th" className="text-xs font-semibold">Próximo Teste Hidrostático (5 anos)</Label>
            <Input
              id="ext-th"
              type="date"
              className="h-11 sm:h-10 text-sm"
              value={dataProximoTh}
              onChange={(e) => setDataProximoTh(e.target.value)}
            />
          </div>

          {/* FABRICANTE / MARCA (CAMPO ÚNICO COM AUTOCOMPLETE) */}
          <div>
            <Label htmlFor="ext-fabricante" className="text-xs font-semibold">Fabricante / Marca</Label>
            <Input
              id="ext-fabricante"
              list="ext-fabricantes-datalist"
              placeholder="Selecione ou digite a marca (ex: Kidde, Flamac)"
              className="h-11 sm:h-10 text-sm"
              value={fabricante}
              onChange={(e) => setFabricante(e.target.value)}
            />
            <datalist id="ext-fabricantes-datalist">
              {listaFabricantes.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>

          {/* SELO INMETRO */}
          <div>
            <Label htmlFor="ext-inmetro" className="text-xs font-semibold">Selo Inmetro</Label>
            <Input
              id="ext-inmetro"
              placeholder="Ex: 001234/2024"
              className="h-11 sm:h-10 text-sm"
              value={seloInmetro}
              onChange={(e) => setSeloInmetro(e.target.value)}
            />
          </div>

          {/* OBSERVAÇÕES */}
          <div className="sm:col-span-2">
            <Label htmlFor="ext-obs" className="text-xs font-semibold">Observações / Histórico</Label>
            <Textarea
              id="ext-obs"
              placeholder="Informações adicionais sobre o equipamento..."
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
            {loading ? "Salvando..." : extintor ? "Salvar Alterações" : "Cadastrar Extintor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
