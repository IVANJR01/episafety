import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

export interface ObraItem {
  id: string;
  nome: string;
  codigo?: string | null;
  status?: string | null;
}

/**
 * Seletor de obra que também cria a obra que falta.
 *
 * Antes era um `Select` fechado: se a obra não estivesse cadastrada, o campo
 * dizia "Cadastre uma obra em Inspeções → Cadastro de Obras" e parava ali —
 * quem estava registrando uma não conformidade tinha que abandonar o
 * formulário, ir a outra tela, cadastrar e voltar do começo.
 *
 * Agora digita-se o nome: se existir, filtra; se não existir, aparece a opção
 * de criar, e a obra nasce já selecionada. A tela de Cadastro de Local
 * continua existindo para editar cidade, UF e status depois.
 */
export default function ObraCombobox({
  obras, valor, onSelecionar, onCriar, invalido, desabilitado,
}: {
  obras: ObraItem[];
  valor?: string | null;
  onSelecionar: (id: string) => void;
  /** Cria a obra e devolve o id, para o campo já ficar preenchido. */
  onCriar: (nome: string) => Promise<string | null>;
  invalido?: boolean;
  desabilitado?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);

  const selecionada = obras.find((o) => o.id === valor);

  // Obra encerrada continua listada se for a que já está escolhida — senão o
  // campo de uma inspeção antiga apareceria vazio ao ser reaberto.
  const visiveis = useMemo(
    () => obras.filter((o) => o.status === "ATIVA" || o.id === valor),
    [obras, valor],
  );

  const termo = busca.trim();
  const jaExiste = termo.length > 0
    && visiveis.some((o) => o.nome.trim().toLowerCase() === termo.toLowerCase());

  const criar = async () => {
    if (!termo || criando) return;
    setCriando(true);
    try {
      const id = await onCriar(termo);
      if (id) {
        onSelecionar(id);
        setAberto(false);
        setBusca("");
      }
    } finally {
      setCriando(false);
    }
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          disabled={desabilitado}
          className={cn(
            "w-full min-h-[44px] justify-between font-normal",
            !selecionada && "text-muted-foreground",
            invalido && "border-destructive",
          )}
        >
          <span className="truncate text-left">
            {selecionada
              ? `${selecionada.nome}${selecionada.codigo ? ` (${selecionada.codigo})` : ""}`
              : "Selecione ou digite o nome da obra"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          // O filtro padrão do cmdk pontua por similaridade e deixa passar
          // resultado que não contém o que foi digitado. Aqui a busca é
          // literal: quem digita "BARROCAS" espera ver só Barrocas.
          filter={(value, search) =>
            value.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput
            placeholder="Buscar ou digitar nome novo..."
            value={busca}
            onValueChange={setBusca}
          />
          <CommandList>
            {termo.length > 0 && !jaExiste && (
              <CommandGroup>
                <CommandItem value={`__criar__${termo}`} onSelect={criar} disabled={criando}>
                  {criando
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Plus className="mr-2 h-4 w-4" />}
                  <span className="truncate">Criar obra “{termo}”</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandEmpty>
              {termo ? "Nenhuma obra com esse nome." : "Nenhuma obra cadastrada ainda."}
            </CommandEmpty>
            <CommandGroup>
              {visiveis.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.nome} ${o.codigo || ""}`}
                  onSelect={() => { onSelecionar(o.id); setAberto(false); setBusca(""); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", o.id === valor ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">
                    {o.nome}
                    {o.codigo ? <span className="text-muted-foreground"> ({o.codigo})</span> : null}
                    {o.status && o.status !== "ATIVA"
                      ? <span className="text-muted-foreground"> — {o.status}</span> : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
