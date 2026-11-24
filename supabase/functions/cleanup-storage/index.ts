/**
 * DESATIVADA de propósito.
 *
 * Esta função apagava TODOS os arquivos de seis pastas do Storage e podia
 * ser chamada por qualquer usuário logado (só conferia o login, não se era
 * administrador). A tela de Backups a chamava no fim de cada backup — que
 * não copiava os arquivos antes. Ela não apagou nada só porque as pastas
 * tinham mudado de nome.
 *
 * Agora só responde que foi desativada. O backup de verdade é a função
 * backup-diario, que COPIA os arquivos em vez de apagar.
 */
import { resolveCors } from "../_shared/cors.ts";

Deno.serve((req) => {
  const cors = resolveCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  return new Response(JSON.stringify({ error: "Função desativada: apagava os arquivos do sistema." }), {
    status: 410, headers: { ...cors, "Content-Type": "application/json" },
  });
});
