import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Volta para a Central de Documentação.
 *
 * Todas as sete telas que a Central abre — PGR, PCMSO, LTCAT, PPP, Ordem de
 * Serviço e os dois Laudos — não tinham nenhuma volta. Quem entrava por
 * "Elaborar Documentos" ficava sem caminho de retorno dentro da própria tela:
 * a única saída era procurar "Documentação SST" no menu lateral, que fica
 * dentro de um grupo recolhível e não diz que leva ao Repositório Técnico.
 *
 * Curiosamente as telas de DENTRO do PGR (detalhe, assistente, painel) já
 * tinham "Voltar para a lista". Faltava justamente o degrau de cima.
 *
 * Volta para a aba de onde se veio ("Elaborar documentos"), não para a
 * primeira: cair na Base Técnica depois de sair de um documento faz parecer
 * que a navegação se perdeu.
 *
 * O `empresa_id` da URL não precisa ser repassado — o EmpresaQuerySync
 * recoloca a empresa ativa na query string a cada navegação.
 */
export default function VoltarParaCentral({ aba = "elaborar" }: { aba?: string }) {
  return (
    <Link
      to={`/documentacao-sst?aba=${aba}`}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      Voltar para a Central de Documentação
    </Link>
  );
}
