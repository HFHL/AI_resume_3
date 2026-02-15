import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

if (!SERVICE_ROLE_KEY) {
  // Fail fast; server should have this configured for admin reset
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, newPassword } = body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: '新密码长度至少 8 位' }, { status: 400 });
    }

    // Find the user id from public profiles table (common pattern)
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (profileErr) {
      console.error('profiles lookup error', profileErr);
      return NextResponse.json({ error: '无法查找用户' }, { status: 500 });
    }
    if (!profile || !profile.user_id) {
      return NextResponse.json({ error: '未找到对应用户' }, { status: 404 });
    }

    const userId = profile.user_id as string;

    // Use Supabase Admin to update the user's password directly
    // (requires service_role key and appropriate privileges)
    // supabase-js exposes admin APIs under auth.admin
    // Note: method names may vary with supabase-js versions; this follows the common pattern.
    // If your supabase client version differs, replace with the appropriate admin call.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { data: updatedUser, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (updateErr) {
      console.error('update password error', updateErr);
      return NextResponse.json({ error: '更新密码失败' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('reset-password route error', err);
    return NextResponse.json({ error: err?.message || '服务器错误' }, { status: 500 });
  }
}
