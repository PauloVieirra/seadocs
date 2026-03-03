import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ROLE_TO_TIPO: Record<string, string> = {
  admin: 'Administrador',
  director: 'Diretor',
  manager: 'Gerente',
  technical_responsible: 'Responsável Técnico',
  operational: 'Operacional',
  external: 'Usuário Externo',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Não autorizado' }, { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) {
      return Response.json({ error: 'Não autorizado' }, { status: 401, headers: corsHeaders });
    }

    const { email, password, name, role } = await req.json();
    if (!email || !password || !name) {
      return Response.json(
        { error: 'email, password e name são obrigatórios' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (password.length < 6) {
      return Response.json(
        { error: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400, headers: corsHeaders }
      );
    }

    const validRoles = ['admin', 'director', 'manager', 'technical_responsible', 'operational', 'external'];
    const userRole = (role || 'operational').toLowerCase();
    if (!validRoles.includes(userRole)) {
      return Response.json({ error: 'Papel inválido' }, { status: 400, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: callerUser } = await supabaseAdmin.from('users').select('role').eq('id', caller.id).single();
    const { data: callerPerms } = await supabaseAdmin.from('permissions').select('gerenciar_usuarios, acesso_total').eq('user_id', caller.id).single();
    const callerRole = (callerUser?.role as string)?.toLowerCase();
    const hasPerm = callerPerms?.gerenciar_usuarios === true || callerPerms?.acesso_total === true;
    const canManage = hasPerm || ['admin', 'manager', 'technical_responsible'].includes(callerRole ?? '');
    if (!canManage) {
      return Response.json({ error: 'Sem permissão para cadastrar usuários' }, { status: 403, headers: corsHeaders });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: userRole },
    });

    if (authError) {
      const msg = authError.message || 'Erro ao criar usuário no Auth';
      return Response.json({ error: msg }, { status: 400, headers: corsHeaders });
    }
    if (!authData.user) {
      return Response.json({ error: 'Erro ao criar usuário' }, { status: 500, headers: corsHeaders });
    }

    const tipo = ROLE_TO_TIPO[userRole] || 'Operacional';
    const now = new Date().toISOString();
    const userRow = {
      id: authData.user.id,
      email,
      nome: name,
      tipo,
      status: 'ATIVO',
      role: userRole,
      created_at: now,
      updated_at: now,
      ai_preferences: {},
      force_password_change: true,
    };

    const { error: insertError } = await supabaseAdmin.from('users').upsert(userRow, { onConflict: 'id' });

    if (insertError) {
      const msg = insertError.message || 'Erro ao gravar usuário em public.users';
      return Response.json({ error: msg }, { status: 400, headers: corsHeaders });
    }

    // Inserir permissions manualmente (evita erro do trigger sync_user_permissions_from_role)
    const permDefaults = {
      gerenciar_usuarios: userRole === 'admin',
      gerenciar_grupos: ['admin', 'manager', 'technical_responsible'].includes(userRole),
      criar_projetos: ['admin', 'manager', 'technical_responsible'].includes(userRole),
      editar_projetos: ['admin', 'manager', 'technical_responsible'].includes(userRole),
      excluir_projetos: userRole === 'admin' || userRole === 'manager',
      visualizar_todos_projetos: ['admin', 'director', 'manager', 'technical_responsible', 'operational'].includes(userRole),
      visualizar_documentos: true,
      criar_documentos: ['admin', 'manager', 'technical_responsible', 'operational'].includes(userRole),
      editar_documentos: ['admin', 'manager', 'technical_responsible', 'operational'].includes(userRole),
      excluir_documentos: ['admin', 'manager', 'technical_responsible', 'operational'].includes(userRole),
      download_documentos: true,
      compartilhar_documentos: ['admin', 'manager', 'technical_responsible'].includes(userRole),
      criar_templates: ['admin', 'manager', 'technical_responsible'].includes(userRole),
      editar_templates: ['admin', 'manager', 'technical_responsible'].includes(userRole),
      excluir_templates: ['admin', 'manager', 'technical_responsible'].includes(userRole),
      assinar_documentos: false,
      solicitar_assinatura: false,
      alimentar_ia: ['admin', 'manager', 'technical_responsible', 'operational'].includes(userRole),
      gerenciar_ia: userRole === 'admin' || userRole === 'manager',
      acesso_total: userRole === 'admin',
    };
    await supabaseAdmin.from('permissions').upsert(
      { user_id: authData.user.id, ...permDefaults },
      { onConflict: 'user_id' }
    );

    return Response.json(
      {
        id: authData.user.id,
        email,
        name,
        role: userRole,
        createdAt: authData.user.created_at,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});
