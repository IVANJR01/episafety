import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Stethoscope, UserPlus, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PcmsoProfissionalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId?: string;
  onSuccess: () => void;
}

export default function PcmsoProfissionalModal({
  open,
  onOpenChange,
  empresaId,
  onSuccess,
}: PcmsoProfissionalModalProps) {
  const [salvando, setSalvando] = useState(false);
  const [tipoProfissional, setTipoProfissional] = useState<"medico" | "fonoaudiologo" | "outro">("medico");
  const [nome, setNome] = useState("");
  const [registroNum, setRegistroNum] = useState("");
  const [conselhoUf, setConselhoUf] = useState("CE");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [responsavelPcmso, setResponsavelPcmso] = useState(false);

  const handleTipoChange = (tipo: "medico" | "fonoaudiologo" | "outro") => {
    setTipoProfissional(tipo);
    if (tipo === "fonoaudiologo") {
      setConselhoUf("CRFa-8");
      setResponsavelPcmso(false);
    } else {
      setConselhoUf("CE");
    }
  };

  const handleSalvar = async () => {
    if (!nome.trim() || !registroNum.trim()) {
      toast.error("Informe pelo menos o Nome e o Número do Registro Profissional.");
      return;
    }

    try {
      setSalvando(true);

      // Se for fonoaudiólogo, indicamos no registro ou uf_crm ex: CRFa-8 / Fonoaudiologia
      const registroFinal = registroNum.trim();
      const ufFinal = tipoProfissional === "fonoaudiologo"
        ? (conselhoUf.toUpperCase().includes("CRFA") ? conselhoUf.toUpperCase() : `CRFa-${conselhoUf.toUpperCase()}`)
        : conselhoUf.toUpperCase();

      const { error } = await (supabase.from as any)("aso_medicos").insert({
        empresa_id: empresaId || null,
        nome: nome.trim(),
        crm: registroFinal,
        uf_crm: ufFinal,
        cpf: cpf.trim() || null,
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        responsavel_pcmso: responsavelPcmso,
        ativo: true,
      });

      if (error) throw error;

      toast.success(
        tipoProfissional === "fonoaudiologo"
          ? "Fonoaudiólogo(a) cadastrado(a) com sucesso!"
          : "Médico(a) cadastrado(a) com sucesso!"
      );

      setNome("");
      setRegistroNum("");
      setCpf("");
      setEmail("");
      setTelefone("");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao salvar: ${err.message || err}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-5 w-5 text-primary" />
            Cadastrar Profissional de Saúde Habilitado
          </DialogTitle>
          <DialogDescription>
            Adicione Médicos Examinadores (CRM) ou Fonoaudiólogos (CRFa) credenciados para a realização dos exames da empresa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Categoria do Profissional</Label>
            <Select
              value={tipoProfissional}
              onValueChange={(v) => handleTipoChange(v as any)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="medico">Médico(a) do Trabalho / Examinador(a) (CRM)</SelectItem>
                <SelectItem value="fonoaudiologo">Fonoaudiólogo(a) (CRFa — Audiometria)</SelectItem>
                <SelectItem value="outro">Outro Profissional / Especialista Credenciado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Nome Completo *</Label>
            <Input
              placeholder={tipoProfissional === "fonoaudiologo" ? "Ex: Dra. Renata Paula Oliveira Silva" : "Ex: Dr. Anthony Saker Filho"}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">
                {tipoProfissional === "fonoaudiologo" ? "Registro CRFa *" : "Número CRM *"}
              </Label>
              <Input
                placeholder={tipoProfissional === "fonoaudiologo" ? "Ex: 9407" : "Ex: 6353"}
                value={registroNum}
                onChange={(e) => setRegistroNum(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Conselho / UF</Label>
              <Input
                placeholder={tipoProfissional === "fonoaudiologo" ? "Ex: CRFa-8 ou CE" : "Ex: CE"}
                value={conselhoUf}
                onChange={(e) => setConselhoUf(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Telefone / WhatsApp</Label>
              <Input
                placeholder="(85) 99999-9999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input
                type="email"
                placeholder="clinica@exemplo.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {tipoProfissional === "medico" && (
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20 text-xs">
              <div>
                <span className="font-semibold text-foreground">Responsável Coordenador do PCMSO</span>
                <p className="text-[11px] text-muted-foreground">Marque se este médico for o coordenador geral do programa.</p>
              </div>
              <Switch
                checked={responsavelPcmso}
                onCheckedChange={setResponsavelPcmso}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSalvar} disabled={salvando} className="gap-1.5">
            <Save className="h-4 w-4" />
            {salvando ? "Salvando..." : "Cadastrar Profissional"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
