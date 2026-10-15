import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Factory, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  carregarSetores,
  carregarLocais,
  carregarFabricantes,
  cadastrarItemApoio,
  excluirItemApoio,
  TipoApoio,
} from "@/lib/extintoresApoioService";

interface ExtintorCadastrosApoioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  onUpdated?: () => void;
  abaInicial?: "setores" | "locais" | "fabricantes";
}

export function ExtintorCadastrosApoioDialog({
  open,
  onOpenChange,
  empresaId,
  onUpdated,
  abaInicial = "setores",
}: ExtintorCadastrosApoioDialogProps) {
  const [tab, setTab] = useState<string>(abaInicial);
  const [setores, setSetores] = useState<string[]>([]);
  const [locais, setLocais] = useState<string[]>([]);
  const [fabricantes, setFabricantes] = useState<string[]>([]);
  const [novoItem, setNovoItem] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (abaInicial) setTab(abaInicial);
  }, [abaInicial]);

  const carregarTudo = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [s, l, f] = await Promise.all([
        carregarSetores(empresaId),
        carregarLocais(empresaId),
        carregarFabricantes(empresaId),
      ]);
      setSetores(s);
      setLocais(l);
      setFabricantes(f);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      carregarTudo();
      setNovoItem("");
    }
  }, [open, empresaId]);

  const handleAdicionar = async (tipo: TipoApoio) => {
    const nomeLimpo = novoItem.trim();
    if (!nomeLimpo) {
      toast({ title: "Campo vazio", description: "Digite o nome para cadastrar.", variant: "destructive" });
      return;
    }

    const ok = await cadastrarItemApoio(empresaId, tipo, nomeLimpo);
    if (ok) {
      toast({ title: "Cadastrado com sucesso!", description: `"${nomeLimpo}" adicionado à lista.` });
      setNovoItem("");
      await carregarTudo();
      onUpdated?.();
    }
  };

  const handleExcluir = async (tipo: TipoApoio, nome: string) => {
    if (!confirm(`Deseja remover "${nome}" das opções cadastradas?`)) return;
    await excluirItemApoio(empresaId, tipo, nome);
    toast({ title: "Removido", description: `"${nome}" foi removido das opções.` });
    await carregarTudo();
    onUpdated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] p-3.5 sm:p-6 flex flex-col rounded-xl sm:rounded-2xl">
        <DialogHeader className="pb-1 border-b">
          <DialogTitle className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg">
            <Building2 className="w-5 h-5 text-primary shrink-0" />
            <span>Cadastros de Apoio · Extintores</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cadastre setores, locais e marcas para seleção rápida com 1 clique.
          </p>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full flex-1 flex flex-col min-h-0 mt-2">
          <TabsList className="grid grid-cols-3 w-full h-10 p-1">
            <TabsTrigger value="setores" className="flex items-center justify-center gap-1 text-[11px] sm:text-xs">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Setores ({setores.length})</span>
            </TabsTrigger>
            <TabsTrigger value="locais" className="flex items-center justify-center gap-1 text-[11px] sm:text-xs">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span className="truncate">Locais ({locais.length})</span>
            </TabsTrigger>
            <TabsTrigger value="fabricantes" className="flex items-center justify-center gap-1 text-[11px] sm:text-xs">
              <Factory className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span className="truncate">Marcas ({fabricantes.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* ABA SETORES */}
          <TabsContent value="setores" className="flex-1 flex flex-col min-h-0 space-y-2.5 pt-2.5">
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Almoxarifado, Costura, RH..."
                className="h-11 sm:h-10 text-sm"
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdicionar("SETOR");
                  }
                }}
              />
              <Button onClick={() => handleAdicionar("SETOR")} className="shrink-0 h-11 sm:h-10 px-3.5 sm:px-4 bg-primary text-white font-bold">
                <Plus className="w-4 h-4 mr-1" />
                <span>Adicionar</span>
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-xl p-2 space-y-1.5 bg-slate-50/50 dark:bg-slate-900/30">
              {setores.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum setor cadastrado ainda.</p>
              ) : (
                setores.map((s) => (
                  <div
                    key={s}
                    className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <Building2 className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{s}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 shrink-0"
                      onClick={() => handleExcluir("SETOR", s)}
                      title="Excluir setor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ABA LOCAIS */}
          <TabsContent value="locais" className="flex-1 flex flex-col min-h-0 space-y-2.5 pt-2.5">
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Próximo à porta principal, Coluna B..."
                className="h-11 sm:h-10 text-sm"
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdicionar("LOCAL");
                  }
                }}
              />
              <Button onClick={() => handleAdicionar("LOCAL")} className="shrink-0 h-11 sm:h-10 px-3.5 sm:px-4 bg-primary text-white font-bold">
                <Plus className="w-4 h-4 mr-1" />
                <span>Adicionar</span>
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-xl p-2 space-y-1.5 bg-slate-50/50 dark:bg-slate-900/30">
              {locais.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum local cadastrado ainda.</p>
              ) : (
                locais.map((l) => (
                  <div
                    key={l}
                    className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{l}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 shrink-0"
                      onClick={() => handleExcluir("LOCAL", l)}
                      title="Excluir local"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ABA FABRICANTES */}
          <TabsContent value="fabricantes" className="flex-1 flex flex-col min-h-0 space-y-2.5 pt-2.5">
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Kidde, Mocelin, Resil, Bucka..."
                className="h-11 sm:h-10 text-sm"
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdicionar("FABRICANTE");
                  }
                }}
              />
              <Button onClick={() => handleAdicionar("FABRICANTE")} className="shrink-0 h-11 sm:h-10 px-3.5 sm:px-4 bg-primary text-white font-bold">
                <Plus className="w-4 h-4 mr-1" />
                <span>Adicionar</span>
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-xl p-2 space-y-1.5 bg-slate-50/50 dark:bg-slate-900/30">
              {fabricantes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum fabricante cadastrado ainda.</p>
              ) : (
                fabricantes.map((f) => (
                  <div
                    key={f}
                    className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-sm shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <Factory className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{f}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 shrink-0"
                      onClick={() => handleExcluir("FABRICANTE", f)}
                      title="Excluir fabricante"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-3 pt-2 border-t">
          <Button onClick={() => onOpenChange(false)} variant="default" className="w-full sm:w-auto h-11 sm:h-10 font-bold">
            Concluir e Voltar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
