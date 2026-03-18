
## Plano: Criar módulo "Gestão de Documentos" no menu lateral

### O que será feito

Agrupar os itens **"Gestão e Controle"** (renomeado para **"Controle de Documentos"**) e **"Exames"** (renomeado para **"Controle de Exames"**) dentro de um novo grupo colapsável chamado **"Gestão de Documentos"** no menu lateral — seguindo o mesmo padrão visual dos grupos "Gestão de EPIs" e "Cadastro".

### Alterações

**`src/components/AppLayout.tsx`**:
- Remover `treinamentos` e `exames` do array `afterCadastroItems`
- Criar novo array `gestaoDocItems` com:
  - `{ path: "/treinamentos", label: "Controle de Documentos", icon: GraduationCap, moduleKey: "treinamentos" }`
  - `{ path: "/exames", label: "Controle de Exames", icon: Stethoscope, moduleKey: "exames" }`
- Adicionar estado `gestaoDocOpen` para controlar expansão/colapso
- Renderizar o grupo colapsável com ícone `FileText` entre o grupo Cadastro e os itens restantes (Lista de Presença, Inspeções, Treinamentos em Vídeo)

**`src/pages/Treinamentos.tsx`**: Atualizar título da página para "Controle de Documentos"

**`src/pages/ExamesModule.tsx`**: Atualizar título da página para "Controle de Exames"
