
-- ============================================================
-- FASE 3 v3 — RLS Portal RH ASO (tenant-strict, RH read-only)
-- ============================================================

-- ---------- A. HELPERS ----------
create or replace function public.has_aso_full_access(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_super_admin(_user_id)
    or public.is_principal(_user_id)
    or exists (
      select 1
      from public.usuarios_liberados u
      where u.email = (select email from auth.users where id = _user_id)
        and coalesce(u.ativo, true) = true
        and (
          u.modulos_permitidos && array['aso','pcmso','cat','pgr','ltcat','ppp','admin']
          or exists (
            select 1 from unnest(u.modulos_permitidos) p
            where p like 'aso:%' or p like 'pcmso:%' or p like 'cat:%'
               or p like 'pgr:%' or p like 'ltcat:%' or p like 'ppp:%'
          )
        )
    )
$$;

revoke all on function public.has_aso_full_access(uuid) from public;
grant execute on function public.has_aso_full_access(uuid) to authenticated, service_role;

-- ---------- B. FLAG liberado_portal_rh + TRIGGER ----------
alter table public.asos
  add column if not exists liberado_portal_rh boolean not null default false;

create or replace function public.sync_aso_liberado_portal_rh()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.liberado_portal_rh :=
    coalesce(new.status, '') in ('assinado','concluido','finalizado')
    and new.pdf_url is not null
    and length(trim(new.pdf_url)) > 0;
  return new;
end$$;

revoke all on function public.sync_aso_liberado_portal_rh() from public;
grant execute on function public.sync_aso_liberado_portal_rh() to authenticated, service_role;

drop trigger if exists trg_sync_aso_liberado_portal_rh on public.asos;
create trigger trg_sync_aso_liberado_portal_rh
  before insert or update of status, pdf_url on public.asos
  for each row execute function public.sync_aso_liberado_portal_rh();

-- backfill
update public.asos
   set liberado_portal_rh = (
     coalesce(status, '') in ('assinado','concluido','finalizado')
     and pdf_url is not null
     and length(trim(pdf_url)) > 0
   )
 where liberado_portal_rh is distinct from (
     coalesce(status, '') in ('assinado','concluido','finalizado')
     and pdf_url is not null
     and length(trim(pdf_url)) > 0
   );

-- ---------- C. DROP policies abertas / v1 ----------
drop policy if exists "RH read asos liberados"        on public.asos;
drop policy if exists "asos_isolation_select"         on public.asos;
drop policy if exists "asos_isolation_insert"         on public.asos;
drop policy if exists "asos_isolation_update"         on public.asos;
drop policy if exists "asos_isolation_delete"         on public.asos;

drop policy if exists "RH read aso_exames"            on public.aso_exames;
drop policy if exists "aso_exames_via_aso"            on public.aso_exames;

drop policy if exists "RH read aso_assinaturas"       on public.aso_assinaturas;
drop policy if exists "aso_assin_via_aso"             on public.aso_assinaturas;

drop policy if exists "RH read aso_medicos"           on public.aso_medicos;
drop policy if exists "RH read locais_emissao_aso"    on public.locais_emissao_aso;
drop policy if exists "RH read funcionarios"          on public.funcionarios;

-- ---------- D. POLICIES FINAIS — asos ----------
create policy "asos_select_v3" on public.asos for select to authenticated
using (
  public.is_super_admin(auth.uid())
  or (
    public.is_in_user_company_tree(auth.uid(), empresa_id)
    and (
      public.is_principal(auth.uid())
      or public.has_aso_full_access(auth.uid())
      or (
        public.has_permission(auth.uid(), 'portal_rh:aso:visualizar')
        and liberado_portal_rh = true
      )
    )
  )
);

create policy "asos_insert_v3" on public.asos for insert to authenticated
with check (
  public.is_super_admin(auth.uid())
  or (
    public.is_in_user_company_tree(auth.uid(), empresa_id)
    and (public.is_principal(auth.uid()) or public.has_aso_full_access(auth.uid()))
  )
);

create policy "asos_update_v3" on public.asos for update to authenticated
using (
  public.is_super_admin(auth.uid())
  or (
    public.is_in_user_company_tree(auth.uid(), empresa_id)
    and (public.is_principal(auth.uid()) or public.has_aso_full_access(auth.uid()))
  )
)
with check (
  public.is_super_admin(auth.uid())
  or (
    public.is_in_user_company_tree(auth.uid(), empresa_id)
    and (public.is_principal(auth.uid()) or public.has_aso_full_access(auth.uid()))
  )
);

create policy "asos_delete_v3" on public.asos for delete to authenticated
using (
  public.is_super_admin(auth.uid())
  or (
    public.is_in_user_company_tree(auth.uid(), empresa_id)
    and (public.is_principal(auth.uid()) or public.has_aso_full_access(auth.uid()))
  )
);

-- ---------- E. POLICIES FINAIS — aso_exames ----------
create policy "aso_exames_select_v3" on public.aso_exames for select to authenticated
using (exists (
  select 1 from public.asos a
  where a.id = aso_exames.aso_id
    and (
      public.is_super_admin(auth.uid())
      or (
        public.is_in_user_company_tree(auth.uid(), a.empresa_id)
        and (
          public.is_principal(auth.uid())
          or public.has_aso_full_access(auth.uid())
          or (
            public.has_permission(auth.uid(), 'portal_rh:aso:visualizar')
            and a.liberado_portal_rh = true
          )
        )
      )
    )
));

create policy "aso_exames_insert_v3" on public.aso_exames for insert to authenticated
with check (exists (
  select 1 from public.asos a
  where a.id = aso_exames.aso_id
    and (
      public.is_super_admin(auth.uid())
      or (
        public.is_in_user_company_tree(auth.uid(), a.empresa_id)
        and (public.is_principal(auth.uid()) or public.has_aso_full_access(auth.uid()))
      )
    )
));

create policy "aso_exames_update_v3" on public.aso_exames for update to authenticated
using (exists (
  select 1 from public.asos a
  where a.id = aso_exames.aso_id
    and (
      public.is_super_admin(auth.uid())
      or (
        public.is_in_user_company_tree(auth.uid(), a.empresa_id)
        and (public.is_principal(auth.uid()) or public.has_aso_full_access(auth.uid()))
      )
    )
))
with check (exists (
  select 1 from public.asos a
  where a.id = aso_exames.aso_id
    and (
      public.is_super_admin(auth.uid())
      or (
        public.is_in_user_company_tree(auth.uid(), a.empresa_id)
        and (public.is_principal(auth.uid()) or public.has_aso_full_access(auth.uid()))
      )
    )
));

create policy "aso_exames_delete_v3" on public.aso_exames for delete to authenticated
using (exists (
  select 1 from public.asos a
  where a.id = aso_exames.aso_id
    and (
      public.is_super_admin(auth.uid())
      or (
        public.is_in_user_company_tree(auth.uid(), a.empresa_id)
        and (public.is_principal(auth.uid()) or public.has_aso_full_access(auth.uid()))
      )
    )
));

-- ---------- F. POLICIES FINAIS — aso_assinaturas ----------
create policy "aso_assinaturas_select_v3" on public.aso_assinaturas for select to authenticated
using (exists (
  select 1 from public.asos a
  where a.id = aso_assinaturas.aso_id
    and (
      public.is_super_admin(auth.uid())
      or (
        public.is_in_user_company_tree(auth.uid(), a.empresa_id)
        and (
          public.is_principal(auth.uid())
          or public.has_aso_full_access(auth.uid())
          or (
            public.has_permission(auth.uid(), 'portal_rh:aso:visualizar')
            and a.liberado_portal_rh = true
          )
        )
      )
    )
));

create policy "aso_assinaturas_insert_v3" on public.aso_assinaturas for insert to authenticated
with check (exists (
  select 1 from public.asos a
  where a.id = aso_assinaturas.aso_id
    and (
      public.is_super_admin(auth.uid())
      or (
        public.is_in_user_company_tree(auth.uid(), a.empresa_id)
        and (public.is_principal(auth.uid()) or public.has_aso_full_access(auth.uid()))
      )
    )
));

create policy "aso_assinaturas_update_v3" on public.aso_assinaturas for update to authenticated
using (exists (
  select 1 from public.asos a
  where a.id = aso_assinaturas.aso_id
    and (
      public.is_super_admin(auth.uid())
      or (
        public.is_in_user_company_tree(auth.uid(), a.empresa_id)
        and (public.is_principal(auth.uid()) or public.has_aso_full_access(auth.uid()))
      )
    )
))
with check (exists (
  select 1 from public.asos a
  where a.id = aso_assinaturas.aso_id
    and (
      public.is_super_admin(auth.uid())
      or (
        public.is_in_user_company_tree(auth.uid(), a.empresa_id)
        and (public.is_principal(auth.uid()) or public.has_aso_full_access(auth.uid()))
      )
    )
));

create policy "aso_assinaturas_delete_v3" on public.aso_assinaturas for delete to authenticated
using (exists (
  select 1 from public.asos a
  where a.id = aso_assinaturas.aso_id
    and (
      public.is_super_admin(auth.uid())
      or (
        public.is_in_user_company_tree(auth.uid(), a.empresa_id)
        and (public.is_principal(auth.uid()) or public.has_aso_full_access(auth.uid()))
      )
    )
));

-- ---------- G. SELECT auxiliar RH ----------
create policy "aso_medicos_rh_select_v3" on public.aso_medicos for select to authenticated
using (
  public.has_permission(auth.uid(), 'portal_rh:aso:visualizar')
  and empresa_id is not null
  and public.is_in_user_company_tree(auth.uid(), empresa_id)
);

create policy "locais_emissao_rh_select_v3" on public.locais_emissao_aso for select to authenticated
using (
  public.has_permission(auth.uid(), 'portal_rh:aso:visualizar')
  and public.is_in_user_company_tree(auth.uid(), empresa_id)
);

create policy "funcionarios_rh_select_v3" on public.funcionarios for select to authenticated
using (
  public.has_permission(auth.uid(), 'portal_rh:funcionarios:visualizar')
  and public.is_in_user_company_tree(auth.uid(), empresa_id)
);
