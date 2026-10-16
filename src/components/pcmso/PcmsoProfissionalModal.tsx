import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Save, Search, Loader2, Sparkles, CheckCircle2, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buscarProfissionalPorCrm, CATALOGO_MEDICOS_OCUPACIONAIS } from "@/lib/consultaCrm";
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
  const [buscandoCrm, setBuscandoCrm] = useState(false);
  const [encontradoInfo, setEncontradoInfo] = useState<string | null>(null);

  const [tipoProfissional, setTipoProfissional] = useState<"medico" | "fonoaudiologo" | "outro">("medico");
  const [nome, setNome] = useState("");
  const [registroNum, setRegistroNum] = useState("");
  const [conselhoUf, setConselhoUf] = useState("CE");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [responsavelPcmso, setResponsavelPcmso] = useState(false);

  // Carrega lista de profissionais já cadastrados no sistema para atalho rápido
  const { data: profissionaisCadastrados = [] } = useQuery({
    queryKey: ["aso-medicos-atalho-todos"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("aso_medicos")
        .select("id, nome, crm, uf_crm, telefone, email, cpf, responsavel_pcmso")
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
    enabled: open,
  });

  const handleTipoChange = (tipo: "medico" | "fonoaudiologo" | "outro") => {
    setTipoProfissional(tipo);
    setEncontradoInfo(null);
    if (tipo === "fonoaudiologo") {
      setConselhoUf("CRFa-8");
      setResponsavelPcmso(false);
    } else {
      setConselhoUf("CE");
    }
  };

  // Função central de busca pelo CRM
  const executarBuscaCrm = useCallback(
    async (crmValor?: string, ufValor?: string, silencioso: boolean = false) => {
      const crmParaBuscar = (crmValor !== undefined ? crmValor : registroNum).replace(/\D/g, "").trim();
      const ufParaBuscar = ufValor !== undefined ? ufValor : conselhoUf;

      if (!crmParaBuscar || crmParaBuscar.length < 2) {
        if (!silencioso) {
          toast.info("Digite pelo menos 2 números do CRM para buscar.");
        }
        return;
      }

      try {
        setBuscandoCrm(true);
        const resultado = await buscarProfissionalPorCrm(crmParaBuscar, ufParaBuscar, tipoProfissional);

        if (resultado && resultado.encontrado) {
          setNome(resultado.nome);
          if (resultado.uf) setConselhoUf(resultado.uf);
          if (resultado.telefone) setTelefone(resultado.telefone);
          if (resultado.email) setEmail(resultado.email);
          if (resultado.cpf) setCpf(resultado.cpf);
          if (resultado.tipo) setTipoProfissional(resultado.tipo);
          if (resultado.responsavel_pcmso !== undefined && resultado.tipo !== "fonoaudiologo") {
            setResponsavelPcmso(resultado.responsavel_pcmso);
          }

          setEncontradoInfo(`Localizado: ${resultado.nome} (${resultado.tipo === "fonoaudiologo" ? "CRFa" : "CRM"} ${resultado.crm}/${resultado.uf})`);
          toast.success(`Profissional localizado: ${resultado.nome}`);
        } else {
          setEncontradoInfo(null);
          if (!silencioso) {
            toast.info(`CRM ${crmParaBuscar} não encontrado na base. Preencha o nome abaixo para cadastrar.`);
          }
        }
      } catch (err: any) {
        console.error("Erro na busca de CRM:", err);
      } finally {
        setBuscandoCrm(false);
      }
    },
    [registroNum, conselhoUf, tipoProfissional]
  );

  // Selecionar profissional existente da lista
  const handleSelecionarExistente = (idSelecionado: string) => {
    if (!idSelecionado || idSelecionado === "none") return;
    const prof = profissionaisCadastrados.find((p: any) => p.id === idSelecionado);
    if (!prof) return;

    let nomeLimpo = (prof.nome || "").trim();
    nomeLimpo = nomeLimpo.replace(/^(dr[aªº\.]*|doutor[a]?)\s+/i, "");

    const isFono = (prof.uf_crm || "").toUpperCase().includes("CRFA") ||
                   (prof.crm || "").toUpperCase().includes("CRFA");

    setNome(nomeLimpo);
    setRegistroNum(prof.crm || "");
    setConselhoUf(prof.uf_crm || (isFono ? "CRFa-8" : "CE"));
    if (prof.telefone) setTelefone(prof.telefone);
    if (prof.email) setEmail(prof.email);
    if (prof.cpf) setCpf(prof.cpf);
    setTipoProfissional(isFono ? "fonoaudiologo" : "medico");
    setResponsavelPcmso(!!prof.responsavel_pcmso);
    setEncontradoInfo(`Selecionado do cadastro: ${prof.nome}`);
    toast.success(`Dados de ${prof.nome} carregados!`);
  };

  const handleSalvar = async () => {
    if (!nome.trim() || !registroNum.trim()) {
      toast.error("Informe pelo menos o Nome e o Número do Registro Profissional (CRM/CRFa).");
      return;
    }

    try {
      setSalvando(true);

      const registroFinal = registroNum.trim();
      const ufFinal = tipoProfissional === "fonoaudiologo"
        ? (conselhoUf.toUpperCase().includes("CRFA") ? conselhoUf.toUpperCase() : `CRFa-${conselhoUf.toUpperCase()}`)
        : conselhoUf.toUpperCase();

      // Formata nome para garantir padrão sem prefixo dobrado
      let nomeFinal = nome.trim();
      nomeFinal = nomeFinal.replace(/^(dr[aªº\.]*|doutor[a]?)\s+/i, "");

      const { error } = await (supabase.from as any)("aso_medicos").insert({
        empresa_id: empresaId || null,
        nome: nomeFinal,
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
      setEncontradoInfo(null);
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
          <DialogDescription className="text-xs">
            Informe o número do CRM para buscar e preencher automaticamente os dados do médico, ou cadastre um novo profissional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          {/* Categoria do Profissional */}
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

          {/* Atalho: Escolher de profissional já cadastrado */}
          {profissionaisCadastrados.length > 0 && (
            <div className="p-2.5 rounded-lg border bg-muted/20 space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                Ou selecione um profissional já cadastrado na plataforma:
              </Label>
              <Select onValueChange={handleSelecionarExistente}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Escolha um profissional para preencher..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-muted-foreground italic">
                    Selecione um profissional...
                  </SelectItem>
                  {profissionaisCadastrados.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} ({p.crm ? `${p.crm}/${p.uf_crm || "CE"}` : "Sem CRM"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* BLOCO EM DESTAQUE: BUSCA POR CRM / REGISTRO */}
          <div className="p-3 rounded-lg border-2 border-primary/20 bg-primary/5 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs font-semibold flex items-center justify-between text-foreground">
                  <span className="flex items-center gap-1">
                    <Search className="h-3.5 w-3.5 text-primary" />
                    {tipoProfissional === "fonoaudiologo" ? "Registro CRFa *" : "Número CRM *"}
                  </span>
                  {buscandoCrm && (
                    <span className="text-[10px] text-primary flex items-center gap-1 font-normal animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                    </span>
                  )}
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    placeholder={tipoProfissional === "fonoaudiologo" ? "Ex: 9407" : "Ex: 9245"}
                    value={registroNum}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRegistroNum(v);
                      setEncontradoInfo(null);
                    }}
                    onBlur={() => {
                      if (registroNum.replace(/\D/g, "").length >= 2 && !nome) {
                        executarBuscaCrm(undefined, undefined, true);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        executarBuscaCrm();
                      }
                    }}
                    className="h-9 text-xs font-mono font-semibold tracking-wider bg-background"
                  />
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => executarBuscaCrm()}
                    disabled={buscandoCrm || !registroNum.trim()}
                    className="h-9 px-3 text-xs shrink-0 gap-1.5 bg-primary text-primary-foreground font-medium"
                    title="Buscar dados do médico pelo CRM"
                  >
                    {buscandoCrm ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    Buscar
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Conselho / UF</Label>
                <Input
                  placeholder={tipoProfissional === "fonoaudiologo" ? "Ex: CRFa-8 ou CE" : "Ex: CE"}
                  value={conselhoUf}
                  onChange={(e) => setConselhoUf(e.target.value.toUpperCase())}
                  className="h-9 text-xs font-mono uppercase bg-background"
                />
              </div>
            </div>

            {encontradoInfo && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium truncate">{encontradoInfo}</span>
              </div>
            )}
          </div>

          {/* Nome Completo (Preenchido automaticamente pela busca) */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Nome Completo do Profissional *</Label>
            <Input
              placeholder={tipoProfissional === "fonoaudiologo" ? "Ex: Renata Paula Oliveira Silva" : "Ex: Carlos Virgilio de Andrade Chaves"}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-9 text-xs font-medium"
            />
          </div>

          {/* Contatos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Telefone / WhatsApp</Label>
              <Input
                placeholder="(85) 99999-9999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
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

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
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

