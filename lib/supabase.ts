import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Next.js 环境变量使用 NEXT_PUBLIC_ 前缀
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || '';

// 旧 Supabase 配置（用于 fallback）
const oldSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_OLD_URL;
const oldSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_OLD_KEY;

// 检查是否在客户端运行
const isBrowser = typeof window !== 'undefined';

// 仅在客户端且缺少配置时显示警告
if (isBrowser && (!supabaseUrl || !supabaseKey)) {
  console.error('Missing Supabase URL or Key in environment variables');
}

// 创建一个占位符客户端用于构建时
const createSupabaseClient = () => {
  // 如果没有 URL，返回一个空字符串作为占位符（避免构建报错）
  return createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key');
};

// 新存储客户端（主存储）
export const supabase = createSupabaseClient();

// 旧存储客户端（fallback，如果配置了的话）
export const oldSupabase: SupabaseClient | null = oldSupabaseUrl && oldSupabaseKey 
  ? createClient(oldSupabaseUrl, oldSupabaseKey)
  : null;

// 导出配置状态检查函数
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseKey && supabaseUrl !== 'https://placeholder.supabase.co');
};
