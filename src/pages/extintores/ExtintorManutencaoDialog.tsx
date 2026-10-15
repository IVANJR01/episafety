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
    try {
      // 1. Registra manutenção na tabela extintor_manutencoes
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

      const { error: manErr } = await (supabase.from as any)("extintor_manutencoes").insert(payload);
      if (manErr) throw manErr;

      // 2. Atualiza status e datas no extintor
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
      toast({
        title: "Erro ao registrar manutenção",
        description: err.message || "Falha ao gravar manutenção.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <DialogTitle>Lançar Manutenção — Extintor {extintor.numero}</DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            {extintor.agente?.replace(/_/g, " ")} · {extintor.capacidade} {extintor.unidade_capacidade} · Setor: {extintor.local_setor || "Geral"}
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="md:col-span-2">
            <Label htmlFor="man-tipo">Tipo de Manutenção</Label>
            <Select value={tipo} onValueChange={handleTipoChange}>
              <SelectTrigger id="man-tipo">
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
            <Label htmlFor="man-data">Data do Serviço</Label>
            <Input
              id="man-data"
              type="date"
              value={dataManutencao}
              onChange={(e) => setDataManutencao(e.target.value)}
            />
          </div>

          {tipo !== "BAIXA" && (
            <div>
              <Label htmlFor="man-validade">Nova Validade da Recarga</Label>
              <Input
                id="man-validade"
                type="date"
                value={validadeEtiqueta}
                onChange={(e) => setValidadeEtiqueta(e.target.value)}
              />
            </div>
          )}

          {tipo === "TESTE_HIDROSTATICO" && (
            <div>
              <Label htmlFor="man-th">Próximo Teste Hidrostático (5 anos)</Label>
              <Input
                id="man-th"
                type="date"
                value={proximoTh}
                onChange={(e) => setProximoTh(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="man-selo">Novo Selo Inmetro</Label>
            <Input
              id="man-selo"
              placeholder="Ex: 009876/2026"
              value={seloInmetro}
              onChange={(e) => setSeloInmetro(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="man-empresa">Empresa Prestadora Credenciada</Label>
            <Input
              id="man-empresa"
              placeholder="Ex: Soluções Contra Incêndio Ltda"
              value={empresaPrestadora}
              onChange={(e) => setEmpresaPrestadora(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="man-os">Nº da Ordem de Serviço (OS)</Label>
            <Input
              id="man-os"
              placeholder="Ex: OS-4589"
              value={numeroOs}
              onChange={(e) => setNumeroOs(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="man-custo">Custo Total (R$)</Label>
            <Input
              id="man-custo"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={custo}
              onChange={(e) => setCusto(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="man-obs">Observações do Serviço</Label>
            <Textarea
              id="man-obs"
              placeholder="Relatório de itens trocados, laudos ou observações..."
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
            {loading ? "Gravando..." : "Salvar Registro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
