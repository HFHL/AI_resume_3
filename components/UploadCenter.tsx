'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UploadCloud, Clock, FileText, CheckCircle, Loader2, AlertCircle, RefreshCw, Eye, Trash } from 'lucide-react';
import { Upload } from '@/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';

interface UploadCenterProps {
  onViewClick: (candidateId: string) => void;
}

export const UploadCenter: React.FC<UploadCenterProps> = ({ onViewClick }) => {
  const { user, displayName, isAdmin } = useAuth();
  const [uploadStatusFilter, setUploadStatusFilter] = useState<string>('all'); // 'all', 'success', 'processing', 'failed'
  const [timeFilter, setTimeFilter] = useState<string>('today'); // 'today', 'week', 'all'
  type LocalUpload = Upload & { uploader_name?: string; oss_raw_path?: string | null };
  const [uploads, setUploads] = useState<LocalUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null); // 正在重试的记录ID
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const requestedUserParam = searchParams?.get('userId') || user?.id || null;
  const [resolvedDisplayName, setResolvedDisplayName] = useState<string | null>(null);
  const [effectiveViewedUserId, setEffectiveViewedUserId] = useState<string | null>(null);

  const fetchUploads = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      // Non-admin users can only view their own uploads.
      let targetUserId = user.id;
      try {
        const raw = searchParams?.get('userId') || searchParams?.get('user') || searchParams?.get('name') || null;
        if (raw && raw !== user.id) {
          if (!isAdmin) {
            // Force fallback to self for non-admin users.
            targetUserId = user.id;
            setResolvedDisplayName(null);
          } else {
            const { data: profiles, error: profileErr } = await supabase
              .from('profiles')
              .select('user_id,display_name')
              .eq('display_name', raw)
              .limit(1);
            if (profileErr) console.debug('fetchUploads: profile lookup error', profileErr);
            if (profiles && profiles.length > 0) {
              targetUserId = profiles[0].user_id;
              setResolvedDisplayName(profiles[0].display_name || null);
            } else {
              // treat raw as user id
              setResolvedDisplayName(null);
              targetUserId = raw;
            }
          }
        } else {
          setResolvedDisplayName(null);
        }
      } catch (err) {
        console.error('fetchUploads: error resolving profile', err);
      }

      // Fetch uploads with related candidate info
      console.debug('fetchUploads: querying resume_uploads for user', targetUserId);
      const { data, error } = await supabase
        .from('resume_uploads')
        .select(`
          *,
          candidates (id)
        `)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedUploads: LocalUpload[] = (data || []).map((item: any) => ({
        id: item.id,
        filename: item.filename,
        size: formatFileSize(item.file_size),
        status: mapStatus(item.status),
        error: item.error_reason,
        date: new Date(item.created_at).toLocaleString(),
        uploader_email: item.uploader_email,
        uploader_name: item.uploader_name,
        candidate_id: item.candidates?.[0]?.id || item.candidates?.id || undefined,
        oss_raw_path: item.oss_raw_path || null
      }));

      setUploads(formattedUploads);
      setEffectiveViewedUserId(targetUserId);
    } catch (err) {
      console.error('Error fetching uploads:', err);
    } finally {
      setLoading(false);
    }
  }, [user, displayName, isAdmin, searchParams]);

  // Fetch uploads
  useEffect(() => {
    fetchUploads();

    // Subscribe to changes
    const subscription = supabase
      .channel('resume_uploads_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resume_uploads' }, () => {
        fetchUploads();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUploads]);

  

  const mapStatus = (status: string): Upload['status'] => {
    if (status === 'SUCCESS') return 'success';
    if (status === 'FAILED') return 'failed';
    return 'processing'; // PENDING, OCR_DONE, etc.
  };

  const retryUpload = async (uploadId: string) => {
    setRetryingId(uploadId);
    try {
      const { error } = await supabase
        .from('resume_uploads')
        .update({ 
          status: 'PENDING', 
          error_reason: null,
          ocr_content: null 
        })
        .eq('id', uploadId);

      if (error) throw error;
      
      // 立即更新本地状态，给用户即时反馈
      setUploads(prev => prev.map(u => 
        u.id === uploadId 
          ? { ...u, status: 'processing' as const, error: undefined }
          : u
      ));
      
    } catch (err: any) {
      console.error('Retry failed:', err);
      alert('重试失败: ' + (err.message || '未知错误'));
    } finally {
      setRetryingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    
    setUploading(true);
    const files = Array.from(e.target.files);

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    const errorDetails: string[] = [];

    for (const file of files) {
      try {
        // 1. Calculate Hash
        const hash = await calculateFileHash(file);

        // 2. Check if exists
        // Use maybeSingle() to avoid 406 Not Acceptable error when result returns 0 rows
        const { data: existing, error: checkError } = await supabase
          .from('resume_uploads')
          .select('id')
          .eq('file_hash', hash)
          .maybeSingle();

        if (checkError) {
           console.error('Error checking hash:', checkError);
        }

        if (existing) {
          console.log(`File ${file.name} already exists.`);
          skipCount += 1;
          try { errorDetails.push(`${file.name}: 已存在`); } catch (e) {}
          continue; // Skip or notify user
        }

        // 3. Upload to Storage
        // Use a safe file name for storage (ASCII only) to avoid "Invalid Key" errors with non-ASCII characters
        const fileExt = file.name.split('.').pop() || '';
        const safeFileName = `${Date.now()}_${hash.substring(0, 16)}.${fileExt}`;
        const filePath = `${user.id}/${safeFileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('resume')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 4. Insert into DB
        const { error: dbError } = await supabase
          .from('resume_uploads')
          .insert({
            user_id: user.id,
            filename: file.name, // Keep original filename for display
            file_hash: hash,
            file_size: file.size,
            oss_raw_path: filePath,
            status: 'PENDING',
            uploader_email: user.email, // Save email as fallback
            uploader_name: displayName || null // Save display name (preferred)
          });

        if (dbError) throw dbError;
        successCount += 1;

        } catch (err: any) {
        console.error(`Error uploading ${file.name}:`, err);
        failCount += 1;
        try { errorDetails.push(`${file.name}: ${err?.message || String(err)}`); } catch (e) { errorDetails.push(`${file.name}: 上传失败`); }
      }
    }

    // set summary message including skipped duplicates
    if (successCount > 0 || failCount > 0 || skipCount > 0) {
      const parts = [] as string[];
      if (successCount > 0) parts.push(`${successCount} 成功`);
      if (failCount > 0) parts.push(`${failCount} 失败`);
      if (skipCount > 0) parts.push(`${skipCount} 已存在`);
      setInfoMessage(`上传完成：${parts.join('，')}`);
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    fetchUploads();
  };

  const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const filteredUploads = useMemo(() => {
    let result = uploads;
    
    // 时间筛选
    if (timeFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      result = result.filter(u => {
        const uploadDate = new Date(u.date);
        if (timeFilter === 'today') {
          return uploadDate >= today;
        } else if (timeFilter === 'week') {
          return uploadDate >= weekAgo;
        }
        return true;
      });
    }
    
    // 状态筛选
    if (uploadStatusFilter !== 'all') {
      result = result.filter(u => u.status === uploadStatusFilter);
    }
    
    return result;
  }, [uploadStatusFilter, timeFilter, uploads]);
  
  // 统计今日上传数量
  const todayCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return uploads.filter(u => new Date(u.date) >= today).length;
  }, [uploads]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto w-full p-8">
      {isAdmin && effectiveViewedUserId && effectiveViewedUserId !== user?.id && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-700">
          正在查看用户 <span className="font-medium">{resolvedDisplayName || effectiveViewedUserId}</span> 的上传记录（管理员查看）。
        </div>
      )}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">上传中心</h2>
        <p className="text-gray-500 mt-1">支持批量 PDF/Word 简历上传，AI 自动解析</p>
      </div>

      {infoMessage && (
        <div className="mb-4 p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-sm text-indigo-700 flex items-center justify-between">
          <div>{infoMessage}</div>
          <button onClick={() => setInfoMessage(null)} className="text-indigo-700 text-sm font-medium">关闭</button>
        </div>
      )}

      <input 
        type="file" 
        multiple 
        accept=".pdf,.docx,.doc" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
      />

      {/* Upload Area */}
      <div
        onClick={handleUploadClick}
        className={`bg-white border-2 border-dashed ${uploading ? 'border-indigo-300 bg-indigo-50' : 'border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50/30'} rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer mb-10`}
      >
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
          {uploading ? <Loader2 size={32} className="animate-spin" /> : <UploadCloud size={32} />}
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">{uploading ? '正在上传...' : '点击上传简历'}</h3>
        <p className="text-sm text-gray-500 mb-6 max-w-md">
          支持 PDF, DOCX 格式。AI 将自动进行 OCR 识别与结构化解析。
        </p>
        <button className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 shadow-sm transition-colors pointer-events-auto">
          {uploading ? '上传处理中...' : '选择文件'}
        </button>
      </div>

      {/* Upload History */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-[480px]">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Clock size={16} /> 上传记录
              </h3>
              {/* 今日统计 */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100">
                <span className="text-xs text-indigo-600">📅 今日上传</span>
                <span className="text-sm font-bold text-indigo-700">{todayCount}</span>
                <span className="text-xs text-indigo-500">份</span>
              </div>
            </div>
            
            {/* 时间筛选 */}
            <div className="flex items-center gap-2">
              {[
                { id: 'today', label: '📅 今天' },
                { id: 'week', label: '📆 本周' },
                { id: 'all', label: '📋 全部' }
              ].map(filter => (
                <button 
                  key={filter.id}
                  onClick={() => setTimeFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    timeFilter === filter.id 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* 状态筛选 */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500 mr-2">按状态：</span>
            {[
              { id: 'all', label: '全部' },
              { id: 'success', label: '✅ 成功' },
              { id: 'processing', label: '🔄 解析中' },
              { id: 'failed', label: '❌ 失败' }
            ].map(filter => (
              <button 
                key={filter.id}
                onClick={() => setUploadStatusFilter(filter.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  uploadStatusFilter === filter.id 
                    ? 'bg-gray-800 text-white' 
                    : 'text-gray-500 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
            
            {/* 显示筛选结果数量 */}
            <span className="ml-auto text-xs text-gray-400">
              共 <span className="font-medium text-gray-700">{filteredUploads.length}</span> 条记录
            </span>
          </div>
        </div>
        
        <div className="overflow-auto flex-1">
          {loading ? (
             <div className="flex justify-center items-center h-40 text-gray-400">
               <Loader2 size={24} className="animate-spin mr-2"/> 加载中...
             </div>
          ) : (
            <table className="w-full min-w-full text-sm text-left table-auto">
              <thead className="text-xs text-gray-500 bg-gray-50 uppercase border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 font-medium">文件名</th>
                  <th className="px-6 py-3 font-medium">大小</th>
                  <th className="px-6 py-3 font-medium">上传人</th>
                  <th className="px-6 py-3 font-medium">状态</th>
                  <th className="px-6 py-3 font-medium">上传时间</th>
                  <th className="px-6 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUploads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                      暂无相关记录
                    </td>
                  </tr>
                ) : (
                  filteredUploads.map((file) => (
                    <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                        <FileText size={16} className="text-gray-400" />
                        <span className="truncate max-w-[420px] block" title={file.filename}>{file.filename}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{file.size}</td>
                      <td className="px-6 py-4 text-gray-500">
                        <div className="flex items-center gap-1.5" title={file.uploader_name || file.uploader_email || ''}>
                           <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                             {(file.uploader_name || file.uploader_email || 'U').charAt(0).toUpperCase()}
                           </div>
                           <span className="truncate max-w-[220px]">{file.uploader_name || file.uploader_email || '未设置'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {file.status === 'success' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                            <CheckCircle size={14}/> ✅ 解析成功
                          </span>
                        )}
                        {file.status === 'processing' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                            <Loader2 size={14} className="animate-spin"/> 🔄 解析中...
                          </span>
                        )}
                        {file.status === 'failed' && (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                              <AlertCircle size={14}/> ❌ 解析失败
                            </span>
                            {file.error && (
                              <span className="text-[10px] text-red-500 max-w-[150px] truncate" title={file.error}>
                                {file.error}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500">{file.date}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                        {file.status === 'failed' ? (
                            <button 
                              onClick={() => retryUpload(file.id)}
                              disabled={retryingId === file.id}
                              className={`font-medium text-xs flex items-center gap-1.5 ml-auto px-3 py-1.5 rounded-lg transition-all ${
                                retryingId === file.id 
                                  ? 'bg-orange-100 text-orange-400 cursor-not-allowed' 
                                  : 'bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 border border-orange-200'
                              }`}
                            >
                              {retryingId === file.id ? (
                                <>
                                  <Loader2 size={14} className="animate-spin"/> 提交中...
                                </>
                              ) : (
                                <>
                                  <RefreshCw size={14}/> 重试
                                </>
                              )}
                            </button>
                        ) : file.status === 'processing' ? (
                            <span className="text-xs text-gray-400 flex items-center gap-1 ml-auto">
                              <Clock size={14}/> 等待中
                            </span>
                        ) : file.candidate_id ? (
                            <button 
                              className="text-indigo-600 hover:text-indigo-900 font-medium text-xs flex items-center gap-1.5 ml-auto hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-indigo-200" 
                              onClick={() => onViewClick(file.candidate_id!)}
                            >
                              <Eye size={14}/> 查看简历
                            </button>
                        ) : (
                            <span className="text-xs text-gray-400 flex items-center gap-1 ml-auto">
                              暂无数据
                            </span>
                        )}

                        {/* 管理员删除按钮 */}
                        {isAdmin && (
                          <button
                            onClick={async () => {
                              if (!confirm('确认删除该上传记录及其存储文件？此操作不可恢复。')) return;
                              try {
                                if (file.oss_raw_path) {
                                  await supabase.storage.from('resume').remove([file.oss_raw_path]);
                                }
                                const { error } = await supabase.from('resume_uploads').delete().eq('id', file.id);
                                if (error) throw error;
                                fetchUploads();
                              } catch (err: any) {
                                console.error('删除失败', err);
                                alert('删除失败: ' + (err?.message || '未知错误'));
                              }
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium text-red-700 border-red-200 hover:bg-red-50"
                          >
                            <Trash size={14} /> 删除
                          </button>
                        )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

