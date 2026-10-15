import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Settings2, Building2, MapPin, Factory } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  carregarSetores,
  carregarLocais,
  carregarFabricantes,
  cadastrarItemApoio,
} from "@/lib/extintoresApoioService";
import { ExtintorCadastrosApoioDialog } from "./ExtintorCadastrosApoioDialog";

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

  // Listas de apoio cadastradas
  const [listaSetores, setListaSetores] = useState<string[]>([]);
  const [listaLocais, setListaLocais] = useState<string[]>([]);
  const [listaFabricantes, setListaFabricantes] = useState<string[]>([]);

  // Modais de cadastro rápido de apoio
  const [modalApoioOpen, setModalApoioOpen] = useState(false);
  const [abaApoio, setAbaApoio] = useState<"setores" | "locais" | "fabricantes">("setores");

  const recarregarListasApoio = async () => {
    if (!empresaId) return;
    const [s, l, f] = await Promise.all([
      carregarSetores(empresaId),
      carregarLocais(empresaId),
      carregarFabricantes(empresaId),
    ]);
    setListaSetores(s);
    setListaLocais(l);
    setListaFabricantes(f);
  };

  useEffect(() => {
    if (open) {
      recarregarListasApoio();
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

  const abrirGerenciadorApoio = (aba: "setores" | "locais" | "fabricantes") => {
    setAbaApoio(aba);
    setModalApoioOpen(true);
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

      // Se o usuário digitou um setor, local ou fabricante que ainda não existia, salva automaticamente nos cadastros de apoio
      if (payload.local_setor) {
        cadastrarItemApoio(empresaId, "SETOR", payload.local_setor);
      }
      if (payload.local_descricao) {
        cadastrarItemApoio(empresaId, "LOCAL", payload.local_descricao);
      }
      if (payload.fabricante) {
        cadastrarItemApoio(empresaId, "FABRICANTE", payload.fabricante);
      }

      if (extintor?.id) {
        const { error } = await (supabase.from as any)("extintores")
          .update(payload)
          .eq("id", extintor.id);
        if (error) throw error;
        toast({ title: "Extintor atualizado", description: `TAG ${payload.numero} salva com sucesso.` });
      } else {
        const { error } = await (supabase.from as any)("extintores")
          .insert(payload);
        if (error) throw error;
        toast({ title: "Extintor cadastrado", description: `TAG ${payload.numero} criada com sucesso.` });
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Erro ao salvar extintor",
        description: err.message || "Verifique se a TAG já existe ou se as tabelas do módulo foram criadas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{extintor ? `Editar Extintor ${extintor.numero}` : "Novo Extintor (NR-23)"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div>
              <Label htmlFor="ext-numero">TAG / Patrimônio *</Label>
              <Input
                id="ext-numero"
                placeholder="Ex: EXT-01, PQS-05"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="ext-status">Status Operacional</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="ext-status">
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

            <div>
              <Label htmlFor="ext-agente">Agente Extintor *</Label>
              <Select value={agente} onValueChange={handleAgenteChange}>
                <SelectTrigger id="ext-agente">
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="ext-capacidade">Capacidade</Label>
                <Input
                  id="ext-capacidade"
                  type="number"
                  step="0.5"
                  value={capacidade}
                  onChange={(e) => setCapacidade(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ext-unidade">Unidade</Label>
                <Select value={unidadeCapacidade} onValueChange={setUnidadeCapacidade}>
                  <SelectTrigger id="ext-unidade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg (Pós / Gases)</SelectItem>
                    <SelectItem value="L">L (Líquidos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* SETOR / ÁREA COM SELEÇÃO E CADASTRO RÁPIDO */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="ext-setor" className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  Setor / Área
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-primary font-medium hover:bg-primary/10"
                  onClick={() => abrirGerenciadorApoio("setores")}
                >
                  <Plus className="w-3 h-3 mr-0.5" />
                  Gerenciar Setores
                </Button>
              </div>
              <div className="flex gap-1.5">
                <Select
                  value={listaSetores.includes(localSetor) ? localSetor : "_custom_"}
                  onValueChange={(val) => {
                    if (val === "_novo_") {
                      abrirGerenciadorApoio("setores");
                    } else if (val !== "_custom_") {
                      setLocalSetor(val);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o Setor ou digite...">
                      {localSetor || "Selecione o Setor cadastrado..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_novo_" className="text-primary font-semibold">
                      + Cadastrar Novo Setor...
                    </SelectItem>
                    {listaSetores.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Ou digite para personalizar:
              </p>
              <Input
                id="ext-setor"
                placeholder="Nome do setor..."
                value={localSetor}
                onChange={(e) => setLocalSetor(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>

            {/* LOCALIZAÇÃO ESPECÍFICA COM SELEÇÃO E CADASTRO RÁPIDO */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="ext-local-desc" className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  Localização Específica
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-emerald-700 font-medium hover:bg-emerald-50"
                  onClick={() => abrirGerenciadorApoio("locais")}
                >
                  <Plus className="w-3 h-3 mr-0.5" />
                  Gerenciar Locais
                </Button>
              </div>
              <Select
                value={listaLocais.includes(localDescricao) ? localDescricao : "_custom_"}
                onValueChange={(val) => {
                  if (val === "_novo_") {
                    abrirGerenciadorApoio("locais");
                  } else if (val !== "_custom_") {
                    setLocalDescricao(val);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o local cadastrado...">
                    {localDescricao || "Selecione o Local cadastrado..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_novo_" className="text-emerald-700 font-semibold">
                    + Cadastrar Novo Local...
                  </SelectItem>
                  {listaLocais.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Ou digite o detalhe exato (coluna, porta, etc.):
              </p>
              <Input
                id="ext-local-desc"
                placeholder="Ex: Coluna B, ao lado do quadro elétrico"
                value={localDescricao}
                onChange={(e) => setLocalDescricao(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="ext-recarga">Próxima Recarga (Anual)</Label>
              <Input
                id="ext-recarga"
                type="date"
                value={dataProximaRecarga}
                onChange={(e) => setDataProximaRecarga(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="ext-th">Próximo Teste Hidrostático (5 anos)</Label>
              <Input
                id="ext-th"
                type="date"
                value={dataProximoTh}
                onChange={(e) => setDataProximoTh(e.target.value)}
              />
            </div>

            {/* FABRICANTE / MARCA COM SELEÇÃO E CADASTRO RÁPIDO */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="ext-fabricante" className="flex items-center gap-1">
                  <Factory className="w-3.5 h-3.5 text-amber-600" />
                  Fabricante / Marca
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-amber-700 font-medium hover:bg-amber-50"
                  onClick={() => abrirGerenciadorApoio("fabricantes")}
                >
                  <Plus className="w-3 h-3 mr-0.5" />
                  Gerenciar Marcas
                </Button>
              </div>
              <Select
                value={listaFabricantes.includes(fabricante) ? fabricante : "_custom_"}
                onValueChange={(val) => {
                  if (val === "_novo_") {
                    abrirGerenciadorApoio("fabricantes");
                  } else if (val !== "_custom_") {
                    setFabricante(val);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o Fabricante cadastrado...">
                    {fabricante || "Selecione a Marca cadastrada..."}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_novo_" className="text-amber-700 font-semibold">
                    + Cadastrar Novo Fabricante...
                  </SelectItem>
                  {listaFabricantes.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Ou digite outra marca:
              </p>
              <Input
                id="ext-fabricante"
                placeholder="Ex: Kidde, Mocelin, Resil..."
                value={fabricante}
                onChange={(e) => setFabricante(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="ext-inmetro">Selo Inmetro</Label>
              <Input
                id="ext-inmetro"
                placeholder="Ex: 001234/2024"
                value={seloInmetro}
                onChange={(e) => setSeloInmetro(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="ext-obs">Observações / Histórico</Label>
              <Textarea
                id="ext-obs"
                placeholder="Informações adicionais sobre o equipamento..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={loading} className="bg-primary text-primary-foreground">
              {loading ? "Salvando..." : extintor ? "Salvar Alterações" : "Cadastrar Extintor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Cadastros de Apoio (Setores, Locais e Fabricantes) */}
      <ExtintorCadastrosApoioDialog
        open={modalApoioOpen}
        onOpenChange={setModalApoioOpen}
        empresaId={empresaId}
        abaInicial={abaApoio}
        onUpdated={recarregarListasApoio}
      />
    </>
  );
}
