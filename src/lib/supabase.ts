import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 这些环境变量需要在前端 .env 文件中配置
// VITE_SUPABASE_URL=... (新存储)
// VITE_SUPABASE_KEY=... (新存储)
// VITE_SUPABASE_OLD_URL=... (旧存储，可选)
// VITE_SUPABASE_OLD_KEY=... (旧存储，可选)

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseKey = (import.meta as any).env.VITE_SUPABASE_KEY;

// 旧 Supabase 配置（用于 fallback）
const oldSupabaseUrl = (import.meta as any).env.VITE_SUPABASE_OLD_URL;
const oldSupabaseKey = (import.meta as any).env.VITE_SUPABASE_OLD_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key in environment variables');
}

// 新存储客户端（主存储）
export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

// 旧存储客户端（fallback，如果配置了的话）
export const oldSupabase: SupabaseClient | null = oldSupabaseUrl && oldSupabaseKey 
  ? createClient(oldSupabaseUrl, oldSupabaseKey)
  : null;

