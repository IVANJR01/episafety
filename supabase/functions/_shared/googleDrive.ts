/**
 * Conversa com o Google Drive para o backup (backup-diario e google-drive).
 *
 * Os segredos (Client ID/Secret e o token de acesso de longa duração) ficam
 * no Vault e são lidos pela função drive_segredos(), que só a chave de
 * serviço executa. Escopo drive.file: o sistema só vê o que ele criou.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const ESCOPO = "https://www.googleapis.com/auth/drive.file openid email";
export const NOME_DA_PASTA = "SafetySoluções - Backups";

export interface Segredos { client_id: string | null; client_secret: string | null; refresh_token: string | null }

export async function lerSegredos(admin: SupabaseClient): Promise<Segredos> {
  const { data, error } = await admin.rpc("drive_segredos");
  if (error) throw new Error(`segredos do Drive: ${error.message}`);
  return data as Segredos;
}

/** Troca o token de longa duração por um de acesso (vale ~1 hora). */
export async function tokenDeAcesso(s: Segredos): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: s.client_id!, client_secret: s.client_secret!,
      refresh_token: s.refresh_token!, grant_type: "refresh_token",
    }),
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) {
    throw new Error(d.error === "invalid_grant"
      ? "A autorização do Google expirou ou foi retirada. Conecte o Google Drive de novo na tela de Backups."
      : `Google recusou o acesso: ${d.error_description || d.error || r.status}`);
  }
  return d.access_token;
}

const aspas = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/** Acha (ou cria) uma pasta pelo nome dentro de outra. */
export async function garantirPasta(token: string, nome: string, pai?: string | null): Promise<string> {
  const q = `name='${aspas(nome)}' and mimeType='application/vnd.google-apps.folder' and trashed=false` +
    (pai ? ` and '${pai}' in parents` : "");
  const busca = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const achou = await busca.json();
  if (achou?.files?.[0]?.id) return achou.files[0].id;
  const cria = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: nome, mimeType: "application/vnd.google-apps.folder", ...(pai ? { parents: [pai] } : {}) }),
  });
  const criada = await cria.json();
  if (!cria.ok || !criada.id) throw new Error(`criar pasta "${nome}": ${JSON.stringify(criada).slice(0, 200)}`);
  return criada.id;
}

/**
 * Envia um arquivo (envio "retomável", que aceita qualquer tamanho). Com
 * `substituir`, grava por cima do arquivo com esse id em vez de criar outro.
 */
export async function enviarArquivo(
  token: string, pasta: string, nome: string, conteudo: Uint8Array, tipo: string, substituir?: string,
): Promise<string> {
  const inicio = await fetch(
    substituir
      ? `https://www.googleapis.com/upload/drive/v3/files/${substituir}?uploadType=resumable&fields=id`
      : "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id",
    {
      method: substituir ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": tipo, "X-Upload-Content-Length": String(conteudo.length),
      },
      body: JSON.stringify(substituir ? { name: nome } : { name: nome, parents: [pasta] }),
    },
  );
  if (!inicio.ok) throw new Error(`iniciar envio de ${nome}: HTTP ${inicio.status} ${(await inicio.text()).slice(0, 200)}`);
  await inicio.body?.cancel();
  const destino = inicio.headers.get("location");
  if (!destino) throw new Error(`iniciar envio de ${nome}: sem endereço de envio`);
  const envio = await fetch(destino, { method: "PUT", headers: { "Content-Type": tipo }, body: conteudo });
  const d = await envio.json().catch(() => ({}));
  if (!envio.ok || !d.id) throw new Error(`enviar ${nome}: HTTP ${envio.status} ${JSON.stringify(d).slice(0, 200)}`);
  return d.id;
}

export async function apagar(token: string, id: string): Promise<void> {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${token}` },
  });
  await r.body?.cancel();
}
