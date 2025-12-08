import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UploadCloud, Clock, FileText, CheckCircle, Loader2, AlertCircle, RefreshCw, Eye } from 'lucide-react';
import { Upload } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface UploadCenterProps {
  onViewClick: () => void;
}

export const UploadCenter: React.FC<UploadCenterProps> = ({ onViewClick }) => {
  const { user } = useAuth();
  const [uploadStatusFilter, setUploadStatusFilter] = useState<string>('all'); // 'all', 'success', 'processing', 'failed'
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [user]);

  const fetchUploads = async () => {
    if (!user) return;
    try {
      setLoading(true);
      // Fetch uploads only for the current user
      const { data, error } = await supabase
        .from('resume_uploads')
        .select('*')
        .eq('user_id', user.id) // Filter by current user ID
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedUploads: Upload[] = (data || []).map((item: any) => ({
        id: item.id,
        filename: item.filename,
        size: formatFileSize(item.file_size),
        status: mapStatus(item.status),
        error: item.error_reason,
        date: new Date(item.created_at).toLocaleString(),
        uploader_email: item.uploader_email
      }));

      setUploads(formattedUploads);
    } catch (err) {
      console.error('Error fetching uploads:', err);
    } finally {
      setLoading(false);
    }
  };

  const mapStatus = (status: string): Upload['status'] => {
    if (status === 'SUCCESS') return 'success';
    if (status === 'FAILED') return 'failed';
    return 'processing'; // PENDING, OCR_DONE, etc.
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
            uploader_email: user.email // Save email!
          });

        if (dbError) throw dbError;

      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err);
        alert(`上传 ${file.name} 失败`);
      }
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
    if (uploadStatusFilter === 'all') return uploads;
    return uploads.filter(u => u.status === uploadStatusFilter);
  }, [uploadStatusFilter, uploads]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">上传中心</h2>
        <p className="text-gray-500 mt-1">支持批量 PDF/Word 简历上传，AI 自动解析</p>
      </div>

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
        <button className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 shadow-sm transition-colors pointer-events-none">
          {uploading ? '上传处理中...' : '选择文件'}
        </button>
      </div>

      {/* Upload History */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center flex-wrap gap-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Clock size={16} /> 上传记录
          </h3>
          
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: '全部' },
              { id: 'success', label: '成功' },
              { id: 'processing', label: '进行中' },
              { id: 'failed', label: '失败' }
            ].map(filter => (
              <button 
                key={filter.id}
                onClick={() => setUploadStatusFilter(filter.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  uploadStatusFilter === filter.id 
                    ? 'bg-indigo-100 text-indigo-700' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="overflow-y-auto flex-1">
          {loading ? (
             <div className="flex justify-center items-center h-40 text-gray-400">
               <Loader2 size={24} className="animate-spin mr-2"/> 加载中...
             </div>
          ) : (
            <table className="w-full text-sm text-left">
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
                      <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                        <FileText size={16} className="text-gray-400" />
                        <span className="truncate max-w-[200px]" title={file.filename}>{file.filename}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{file.size}</td>
                      <td className="px-6 py-4 text-gray-500">
                        <div className="flex items-center gap-1.5" title={file.uploader_email}>
                           <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                             {file.uploader_email ? file.uploader_email.charAt(0).toUpperCase() : 'U'}
                           </div>
                           <span className="truncate max-w-[120px]">{file.uploader_email || '未知'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {file.status === 'success' && <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle size={12}/> 解析成功</span>}
                        {file.status === 'processing' && <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Loader2 size={12} className="animate-spin"/> 解析中</span>}
                        {file.status === 'failed' && <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700" title={file.error}><AlertCircle size={12}/> 解析失败</span>}
                      </td>
                      <td className="px-6 py-4 text-gray-500">{file.date}</td>
                      <td className="px-6 py-4 text-right">
                        {file.status === 'failed' ? (
                            <button className="text-gray-500 hover:text-indigo-600 font-medium text-xs flex items-center gap-1 ml-auto">
                              <RefreshCw size={14}/> 重试
                            </button>
                        ) : (
                            <button className="text-indigo-600 hover:text-indigo-900 font-medium text-xs flex items-center gap-1 ml-auto" onClick={onViewClick}>
                              <Eye size={14}/> 查看
                            </button>
                        )}
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
