import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { resolveCors } from "../_shared/cors.ts";
import { checkRateLimit, clientKey } from "../_shared/rateLimit.ts";
Deno.serve(async (req) => {
  const corsHeaders = resolveCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }


  const __rl_ok = await checkRateLimit({ key: clientKey(req, null, "create-user"), limit: 5, windowSeconds: 60 });
  if (!__rl_ok) {
    return new Response(JSON.stringify({ error: "Rate limit excedido. Aguarde alguns segundos e tente novamente." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const { email, password, nome, empresa_id } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: { nome: nome || "" },
    });

    if (createError) {
      console.error("Create user error:", createError.message);
      // If user already exists, find their id and update their password
      if (createError.message.includes("already been registered")) {
        const { data: listData } = await adminClient.auth.admin.listUsers();
        const existingUser = listData?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase().trim()
        );
        if (existingUser) {
          // Update password for existing user
          await adminClient.auth.admin.updateUserById(existingUser.id, { password });
          // Also update empresa_id on profile if provided
          if (empresa_id) {
            await adminClient.from("profiles").update({ empresa_id }).eq("user_id", existingUser.id);
          }
          return new Response(JSON.stringify({ user_id: existingUser.id, already_exists: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update empresa_id on the profile created by trigger (which doesn't set empresa_id)
    if (empresa_id && newUser.user.id) {
      // Small delay to ensure trigger has fired and profile exists
      await new Promise((r) => setTimeout(r, 500));
      await adminClient.from("profiles").update({ empresa_id }).eq("user_id", newUser.user.id);
    }

    return new Response(JSON.stringify({ user_id: newUser.user.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
