import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History } from "lucide-react";

export interface MovementRow {
  id: string;
  data: string;
  origem: string;
  destino: string;
  epi_nome: string;
  quantidade: number;
  tipo: string;
  responsavel: string;
  valor_unitario?: number;
}

interface Props {
  movements: MovementRow[];
  title?: string;
}

const tipoColors: Record<string, string> = {
  transferencia: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  entrada: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  saida: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  entrega: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  devolucao: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

export default function StockMovementTable({ movements, title = "Histórico de Movimentações" }: Props) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[350px]">
          <Table>
            <TableHeader>
              <TableRow className="text-[11px]">
                <TableHead className="px-3">Data</TableHead>
                <TableHead className="px-3">Tipo</TableHead>
                <TableHead className="px-3">EPI</TableHead>
                <TableHead className="px-3">Origem</TableHead>
                <TableHead className="px-3">Destino</TableHead>
                <TableHead className="px-3 text-right">Qtd</TableHead>
                <TableHead className="px-3">Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-8">
                    Nenhuma movimentação registrada
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((m) => (
                  <TableRow key={m.id} className="text-xs">
                    <TableCell className="px-3 whitespace-nowrap">
                      {format(new Date(m.data), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="px-3">
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${tipoColors[m.tipo] || ""}`}>
                        {m.tipo === "transferencia" ? "Transferência" : m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 max-w-[160px] truncate">{m.epi_nome}</TableCell>
                    <TableCell className="px-3 max-w-[120px] truncate">{m.origem}</TableCell>
                    <TableCell className="px-3 max-w-[120px] truncate">{m.destino}</TableCell>
                    <TableCell className="px-3 text-right font-semibold">{m.quantidade}</TableCell>
                    <TableCell className="px-3 max-w-[100px] truncate">{m.responsavel}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
