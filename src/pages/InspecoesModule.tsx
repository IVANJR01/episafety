import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClipboardList, HardHat } from "lucide-react";
import InspecoesSE from "./InspecoesSE";
import Obras from "./Obras";

/**
 * Inspeções e Apontamentos, com o cadastro de locais junto.
 *
 * "Locais e Obras" era um item solto no menu, ao lado das inspeções. Mas
 * local não é assunto próprio: ele existe para a inspeção acontecer em
 * algum lugar, e quem vai lançar uma inspeção numa obra nova tinha de
 * sair da tela, achar outro item do menu, cadastrar e voltar.
 *
 * As duas viraram abas da mesma tela. A rota antiga /inspecoes-se/obras
 * continua valendo e abre na aba certa — há link e favorito apontando
 * para ela.
 */
export default function InspecoesModule({ abaInicial }: { abaInicial?: "locais" } = {}) {
  const [params, setParams] = useSearchParams();
  const aba = abaInicial || params.get("aba") || "inspecoes";

  const trocar = (v: string) => {
    const p = new URLSearchParams(params);
    if (v === "inspecoes") p.delete("aba");
    else p.set("aba", v);
    setParams(p, { replace: true });
  };

  return (
    <div className="space-y-4">
      <Tabs value={aba === "locais" ? "locais" : "inspecoes"} onValueChange={trocar}>
        <TabsList>
          <TabsTrigger value="inspecoes" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />Inspeções e Apontamentos
          </TabsTrigger>
          <TabsTrigger value="locais" className="gap-1.5">
            <HardHat className="h-4 w-4" />Locais e Obras
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inspecoes" className="mt-4">
          <InspecoesSE />
        </TabsContent>
        <TabsContent value="locais" className="mt-4">
          <Obras embutido />
        </TabsContent>
      </Tabs>
    </div>
  );
}
