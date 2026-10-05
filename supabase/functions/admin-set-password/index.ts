import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { resolveCors } from "../_shared/cors.ts";

/*
 * Troca a senha de um usuário. Só o Super Administrador pode chamar.
 *
 * A autorização é feita aqui dentro: o JWT de quem chama é validado e a função
 * `is_super_admin` do banco decide. O e-mail do alvo vem do corpo, a senha
 * nunca é registrada em log.
 */
Deno.serve(async (req) => {
  const corsHeaders = resolveCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "Não autenticado" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: quem, error: erroToken } = await admin.auth.getUser(token);
    if (erroToken || !quem?.user) return json(401, { error: "Sessão inválida" });

    const { data: ehSuper, error: erroSuper } = await admin.rpc("is_super_admin", {
      _user_id: quem.user.id,
    });
    if (erroSuper || ehSuper !== true) {
      return json(403, { error: "Somente o Super Administrador pode alterar senhas" });
    }

    const { email, password } = await req.json();
    if (!email || typeof password !== "string") {
      return json(400, { error: "E-mail e nova senha são obrigatórios" });
    }
    if (password.length < 6) {
      return json(400, { error: "A senha deve ter no mínimo 6 caracteres" });
    }

    const alvoEmail = String(email).toLowerCase().trim();
    let alvo: { id: string } | undefined;
    for (let pagina = 1; pagina <= 20 && !alvo; pagina++) {
      const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
      if (error) return json(500, { error: error.message });
      alvo = data.users.find((u) => u.email?.toLowerCase() === alvoEmail);
      if (data.users.length < 1000) break;
    }
    if (!alvo) return json(404, { error: "Usuário ainda não tem login criado (nunca acessou o sistema)" });

    const { error: erroSenha } = await admin.auth.admin.updateUserById(alvo.id, { password });
    if (erroSenha) return json(400, { error: erroSenha.message });

    return json(200, { success: true });
  } catch (err) {
    console.error("admin-set-password:", (err as Error).message);
    return json(500, { error: (err as Error).message });
  }
});
