import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Stethoscope, Activity, Save, Sparkles, UserCheck } from "lucide-react";
import { CATALOGO_EXAMES_NR07, ExameCatalogoItem } from "@/lib/pcmsoCatalogoExames";
import { toast } from "sonner";

export interface DadosExameGes {
  id?: string;
  empresa_id: string;
  ghe_id: string;
  codigo_exame: string;
  nome_exame: string;
  tipo_exame: string;
  obrigatorio: boolean;
  aparece_aso: boolean;
  admissional: boolean;
  periodico: boolean;
  retorno_trabalho: boolean;
  mudanca_risco: boolean;
  mudanca_funcao: boolean;
  demissional: boolean;
  periodicidade_meses: number;
  observacao?: string;
}

interface PcmsoExameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  gheId: string;
  gesCodigo: string;
  gesNome: string;
  exameEmEdicao?: DadosExameGes | null;
  onSalvar: (dados: DadosExameGes) => Promise<void>;
}

export default function PcmsoExameModal({
  open,
  onOpenChange,
  empresaId,
  gheId,
  gesCodigo,
  gesNome,
  exameEmEdicao,
  onSalvar,
}: PcmsoExameModalProps) {
  const [salvando, setSalvando] = useState(false);

  const [catalogoSel, setCatalogoSel] = useState<string>("custom");
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("complementar");
  const [profissional, setProfissional] = useState("medico");
  const [periodicidadeMeses, setPeriodicidadeMeses] = useState(12);

  const [adm, setAdm] = useState(true);
  const [per, setPer] = useState(true);
  const [rt, setRt] = useState(false);
  const [mro, setMro] = useState(true);
  const [dem, setDem] = useState(true);
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (exameEmEdicao) {
      setCodigo(exameEmEdicao.codigo_exame || "");
      setNome(exameEmEdicao.nome_exame || "");
      setTipo(exameEmEdicao.tipo_exame || "complementar");
      setPeriodicidadeMeses(exameEmEdicao.periodicidade_meses || 12);
      setAdm(!!exameEmEdicao.admissional);
      setPer(!!exameEmEdicao.periodico);
      setRt(!!exameEmEdicao.retorno_trabalho);
      setMro(!!exameEmEdicao.mudanca_risco);
      setDem(!!exameEmEdicao.demissional);
      setObservacao(exameEmEdicao.observacao || "");

      // Descobre se casa com algum exame do catálogo
      const achado = CATALOGO_EXAMES_NR07.find(
        (c) => c.codigo === exameEmEdicao.codigo_exame || c.nome.toLowerCase() === exameEmEdicao.nome_exame.toLowerCase()
      );
      if (achado) {
        setCatalogoSel(achado.codigo);
        setProfissional(achado.profissionalSugerido);
      } else {
        setCatalogoSel("custom");
        if (exameEmEdicao.observacao?.toLowerCase().includes("fonoaudiól")) {
          setProfissional("fonoaudiologo");
        } else {
          setProfissional("medico");
        }
      }
    } else {
      // Padrão novo exame
      setCatalogoSel("0935"); // Audiometria como sugestão inicial frequente
      const base = CATALOGO_EXAMES_NR07.find((c) => c.codigo === "0935")!;
      setCodigo(base.codigo);
      setNome(base.nome);
      setTipo(base.tipo);
      setProfissional(base.profissionalSugerido);
      setPeriodicidadeMeses(base.periodicidadeMeses);
      setAdm(base.admissional);
      setPer(base.periodico);
      setRt(base.retornoTrabalho);
      setMro(base.mudancaRisco);
      setDem(base.demissional);
      setObservacao(base.observacaoPadrao || "");
    }
  }, [exameEmEdicao, open]);

  const handleSelectCatalogo = (cod: string) => {
    setCatalogoSel(cod);
    if (cod === "custom") {
      setCodigo("");
      setNome("");
      setTipo("complementar");
      return;
    }
    const item = CATALOGO_EXAMES_NR07.find((c) => c.codigo === cod);
    if (item) {
      setCodigo(item.codigo);
      setNome(item.nome);
      setTipo(item.tipo);
      setProfissional(item.profissionalSugerido);
      setPeriodicidadeMeses(item.periodicidadeMeses);
      setAdm(item.admissional);
      setPer(item.periodico);
      setRt(item.retornoTrabalho);
      setMro(item.mudancaRisco);
      setDem(item.demissional);
      setObservacao(item.observacaoPadrao || "");
    }
  };

  const handleSalvar = async () => {
    if (!nome.trim()) {
      toast.error("Informe o nome do exame.");
      return;
    }

    try {
      setSalvando(true);

      // Adiciona nota do profissional executor se relevante
      let obsFinal = observacao.trim();
      if (profissional === "fonoaudiologo" && !obsFinal.toLowerCase().includes("fonoaudiól")) {
        obsFinal = obsFinal
          ? `${obsFinal} — Realizado por Fonoaudiólogo(a) credenciado(a) (CRFa).`
          : "Realizado por Fonoaudiólogo(a) credenciado(a) (CRFa).";
      }

      const payload: DadosExameGes = {
        id: exameEmEdicao?.id,
        empresa_id: empresaId,
        ghe_id: gheId,
        codigo_exame: codigo.trim() || "0000",
        nome_exame: nome.trim(),
        tipo_exame: tipo,
        obrigatorio: true,
        aparece_aso: true,
        admissional: adm,
        periodico: per,
        retorno_trabalho: rt,
        mudanca_risco: mro,
        mudanca_funcao: mro,
        demissional: dem,
        periodicidade_meses: periodicidadeMeses,
        observacao: obsFinal || undefined,
      };

      await onSalvar(payload);
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao salvar exame: ${err.message || err}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-amber-500" />
            {exameEmEdicao ? "Editar Exame do GES" : "Adicionar Exame ao GES"} — {gesCodigo}
          </DialogTitle>
          <DialogDescription>
            Personalize a prescrição de exames ocupacionais e complementares para o grupo <strong>{gesNome}</strong> (NR-07 e PCMSO).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Seleção rápida do Catálogo NR-07 */}
          <div>
            <Label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Modelos Oficiais da NR-07 / eSocial
            </Label>
            <Select value={catalogoSel} onValueChange={handleSelectCatalogo}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione um exame do catálogo ou digite personalizado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom" className="font-semibold text-primary">
                  ✎ Digitar Exame Personalizado...
                </SelectItem>
                {CATALOGO_EXAMES_NR07.map((c) => (
                  <SelectItem key={c.codigo} value={c.codigo} className="text-xs">
                    [{c.codigo}] {c.nome} ({c.baseNormativa.split("(")[0]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Código (eSocial / Tabela 28)</Label>
              <Input
                placeholder="Ex: 0935"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Nome Oficial do Exame *</Label>
              <Input
                placeholder="Ex: Audiometria Tonal e Vocal"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="h-9 text-xs font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs flex items-center gap-1">
                <UserCheck className="h-3.5 w-3.5 text-primary" /> Profissional Executor Habilitado
              </Label>
              <Select value={profissional} onValueChange={setProfissional}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medico">Médico do Trabalho / Examinador (CRM)</SelectItem>
                  <SelectItem value="fonoaudiologo">Fonoaudiólogo(a) Habilitado(a) (CRFa)</SelectItem>
                  <SelectItem value="oftalmologista">Oftalmologista (CRM)</SelectItem>
                  <SelectItem value="laboratorio">Laboratório de Análises Clínicas</SelectItem>
                  <SelectItem value="psicologo">Psicólogo(a) (CRP - Avaliação Psicossocial)</SelectItem>
                  <SelectItem value="outro">Outro Profissional Credenciado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Periodicidade do Exame</Label>
              <Select
                value={String(periodicidadeMeses)}
                onValueChange={(v) => setPeriodicidadeMeses(parseInt(v, 10))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">Semestral (A cada 6 meses)</SelectItem>
                  <SelectItem value="12">Anual (A cada 12 meses — Padrão)</SelectItem>
                  <SelectItem value="24">Bienal (A cada 2 anos — Setor s/ Risco)</SelectItem>
                  <SelectItem value="30">A cada 2 anos e meio (Tox. Motoristas)</SelectItem>
                  <SelectItem value="0">A critério do Médico Coordenador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Aplicação nos tipos de ASO */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
            <Label className="text-xs font-semibold text-foreground">
              Exigência do Exame por Tipo de Avaliação Ocupacional (ASO):
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={adm} onCheckedChange={(v) => setAdm(!!v)} />
                <span>Admissional</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={per} onCheckedChange={(v) => setPer(!!v)} />
                <span>Periódico</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={rt} onCheckedChange={(v) => setRt(!!v)} />
                <span>Retorno (RT)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={mro} onCheckedChange={(v) => setMro(!!v)} />
                <span>Mudança Risco</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={dem} onCheckedChange={(v) => setDem(!!v)} />
                <span>Demissional</span>
              </label>
            </div>
          </div>

          {/* Observação / Critério Médico */}
          <div>
            <Label className="text-xs">Observações, Instruções Clínicas ou Justificativa</Label>
            <Textarea
              placeholder="Ex: Realizar em cabine audiométrica com 14h de repouso auditivo. Laudo assinado por Fonoaudiólogo(a)."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="text-xs min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSalvar} disabled={salvando} className="gap-1.5">
            <Save className="h-4 w-4" />
            {salvando ? "Salvando..." : exameEmEdicao ? "Atualizar Exame" : "Salvar Exame no GES"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
