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
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary font-bold">
            <Building2 className="w-5 h-5 text-primary" />
            Cadastros de Apoio para Extintores (NR-23)
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Cadastre previamente os setores, locais e fabricantes para selecioná-los rapidamente com um clique no cadastro de extintores, evitando digitação manual repetitiva.
        </p>

        <Tabs value={tab} onValueChange={setTab} className="w-full flex-1 flex flex-col min-h-0 mt-2">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="setores" className="flex items-center gap-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5" />
              Setores / Áreas ({setores.length})
            </TabsTrigger>
            <TabsTrigger value="locais" className="flex items-center gap-1.5 text-xs">
              <MapPin className="w-3.5 h-3.5" />
              Locais ({locais.length})
            </TabsTrigger>
            <TabsTrigger value="fabricantes" className="flex items-center gap-1.5 text-xs">
              <Factory className="w-3.5 h-3.5" />
              Fabricantes ({fabricantes.length})
            </TabsTrigger>
          </TabsList>

          {/* ABA SETORES */}
          <TabsContent value="setores" className="flex-1 flex flex-col min-h-0 space-y-3 pt-3">
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Almoxarifado, Costura, Manutenção..."
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdicionar("SETOR");
                  }
                }}
              />
              <Button onClick={() => handleAdicionar("SETOR")} className="shrink-0 bg-primary text-white">
                <Plus className="w-4 h-4 mr-1" />
                Adicionar Setor
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-md p-2 space-y-1.5 bg-slate-50/50 dark:bg-slate-900/30">
              {setores.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum setor cadastrado ainda.</p>
              ) : (
                setores.map((s) => (
                  <div
                    key={s}
                    className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-sm hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200">{s}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                      onClick={() => handleExcluir("SETOR", s)}
                      title="Excluir setor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ABA LOCAIS */}
          <TabsContent value="locais" className="flex-1 flex flex-col min-h-0 space-y-3 pt-3">
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Próximo à porta principal, Coluna B..."
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdicionar("LOCAL");
                  }
                }}
              />
              <Button onClick={() => handleAdicionar("LOCAL")} className="shrink-0 bg-primary text-white">
                <Plus className="w-4 h-4 mr-1" />
                Adicionar Local
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-md p-2 space-y-1.5 bg-slate-50/50 dark:bg-slate-900/30">
              {locais.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum local cadastrado ainda.</p>
              ) : (
                locais.map((l) => (
                  <div
                    key={l}
                    className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-sm hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200">{l}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                      onClick={() => handleExcluir("LOCAL", l)}
                      title="Excluir local"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* ABA FABRICANTES */}
          <TabsContent value="fabricantes" className="flex-1 flex flex-col min-h-0 space-y-3 pt-3">
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Kidde, Mocelin, Resil, Bucka..."
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdicionar("FABRICANTE");
                  }
                }}
              />
              <Button onClick={() => handleAdicionar("FABRICANTE")} className="shrink-0 bg-primary text-white">
                <Plus className="w-4 h-4 mr-1" />
                Adicionar Marca
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-md p-2 space-y-1.5 bg-slate-50/50 dark:bg-slate-900/30">
              {fabricantes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum fabricante cadastrado ainda.</p>
              ) : (
                fabricantes.map((f) => (
                  <div
                    key={f}
                    className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-sm hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Factory className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200">{f}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                      onClick={() => handleExcluir("FABRICANTE", f)}
                      title="Excluir fabricante"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 pt-2 border-t">
          <Button onClick={() => onOpenChange(false)} variant="default">
            Concluir e Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
