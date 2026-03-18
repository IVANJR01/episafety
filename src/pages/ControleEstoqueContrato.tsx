import ContratoStockPanel from "@/components/ContratoStockPanel";

export default function ControleEstoqueContrato() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Controle de Estoque por Unidade</h1>
        <p className="text-muted-foreground text-sm">Gerencie o estoque de EPIs vinculado a cada unidade</p>
      </div>
      <ContratoStockPanel />
    </div>
  );
}
