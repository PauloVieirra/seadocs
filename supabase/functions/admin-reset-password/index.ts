import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    const { userId, newPassword, forcePasswordChange } = await req.json();
    if (!userId || !newPassword) {
      return Response.json({ error: 'userId e newPassword são obrigatórios' }, { status: 400, headers: corsHeaders });
    }
    if (newPassword.length < 6) {
      return Response.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: callerUser } = await supabaseAdmin.from('users').select('role').eq('id', caller.id).single();
    const role = (callerUser?.role as string)?.toLowerCase();
    const canManage = ['admin', 'manager', 'technical_responsible'].includes(role);
    if (!canManage) {
      return Response.json({ error: 'Sem permissão para resetar senha' }, { status: 403, headers: corsHeaders });
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
    if (authError) {
      return Response.json({ error: authError.message }, { status: 400, headers: corsHeaders });
    }

    const shouldForce = forcePasswordChange === true;
    await supabaseAdmin.from('users').update({ force_password_change: shouldForce }).eq('id', userId);

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500, headers: corsHeaders });
  }
});
