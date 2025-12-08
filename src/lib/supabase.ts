import { createClient } from '@supabase/supabase-js';

// 这些环境变量需要在前端 .env 文件中配置
// VITE_SUPABASE_URL=...
// VITE_SUPABASE_KEY=...

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key in environment variables');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

