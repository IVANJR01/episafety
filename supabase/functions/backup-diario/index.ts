/**
 * Backup diário de TUDO para uma pasta privada do Storage (backups-sistema).
 *
 * Modos (corpo JSON `{ modo }`):
 *  - "completo": todas as tabelas do esquema public + contas de usuário
 *    (sem senha), um arquivo .json por tabela, um resumo.json, limpeza dos
 *    dias com mais de 30 dias, e depois a cópia dos arquivos;
 *  - "arquivos": só continua a cópia espelho dos arquivos (lote limitado
 *    por tempo e tamanho; o que sobrar vai na próxima execução);
 *  - "links": para a tela de Backups — os dias guardados e, do dia pedido,
 *    os links de download (1 hora). O .zip é montado no navegador.
 *
 * Por que sem .zip aqui: no plano gratuito cada execução tem ~2 s de
 * processador. Ler as tabelas como objetos e compactar estourava esse
 * limite (WORKER_RESOURCE_LIMIT). Agora o texto que a API devolve vai
 * direto para o arquivo, sem ser interpretado nem compactado.
 *
 * Quem pode chamar: o agendamento (cabeçalho x-chave-backup, conferido com
 * o Vault) ou um super admin logado. Ninguém mais.
 *
 * Detalhes em supabase/migrations/20261124120000_backup_diario.sql.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { resolveCors } from "../_shared/cors.ts";

const PASTA = "backups-sistema";
const DIAS_GUARDADOS = 30;
/** A função tem tempo máximo de execução; para antes, com folga. */
const TEMPO_MAX_MS = 110_000;
const BYTES_MAX_POR_EXECUCAO = 80 * 1024 * 1024;
const LINHAS_POR_PAGINA = 1000;

