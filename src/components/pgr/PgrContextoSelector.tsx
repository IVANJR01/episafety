import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, HardHat, ShieldCheck, User, ClipboardList } from "lucide-react";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";

/** Onde, na hierarquia, o registro está sendo feito. */
export interface ContextoSst {
  ambiente_id?: string | null;
  processo_id?: string | null;
  setor_id?: string | null;
  ges_id?: string | null;
  funcao_id?: string | null;
  atividade_id?: string | null;
}

interface Props {
  valor: ContextoSst;
  onChange: (c: ContextoSst) => void;
  disabled?: boolean;
  /** Marca os campos com asterisco e devolve a lista de faltantes em `pendencias`. */
  obrigatorios?: (keyof ContextoSst)[];
  /** Oculta níveis que não fazem sentido na tela chamadora. */
  ocultar?: (keyof ContextoSst)[];
}

const SEM = "__sem__";

/**
 * Seletores em cascata do contexto hierárquico.
 *
 * A cascata FILTRA mas não OBRIGA: escolher um setor restringe a lista de GES
 * sugeridos àquele setor, mas um GES sem vínculo de setor continua selecionável.
 * A NR-01 trata GES como agrupamento por exposição semelhante — amarrá-lo a um
 * único setor transformaria GES em sinônimo de setor, que é exatamente o erro
 * técnico mais comum nesse cadastro.
 */
