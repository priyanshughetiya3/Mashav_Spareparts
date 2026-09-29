import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { error: 'Server configuration error. SUPABASE_SERVICE_ROLE_KEY is missing.' },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { email, password, full_name, phone } = await request.json();

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Create user with admin API — auto-confirms email, no rate limit
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || '', phone: phone || '' },
    });

    if (error) {
      // Handle duplicate user
      if (error.message?.includes('already been registered') || error.message?.includes('already exists')) {
        return Response.json(
          { error: 'This email is already registered. Try signing in instead.' },
          { status: 409 }
        );
      }
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ user: { id: data.user.id, email: data.user.email } });
  } catch (err) {
    console.error('Signup API error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