const json = (cors: Record<string, string>, corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

/** Data de hoje em Brasília (o backup das 03:00 é "de hoje", não de ontem em UTC). */
function hojeBrasilia(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

async function autorizado(req: Request, admin: SupabaseClient): Promise<boolean> {
  const chave = req.headers.get("x-chave-backup");
  if (chave) {
    const { data } = await admin.rpc("backup_chave_confere", { chave });
    return data === true;
  }
  const auth = req.headers.get("Authorization");
  if (!auth) return false;
  const usuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await usuario.auth.getUser();
  if (!u?.user) return false;
  const { data: ehAdmin } = await admin.rpc("is_super_admin", { _user_id: u.user.id });
  return ehAdmin === true;
}

const enc = new TextEncoder();

/**
 * A tabela inteira, como o TEXTO JSON que a API devolve, em páginas de
 * 1000 linhas. As páginas são emendadas como texto ("[a,b]" + "[c]" →
 * "[a,b,c]"), sem interpretar nada — é isso que cabe no limite de
 * processador.
 */
async function lerTabelaComoTexto(tabela: string): Promise<{ texto: string; linhas: number }> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const partes: string[] = [];
  let total = -1;
  let comOrdem = true;
  for (let de = 0; ; de += LINHAS_POR_PAGINA) {
    const pedir = () => fetch(`${url}/rest/v1/${encodeURIComponent(tabela)}?select=*${comOrdem ? "&order=id" : ""}`, {
      headers: {
        apikey: chave, Authorization: `Bearer ${chave}`,
        "Range-Unit": "items", Range: `${de}-${de + LINHAS_POR_PAGINA - 1}`,
        Prefer: "count=exact",
      },
    });
    let r = await pedir();
    // Tabela sem coluna id: vai sem ordem.
    if (r.status === 400 && comOrdem) { await r.text(); comOrdem = false; r = await pedir(); }
    if (!r.ok && r.status !== 206 && r.status !== 416) throw new Error(`${tabela}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    if (r.status === 416) { await r.text(); break; } // pediu além do fim
    const total_ = r.headers.get("content-range")?.split("/")[1];
    if (total_ && total_ !== "*") total = Number(total_);
    const t = (await r.text()).trim();
    const miolo = t.slice(1, -1).trim(); // tira os colchetes
    if (miolo) partes.push(miolo);
    if (total >= 0 ? de + LINHAS_POR_PAGINA >= total : !miolo) break;
  }
  return { texto: `[${partes.join(",")}]`, linhas: Math.max(total, 0) };
}

async function backupDasTabelas(admin: SupabaseClient, dia: string, inicio: number) {
  const { data: tabelas, error } = await admin.rpc("backup_listar_tabelas");
  if (error) throw new Error(`listar tabelas: ${error.message}`);
  const base = `diario/${dia}`;
  const contagem: Record<string, number> = {};
  const falhas: Record<string, string> = {};
  let linhas = 0;
  for (const t of (tabelas as string[]) || []) {
    if (Date.now() - inicio > TEMPO_MAX_MS) { falhas[t] = "sem tempo nesta execução"; continue; }
    try {
      const { texto, linhas: n } = await lerTabelaComoTexto(t);
      const up = await admin.storage.from(PASTA).upload(`${base}/tabelas/${t}.json`, enc.encode(texto), {
        contentType: "application/json", upsert: true,
      });
      if (up.error) throw new Error(up.error.message);
      contagem[t] = n;
      linhas += n;
    } catch (e) {
      falhas[t] = (e as Error).message;
    }
  }
  const { data: usuarios, error: eu } = await admin.rpc("backup_usuarios");
  if (eu) falhas["(usuários)"] = eu.message;
  else await admin.storage.from(PASTA).upload(`${base}/usuarios.json`, enc.encode(JSON.stringify(usuarios)), {
    contentType: "application/json", upsert: true,
  });

  const resumo = {
    gerado_em: new Date().toISOString(),
    dia,
    tabelas: contagem,
    usuarios: Array.isArray(usuarios) ? usuarios.length : 0,
    total_linhas: linhas,
    falhas,
    como_restaurar: "Cada arquivo em tabelas/ é a tabela inteira em JSON (lista de linhas). " +
      "Arquivos (PDFs, fotos) ficam em arquivos/ na mesma pasta privada.",
  };
  await admin.storage.from(PASTA).upload(`${base}/resumo.json`, enc.encode(JSON.stringify(resumo, null, 2)), {
    contentType: "application/json", upsert: true,
  });
  return { pasta: base, tabelas: Object.keys(contagem).length, linhas, falhas };
}

/** Apaga os dias com mais de DIAS_GUARDADOS. A cópia dos arquivos não é apagada. */
async function limparDiasAntigos(admin: SupabaseClient, hoje: string) {
  const { data: dias } = await admin.rpc("backup_pastas_diarias");
  const limite = new Date(Date.parse(`${hoje}T00:00:00Z`) - DIAS_GUARDADOS * 86400_000).toISOString().slice(0, 10);
  const apagados: string[] = [];
  for (const d of (dias as string[]) || []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d >= limite) continue;
    const [{ data: raiz }, { data: tabs }] = await Promise.all([
      admin.storage.from(PASTA).list(`diario/${d}`, { limit: 100 }),
      admin.storage.from(PASTA).list(`diario/${d}/tabelas`, { limit: 1000 }),
    ]);
    const caminhos = [
      ...(raiz || []).filter((i) => i.id).map((i) => `diario/${d}/${i.name}`),
      ...(tabs || []).map((i) => `diario/${d}/tabelas/${i.name}`),
    ];
    if (caminhos.length) await admin.storage.from(PASTA).remove(caminhos);
    apagados.push(d);
  }
  return apagados;
}

/** Copia para arquivos/<pasta>/<nome> o que é novo ou mudou desde a última cópia. */
async function copiarArquivos(admin: SupabaseClient, inicio: number) {
  const [{ data: origem, error: e1 }, { data: copiados, error: e2 }] = await Promise.all([
    admin.rpc("backup_listar_arquivos"),
    admin.rpc("backup_arquivos_ja_copiados"),
  ]);
  if (e1 || e2) throw new Error(`listar arquivos: ${(e1 || e2)!.message}`);
  const jaTem = new Map<string, string>(((copiados as any[]) || []).map((c) => [c.caminho, c.atualizado_em]));
  const pendentes = ((origem as any[]) || []).filter((o) => {
    const c = jaTem.get(`arquivos/${o.pasta}/${o.nome}`);
    return !c || Date.parse(c) < Date.parse(o.atualizado_em);
  });
  let copiadosAgora = 0, bytes = 0;
  const erros: string[] = [];
  for (const o of pendentes) {
    if (Date.now() - inicio > TEMPO_MAX_MS || bytes > BYTES_MAX_POR_EXECUCAO) break;
    const baixado = await admin.storage.from(o.pasta).download(o.nome);
    if (baixado.error || !baixado.data) { erros.push(`${o.pasta}/${o.nome}: ${baixado.error?.message}`); continue; }
    const conteudo = new Uint8Array(await baixado.data.arrayBuffer());
    const up = await admin.storage.from(PASTA).upload(`arquivos/${o.pasta}/${o.nome}`, conteudo, {
      contentType: baixado.data.type || "application/octet-stream", upsert: true,
    });
    if (up.error) { erros.push(`${o.pasta}/${o.nome}: ${up.error.message}`); continue; }
    copiadosAgora++;
    bytes += conteudo.length;
  }
  return { copiados: copiadosAgora, pendentes: pendentes.length - copiadosAgora, bytes, erros: erros.slice(0, 20) };
}

/** Os dias guardados; com `dia`, os links de download de cada arquivo daquele dia. */
async function links(admin: SupabaseClient, dia?: string) {
  const { data: dias } = await admin.rpc("backup_pastas_diarias");
  const lista = ((dias as string[]) || []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
  if (!dia || !lista.includes(dia)) return { dias: lista };
  const { data: tabs } = await admin.storage.from(PASTA).list(`diario/${dia}/tabelas`, { limit: 1000 });
  const caminhos = [
    `diario/${dia}/resumo.json`, `diario/${dia}/usuarios.json`,
    ...(tabs || []).map((t) => `diario/${dia}/tabelas/${t.name}`),
  ];
  const { data } = await admin.storage.from(PASTA).createSignedUrls(caminhos, 3600);
  return {
    dias: lista,
    arquivos: (data || []).filter((x) => x.signedUrl).map((x) => ({
      nome: (x.path || "").replace(`diario/${dia}/`, ""), url: x.signedUrl,
    })),
  };
}

Deno.serve(async (req) => {
  const cors = resolveCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  if (!(await autorizado(req, admin))) return json(cors, { error: "Não autorizado" }, 401);

  let modo = "completo";
  let diaPedido: string | undefined;
  try { const b = await req.json(); modo = b?.modo || "completo"; diaPedido = b?.dia; } catch { /* sem corpo */ }

  if (modo === "links") return json(cors, await links(admin, diaPedido));

  const inicio = Date.now();
  const { data: exec } = await admin.from("backup_execucoes").insert({ modo }).select("id").single();
  const registrar = (campos: Record<string, unknown>) =>
    exec?.id ? admin.from("backup_execucoes").update(campos).eq("id", exec.id) : Promise.resolve();

  try {
    const dia = hojeBrasilia();
    let tabelas: Awaited<ReturnType<typeof backupDasTabelas>> | null = null;
    let limpos: string[] = [];
    if (modo === "completo") {
      tabelas = await backupDasTabelas(admin, dia, inicio);
      limpos = await limparDiasAntigos(admin, dia);
    }
    const arquivos = await copiarArquivos(admin, inicio);
    const falhou = (tabelas && Object.keys(tabelas.falhas).length > 0) || arquivos.erros.length > 0;
    const resultado = {
      terminado_em: new Date().toISOString(),
      status: falhou ? "parcial" : "ok",
      pasta: tabelas?.pasta ?? null,
      tabelas: tabelas?.tabelas ?? null,
      linhas: tabelas?.linhas ?? null,
      arquivos_copiados: arquivos.copiados,
      arquivos_pendentes: arquivos.pendentes,
      bytes_copiados: arquivos.bytes,
      detalhes: { falhas_tabelas: tabelas?.falhas ?? {}, erros_arquivos: arquivos.erros, dias_apagados: limpos },
    };
    await registrar(resultado);
    return json(cors, { ok: true, ...resultado });
  } catch (e) {
    const erro = (e as Error).message;
    await registrar({ terminado_em: new Date().toISOString(), status: "erro", erro });
    return json(cors, { ok: false, erro }, 500);
  }
});
