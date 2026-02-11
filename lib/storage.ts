import { SupabaseClient } from '@supabase/supabase-js';
import { supabase, oldSupabase } from './supabase';

/**
 * 从 Supabase 公共 URL 中提取 bucket 和路径
 * 格式: https://xxx.supabase.co/storage/v1/object/public/{bucket}/{path}
 */
function extractPathFromUrl(url: string): { bucket: string; path: string } | null {
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)/);
    if (match) {
      return {
        bucket: match[1],
        path: match[2]
      };
    }
  } catch (e) {
    // 不是有效的 URL，返回 null
  }
  return null;
}

/**
 * 从存储中获取文件的签名 URL，支持新旧存储 fallback
 * @param pathOrUrl 文件路径或完整 URL（oss_raw_path）
 * @param buckets 要尝试的 bucket 名称列表，默认 ['resumes', 'resume']
 * @param expiresIn 签名 URL 过期时间（秒），默认 3600
 * @returns 签名 URL 或 null
 */
export async function getStorageUrl(
  pathOrUrl: string,
  buckets: string[] = ['resumes', 'resume'],
  expiresIn: number = 3600
): Promise<string | null> {
  if (!pathOrUrl) {
    console.warn('getStorageUrl: path is empty');
    return null;
  }

  // 如果传入的是完整 URL（例如以 http(s):// 开头），直接返回用于预览
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  // 检查是否是完整 URL，如果是则提取路径和 bucket
  let actualPath = pathOrUrl;
  let detectedBucket: string | null = null;
  
  const urlInfo = extractPathFromUrl(pathOrUrl);
  if (urlInfo) {
    actualPath = urlInfo.path;
    detectedBucket = urlInfo.bucket;
    console.log(`检测到 URL 格式，提取路径: ${actualPath}, bucket: ${detectedBucket}`);
  }

  // 如果从 URL 中检测到 bucket，优先使用它
  const bucketsToTry = detectedBucket ? [detectedBucket, ...buckets] : buckets;

  // 首先尝试新存储（主存储）
  console.log('尝试从新存储获取文件:', actualPath);
  const newStorageResult = await tryGetUrlFromStorage(supabase, actualPath, bucketsToTry, expiresIn);
  if (newStorageResult) {
    console.log('成功从新存储获取文件');
    return newStorageResult;
  }

  // 如果新存储失败，且配置了旧存储，尝试旧存储
  // 旧存储的 bucket 是 'resumes'（复数）
  if (oldSupabase) {
    console.log('新存储未找到，尝试从旧存储获取文件:', actualPath);
    // 旧存储使用 'resumes' bucket
    const oldBuckets = detectedBucket === 'resumes' ? ['resumes'] : ['resumes', ...bucketsToTry.filter(b => b !== 'resumes')];
    const oldStorageResult = await tryGetUrlFromStorage(oldSupabase, actualPath, oldBuckets, expiresIn);
    if (oldStorageResult) {
      console.log('成功从旧存储获取文件');
      return oldStorageResult;
    }
  } else {
    console.warn('旧存储未配置，无法 fallback');
  }

  console.error('所有存储都未找到文件:', pathOrUrl);
  return null;
}

/**
 * 从指定的 Supabase 客户端尝试获取文件 URL
 * @param client Supabase 客户端
 * @param path 文件路径
 * @param buckets bucket 名称列表
 * @param expiresIn 过期时间
 * @returns 签名 URL 或 null
 */
async function tryGetUrlFromStorage(
  client: SupabaseClient,
  path: string,
  buckets: string[],
  expiresIn: number
): Promise<string | null> {
  // 尝试每个 bucket
  for (const bucket of buckets) {
    try {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) {
        console.log(`Bucket '${bucket}' 获取失败:`, error.message);
        continue; // 尝试下一个 bucket
      }

      if (data?.signedUrl) {
        console.log(`成功从 bucket '${bucket}' 获取 URL`);
        return data.signedUrl;
      }
    } catch (err: any) {
      console.error(`尝试 bucket '${bucket}' 时出错:`, err);
      continue; // 尝试下一个 bucket
    }
  }

  return null;
}

