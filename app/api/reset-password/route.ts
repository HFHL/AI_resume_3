import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL) {
      console.error('Missing NEXT_PUBLIC_SUPABASE_URL');
      return NextResponse.json({ error: '服务未配置' }, { status: 500 });
    }
    if (!SERVICE_ROLE_KEY) {
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json({ error: '服务未配置' }, { status: 500 });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

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
    const adminClient = (supabaseAdmin.auth as any)?.admin || (supabaseAdmin as any)?.auth?.admin;
    if (!adminClient || typeof adminClient.updateUserById !== 'function') {
      console.error('Supabase admin client missing updateUserById');
      return NextResponse.json({ error: '内部服务不可用' }, { status: 500 });
    }
    const { data: updatedUser, error: updateErr } = await adminClient.updateUserById(userId, {
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