export function PgrContextoSelector({
  valor, onChange, disabled, obrigatorios = [], ocultar = [],
}: Props) {
  const { ambientes, processos, setores, funcoes, atividades, gesList, gesVinculos } =
    useNucleoMestreSst();

  const req = (k: keyof ContextoSst) => obrigatorios.includes(k);
  const vis = (k: keyof ContextoSst) => !ocultar.includes(k);

  // Setores do ambiente escolhido; se o ambiente não foi escolhido, todos.
  const setoresVisiveis = useMemo(() => {
    if (!valor.ambiente_id) return setores;
    const doAmbiente = setores.filter((s: any) => s.ambiente_id === valor.ambiente_id);
    return doAmbiente.length > 0 ? doAmbiente : setores;
  }, [setores, valor.ambiente_id]);

  // GES sugeridos pelos vínculos N:N. Sem vínculo cadastrado, mostra todos —
  // um GES novo ainda não tem vínculo e precisa continuar acessível.
  const gesVisiveis = useMemo(() => {
    const alvo = valor.setor_id || valor.ambiente_id;
    if (!alvo) return gesList;
    const ids = new Set(
      (gesVinculos as any[])
        .filter((v) => v.setor_id === valor.setor_id || v.ambiente_id === valor.ambiente_id)
        .map((v) => v.ges_id),
    );
    const filtrados = gesList.filter((g: any) => ids.has(g.id));
    return filtrados.length > 0 ? filtrados : gesList;
  }, [gesList, gesVinculos, valor.setor_id, valor.ambiente_id]);

  const funcoesVisiveis = useMemo(() => {
    if (valor.ges_id) {
      const ids = new Set(
        (gesVinculos as any[]).filter((v) => v.ges_id === valor.ges_id && v.funcao_id)
          .map((v) => v.funcao_id),
      );
      const doGes = funcoes.filter((f: any) => ids.has(f.id));
      if (doGes.length > 0) return doGes;
    }
    if (valor.setor_id) {
      const doSetor = funcoes.filter((f: any) => f.setor_id === valor.setor_id);
      if (doSetor.length > 0) return doSetor;
    }
    return funcoes;
  }, [funcoes, gesVinculos, valor.ges_id, valor.setor_id]);

  const atividadesVisiveis = useMemo(() => {
    if (!valor.funcao_id) return atividades;
    const daFuncao = atividades.filter((a: any) => a.funcao_id === valor.funcao_id);
    return daFuncao.length > 0 ? daFuncao : atividades;
  }, [atividades, valor.funcao_id]);

  /**
   * Trocar um nível alto invalida os níveis abaixo: manter o "Pedreiro" depois
   * de trocar de obra grava um vínculo que não existe.
   */
  const set = (campo: keyof ContextoSst) => (v: string) => {
    const novo = v === SEM ? null : v;
    const limpar: Record<keyof ContextoSst, (keyof ContextoSst)[]> = {
      ambiente_id: ["setor_id", "ges_id", "funcao_id", "atividade_id"],
      processo_id: [],
      setor_id: ["ges_id", "funcao_id", "atividade_id"],
      ges_id: ["funcao_id", "atividade_id"],
      funcao_id: ["atividade_id"],
      atividade_id: [],
    };
    const zerados = Object.fromEntries(limpar[campo].map((k) => [k, null]));
    onChange({ ...valor, [campo]: novo, ...zerados });
  };

  const Campo = ({
    campo, rotulo, itens, placeholder,
  }: {
    campo: keyof ContextoSst;
    rotulo: string;
    itens: any[];
    placeholder: string;
  }) => (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {rotulo} {req(campo) && <span className="text-red-500">*</span>}
      </Label>
      <Select value={(valor[campo] as string) || SEM} onValueChange={set(campo)} disabled={disabled}>
        <SelectTrigger className="h-11">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SEM}>{placeholder}</SelectItem>
          {itens.map((i) => (
            <SelectItem key={i.id} value={i.id}>
              {i.codigo ? `${i.codigo} — ${i.nome}` : i.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {itens.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum registro cadastrado ainda.
        </p>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {vis("ambiente_id") && (
        <Campo campo="ambiente_id" rotulo="Ambiente" itens={ambientes} placeholder="Selecione o ambiente" />
      )}
      {vis("processo_id") && (
        <Campo campo="processo_id" rotulo="Processo" itens={processos} placeholder="Selecione o processo" />
      )}
      {vis("setor_id") && (
        <Campo campo="setor_id" rotulo="Setor" itens={setoresVisiveis} placeholder="Selecione o setor" />
      )}
      {vis("ges_id") && (
        <Campo campo="ges_id" rotulo="GES" itens={gesVisiveis} placeholder="Selecione o GES" />
      )}
      {vis("funcao_id") && (
        <Campo campo="funcao_id" rotulo="Função" itens={funcoesVisiveis} placeholder="Selecione a função" />
      )}
      {vis("atividade_id") && (
        <Campo campo="atividade_id" rotulo="Atividade" itens={atividadesVisiveis} placeholder="Selecione a atividade" />
      )}
    </div>
  );
}

/** Painel lateral "Contexto selecionado" — resume o que já foi escolhido. */
export function PgrContextoResumo({ valor }: { valor: ContextoSst }) {
  const { ambientes, setores, funcoes, atividades, gesList } = useNucleoMestreSst();

  const nome = (lista: any[], id?: string | null) =>
    (id && lista.find((i) => i.id === id)?.nome) || null;

  const linhas = [
    { icone: Building2, rotulo: "Ambiente", valor: nome(ambientes, valor.ambiente_id) },
    { icone: HardHat, rotulo: "Setor", valor: nome(setores, valor.setor_id) },
    { icone: ShieldCheck, rotulo: "GES", valor: nome(gesList, valor.ges_id) },
    { icone: User, rotulo: "Função", valor: nome(funcoes, valor.funcao_id) },
    { icone: ClipboardList, rotulo: "Atividade", valor: nome(atividades, valor.atividade_id) },
  ];

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold mb-3">Contexto selecionado</h3>
      <div className="space-y-3">
        {linhas.map(({ icone: Icone, rotulo, valor: v }) => (
          <div key={rotulo} className="flex items-start gap-3">
            <span className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-muted grid place-items-center">
              <Icone className="h-4 w-4 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{rotulo}</p>
              <p className={`text-sm ${v ? "font-medium" : "text-muted-foreground"}`}>
                {v || "A definir"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
