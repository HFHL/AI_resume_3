'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { 
  ArrowLeft, Download, MoreHorizontal, Edit3, Mail, Phone, MapPin,
  Calendar, Building2, GraduationCap, Briefcase, ExternalLink, 
  FileText, Loader2, RefreshCcw, Save, Wrench
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getStorageUrl } from '@/lib/storage';

// --- COMPONENTS ---

// 1. Section Header
const SectionTitle = ({ title, icon: Icon, action }: { title: string, icon: any, action?: string }) => (
  <div className="flex items-center justify-between mb-4 mt-8 pb-2 border-b border-gray-100">
    <div className="flex items-center gap-2 text-gray-900 font-bold text-lg">
      <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
        <Icon size={18} />
      </div>
      {title}
    </div>
    {action && <button className="text-sm text-indigo-600 hover:underline">{action}</button>}
  </div>
);

// 2. Info Item
const InfoItem = ({ icon: Icon, label, value, isLink }: { icon: any, label: string, value: string | null | undefined, isLink?: boolean }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon size={16} className="text-gray-400 mt-0.5 shrink-0" />
      <div>
        <div className="text-gray-500 text-xs mb-0.5">{label}</div>
        <div className={`font-medium ${isLink ? 'text-indigo-600 hover:underline cursor-pointer' : 'text-gray-900'}`}>
          {value}
        </div>
      </div>
    </div>
  );
};

interface ResumeDetailProps {
  onBack: () => void;
  candidateId?: string;
}

export const ResumeDetail: React.FC<ResumeDetailProps> = ({ onBack, candidateId }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [candidate, setCandidate] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // full data loading
  const [initialLoading, setInitialLoading] = useState(true); // minimal data loaded
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    degree_level: '',
    work_years: '',
    self_evaluation: ''
  });

  const [fileForm, setFileForm] = useState({
    oss_raw_path: ''
  });

  useEffect(() => {
    if (!candidateId) return;

    const fetchMinimalAndRelated = async () => {
      setInitialLoading(true);
      setError(null);
      try {
        // 1) Fetch minimal candidate payload (fast) to show header quickly
        const { data: minimal, error: minErr } = await supabase
          .from('candidates')
          .select(`
            id,
            name,
            updated_at,
            work_years,
            degree_level,
            location,
            email,
            phone,
            self_evaluation,
            resume_uploads (id, oss_raw_path, filename, created_at, uploader_email, uploader_name, status)
          `)
          .eq('id', candidateId)
          .maybeSingle();

        if (minErr) throw minErr;

        // Set minimal candidate state so UI can render quickly
        setCandidate(minimal || null);
        setEditForm({
          name: minimal?.name || '',
          email: minimal?.email || '',
          phone: minimal?.phone || '',
          location: minimal?.location || '',
          degree_level: minimal?.degree_level || '',
          work_years: minimal?.work_years != null ? String(minimal.work_years) : '',
          self_evaluation: minimal?.self_evaluation || ''
        });

        // init file form from minimal payload
        const uploadData = Array.isArray(minimal?.resume_uploads) ? minimal.resume_uploads[0] : minimal?.resume_uploads;
        setFileForm({ oss_raw_path: uploadData?.oss_raw_path || '' });

        // Pre-fetch signed URL if available (do not block related fetches)
        if (uploadData?.oss_raw_path) {
          getStorageUrl(uploadData.oss_raw_path, ['resumes', 'resume'], 3600).then((signedUrl) => {
            if (signedUrl) setPdfUrl(signedUrl);
          }).catch((e) => console.warn('getStorageUrl failed', e));
        }

        setInitialLoading(false);

        // 2) Fetch related collections in parallel (educations, works, projects, tags)
        setLoading(true);
        const [educRes, workRes, projRes, tagRes] = await Promise.all([
          supabase.from('candidate_educations').select('*').eq('candidate_id', candidateId).order('start_date', { ascending: false }),
          supabase.from('candidate_work_experiences').select('*').eq('candidate_id', candidateId).order('start_date', { ascending: false }),
          supabase.from('candidate_projects').select('*').eq('candidate_id', candidateId).order('created_at', { ascending: false }),
          supabase.from('candidate_tags').select('*, tags (tag_name, category)').eq('candidate_id', candidateId)
        ]).catch((e) => {
          console.warn('Related fetch error (non-fatal):', e);
          return [ { data: null }, { data: null }, { data: null }, { data: null } ];
        });

        const full = {
          ...(minimal || {}),
          candidate_educations: (educRes?.data as any) || [],
          candidate_work_experiences: (workRes?.data as any) || [],
          candidate_projects: (projRes?.data as any) || [],
          candidate_tags: (tagRes?.data as any) || []
        };

        setCandidate(full);

      } catch (err: any) {
        console.error('Error fetching candidate detail:', err);
        setError(err?.message || '加载候选人信息失败');
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    };

    fetchMinimalAndRelated();
  }, [candidateId]);

  const uploadData = useMemo(() => {
    if (!candidate) return null;
    return Array.isArray(candidate.resume_uploads) ? candidate.resume_uploads[0] : candidate.resume_uploads;
  }, [candidate]);

  const refreshPreviewUrl = async () => {
    if (!fileForm.oss_raw_path) return;
    const signedUrl = await getStorageUrl(fileForm.oss_raw_path, ['resumes', 'resume'], 3600);
    if (signedUrl) setPdfUrl(signedUrl);
  };

  const saveCandidate = async () => {
    if (!candidateId) return;
    setSaving(true);
    try {
      const payload: any = {
        name: editForm.name.trim() || null,
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        location: editForm.location.trim() || null,
        degree_level: editForm.degree_level.trim() || null,
        self_evaluation: editForm.self_evaluation.trim() || null,
      };
      const wy = editForm.work_years.trim();
      payload.work_years = wy ? Number(wy) : null;

      const { error } = await supabase.from('candidates').update(payload).eq('id', candidateId);
      if (error) throw error;

      // update local candidate state for immediate UI
      setCandidate((prev: any) => ({ ...prev, ...payload }));
      setIsEditing(false);
    } catch (e: any) {
      console.error('saveCandidate failed:', e);
      alert(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const saveFilePath = async () => {
    if (!uploadData?.id) {
      alert('未找到上传记录（resume_uploads）');
      return;
    }
    setRepairing(true);
    try {
      const { error } = await supabase
        .from('resume_uploads')
        .update({ oss_raw_path: fileForm.oss_raw_path.trim() || null })
        .eq('id', uploadData.id);
      if (error) throw error;
      await refreshPreviewUrl();
      setCandidate((prev: any) => {
        const nextUpload = { ...(Array.isArray(prev.resume_uploads) ? prev.resume_uploads[0] : prev.resume_uploads), oss_raw_path: fileForm.oss_raw_path.trim() || null };
        return { ...prev, resume_uploads: Array.isArray(prev.resume_uploads) ? [nextUpload] : nextUpload };
      });
    } catch (e: any) {
      console.error('saveFilePath failed:', e);
      alert(e?.message || '文件路径保存失败');
    } finally {
      setRepairing(false);
    }
  };

  const rerunOCR = async () => {
    if (!uploadData?.id) {
      alert('未找到上传记录（resume_uploads）');
      return;
    }
    if (!confirm('确定要重新解析吗？这会重新执行 OCR 识别和 AI 结构化解析。')) return;
    setRepairing(true);
    try {
      const { error } = await supabase
        .from('resume_uploads')
        .update({ status: 'PENDING', error_reason: null, ocr_content: null })
        .eq('id', uploadData.id);
      if (error) throw error;
      alert('已提交重新解析，请等待后端处理完成。');
    } catch (e: any) {
      console.error('rerunOCR failed:', e);
      alert(e?.message || '提交失败');
    } finally {
      setRepairing(false);
    }
  };

  const rerunParse = async () => {
    if (!uploadData?.id) {
      alert('未找到上传记录（resume_uploads）');
      return;
    }
    if (!confirm('确定要重新解析吗？这会把状态重置为 OCR_DONE，等待后端 Pipeline 重新提取结构化信息。')) return;
    setRepairing(true);
    try {
      const { error } = await supabase
        .from('resume_uploads')
        .update({ status: 'OCR_DONE', error_reason: null })
        .eq('id', uploadData.id);
      if (error) throw error;
      alert('已提交重新解析（OCR_DONE）。请等待后端 Pipeline 处理。');
    } catch (e: any) {
      console.error('rerunParse failed:', e);
      alert(e?.message || '提交失败');
    } finally {
      setRepairing(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="h-full bg-gray-50 flex flex-col font-sans text-gray-800 overflow-hidden w-full">
        {/* Header skeleton */}
        <header className="bg-white border-b border-gray-200 h-16 shrink-0 flex items-center justify-between px-6 shadow-sm z-20">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-200 rounded-full" />
            <div className="space-y-1">
              <div className="w-48 h-4 bg-gray-200 rounded" />
              <div className="w-32 h-3 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="w-28 h-8 bg-gray-200 rounded" />
        </header>

        {/* Main skeleton */}
        <div className="flex-1 flex gap-6 p-8">
          <div className="flex-1 space-y-6">
            <div className="flex gap-6">
              <div className="w-24 h-24 bg-gray-200 rounded-xl" />
              <div className="flex-1 space-y-3">
                <div className="w-64 h-6 bg-gray-200 rounded" />
                <div className="w-40 h-4 bg-gray-200 rounded" />
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="w-full h-10 bg-gray-200 rounded" />
                  <div className="w-full h-10 bg-gray-200 rounded" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-12 bg-gray-200 rounded" />
              <div className="h-12 bg-gray-200 rounded" />
              <div className="h-12 bg-gray-200 rounded" />
            </div>

            <div className="space-y-4">
              <div className="h-40 bg-gray-200 rounded" />
              <div className="h-24 bg-gray-200 rounded" />
              <div className="h-36 bg-gray-200 rounded" />
            </div>
          </div>

          <div className="w-1/3 hidden lg:block">
            <div className="h-12 bg-gray-200 rounded mb-4" />
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <div className="w-full h-[900px] bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50 text-red-500 gap-4">
        <p>加载失败: {error || '未找到该候选人'}</p>
        <button onClick={onBack} className="px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-50 text-gray-700">返回列表</button>
      </div>
    );
  }

  // Construct display data
  const latestWork = candidate.candidate_work_experiences?.[0];
  const headline = `${latestWork?.role || '待定职位'} | ${candidate.work_years || 0}年经验 | ${latestWork?.company || '未填写公司'}`;
  const skills = candidate.candidate_tags?.map((t: any) => t.tags?.tag_name).filter(Boolean) || [];

  // AI 打标标签（带分类）
  const aiTags = candidate.candidate_tags?.map((t: any) => ({
    tag_name: t.tags?.tag_name || '',
    category: t.tags?.category || ''
  })).filter((t: any) => t.tag_name) || [];

  // 根据分类获取标签颜色
  const getTagColor = (category: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      tech: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      non_tech: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
      web3: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
      quant: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
      ai: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    };
    return colors[category] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
  };

  // Safe access to filename
  const filename = uploadData?.filename || '未找到文件';

  return (
    <div className="h-full bg-gray-50 flex flex-col font-sans text-gray-800 overflow-hidden w-full">
      
      {/* 1. Header Bar */}
      <header className="bg-white border-b border-gray-200 h-16 shrink-0 flex items-center justify-between px-6 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="h-6 w-px bg-gray-300"></div>
          <div>
            <h1 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              {candidate.name}
              <span className="text-xs font-normal px-2 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100">
                New
              </span>
            </h1>
            <p className="text-xs text-gray-500">更新时间: {new Date(candidate.updated_at).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="下载/打开原始文件"
            >
              <Download size={20} />
            </a>
          )}
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><MoreHorizontal size={20} /></button>
        </div>
      </header>

      {/* 2. Main Content Area (Split View) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL: Structured Data (Scrollable) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white max-w-4xl border-r border-gray-200">
          <div className="p-8 pb-20">
            
            {/* Profile Card */}
            <div className="flex gap-6 mb-8">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${candidate.id}`} 
                alt="Avatar" 
                className="w-24 h-24 rounded-xl object-cover bg-gray-100 shadow-sm border border-gray-100" 
              />
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    {isEditing ? (
                      <div className="space-y-3">
                        <input
                          value={editForm.name}
                          onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full text-2xl font-bold text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="姓名"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            value={editForm.phone}
                            onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="电话"
                          />
                          <input
                            value={editForm.email}
                            onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="邮箱"
                          />
                          <input
                            value={editForm.location}
                            onChange={e => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                            className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="所在地"
                          />
                          <input
                            value={editForm.degree_level}
                            onChange={e => setEditForm(prev => ({ ...prev, degree_level: e.target.value }))}
                            className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="学历（本科/硕士/博士...）"
                          />
                          <input
                            value={editForm.work_years}
                            onChange={e => setEditForm(prev => ({ ...prev, work_years: e.target.value }))}
                            className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="工龄（数字）"
                          />
                        </div>
                      </div>
                    ) : (
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">{candidate.name}</h2>
                    )}
                    <p className="text-gray-600 mb-4 font-medium">{headline}</p>
                  </div>
                  {isEditing ? (
                    <button
                      onClick={saveCandidate}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 保存
                    </button>
                  ) : (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors text-gray-500 hover:bg-gray-100"
                    >
                      <Edit3 size={14} /> 编辑
                    </button>
                  )}
                </div>
                
                {/* Basic Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="text-center border-r border-gray-200 last:border-0">
                    <div className="text-xs text-gray-400 mb-1">工作经验</div>
                    <div className="font-bold text-gray-900">{candidate.work_years}年</div>
                  </div>
                  <div className="text-center border-r border-gray-200 last:border-0">
                    <div className="text-xs text-gray-400 mb-1">年龄</div>
                    <div className="font-bold text-gray-900">{candidate.age}岁</div>
                  </div>
                  <div className="text-center border-r border-gray-200 last:border-0">
                    <div className="text-xs text-gray-400 mb-1">学历</div>
                    <div className="font-bold text-gray-900">{candidate.degree_level}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">所在地</div>
                    <div className="font-bold text-indigo-600">{candidate.location || '未知'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <InfoItem icon={Phone} label="手机" value={candidate.phone} />
              <InfoItem icon={Mail} label="邮箱" value={candidate.email} />
              <InfoItem icon={MapPin} label="现居地" value={candidate.location} />
            </div>

            {/* AI 打标标签 */}
            {aiTags.length > 0 && (
              <div className="mb-8">
                <h3 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
                  <span>AI 打标</span>
                  <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded">基于简历内容自动识别</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {aiTags.map((tag: any, idx: number) => {
                    const colors = getTagColor(tag.category);
                    return (
                      <span
                        key={idx}
                        className={`px-3 py-1.5 rounded text-sm font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
                        title={tag.category}
                      >
                        {tag.tag_name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Self Evaluation */}
            <div className="mb-8 bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800 leading-relaxed">
              <h4 className="font-bold mb-2 text-blue-900">自我评价 / AI 总结</h4>
              {isEditing ? (
                <textarea
                  value={editForm.self_evaluation}
                  onChange={e => setEditForm(prev => ({ ...prev, self_evaluation: e.target.value }))}
                  className="w-full min-h-[120px] px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="自我评价"
                />
              ) : (
                candidate.self_evaluation || <span className="text-blue-700/60">（空）</span>
              )}
            </div>

            {/* File Management & Repair */}
            <SectionTitle title="原始文件" icon={Wrench} />
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              {/* 上传人信息 */}
              <div className="flex items-center gap-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold">
                  {(uploadData?.uploader_name || uploadData?.uploader_email || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs text-indigo-600 font-medium">上传人</div>
                  <div className="text-sm text-gray-900 font-medium">
                    {uploadData?.uploader_name || uploadData?.uploader_email || '未知'}
                  </div>
                  {uploadData?.uploader_name && uploadData?.uploader_email && (
                    <div className="text-xs text-gray-500">{uploadData.uploader_email}</div>
                  )}
                </div>
                <div className="ml-auto text-right">
                  <div className="text-xs text-indigo-600 font-medium">上传时间</div>
                  <div className="text-sm text-gray-700">
                    {uploadData?.created_at ? new Date(uploadData.created_at).toLocaleString() : '-'}
                  </div>
                </div>
              </div>
              
              {/* 重新解析按钮 */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-gray-500">
                  状态：<span className="font-medium text-gray-900">{uploadData?.status || '-'}</span>
                  {uploadData?.error_reason && (
                    <span className="ml-2 text-red-600">· {uploadData.error_reason}</span>
                  )}
                </div>
                <button
                  onClick={rerunOCR}
                  disabled={repairing}
                  className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm hover:bg-orange-600 disabled:opacity-60 flex items-center gap-2"
                  title="重新运行 OCR 和解析流程"
                >
                  {repairing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                  重新解析
                </button>
              </div>
            </div>

            {/* Work Experience */}
            <SectionTitle title="工作经历" icon={Briefcase} action={loading ? '加载中...' : '添加经历'} />
            <div className="space-y-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {candidate.candidate_work_experiences?.map((work: any) => (
                <div key={work.id} className="relative pl-10 group">
                  {/* Timeline Dot */}
                  <div className="absolute left-0 top-1.5 w-10 h-10 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-white border-2 border-indigo-400 rounded-full group-hover:bg-indigo-600 transition-colors z-10"></div>
                  </div>
                  
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg">{work.company}</h4>
                      <div className="text-gray-600 font-medium">{work.role} | {work.department}</div>
                    </div>
                    <div className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {work.start_date} - {work.end_date || '至今'}
                    </div>
                  </div>
                  {/* Tags could be inferred or stored in future */}
                  <p className="text-sm text-gray-700 mb-3 leading-relaxed whitespace-pre-line mt-2">
                    {work.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Projects */}
            <SectionTitle title="项目经历" icon={Calendar} action={loading ? '加载中...' : undefined} />
            <div className="space-y-6 pl-4 border-l border-gray-200 ml-5">
              {candidate.candidate_projects?.map((proj: any) => (
                <div key={proj.id} className="relative pl-6">
                  <div className="absolute -left-[5px] top-2 w-2.5 h-2.5 rounded-full bg-gray-300"></div>
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-gray-900">{proj.project_name}</h4>
                    <div className="text-xs text-gray-500">
                        {proj.start_date} - {proj.end_date || '至今'}
                    </div>
                  </div>
                  <div className="text-sm text-indigo-600 mb-1">{proj.role}</div>
                  <p className="text-sm text-gray-600 mb-2 whitespace-pre-line">{proj.description}</p>
                  {proj.tech_stack && proj.tech_stack.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                          {proj.tech_stack.map((t: string) => (
                              <span key={t} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">{t}</span>
                          ))}
                      </div>
                  )}
                </div>
              ))}
            </div>

            {/* Education */}
            <SectionTitle title="教育经历" icon={GraduationCap} action={loading ? '加载中...' : '添加'} />
            <div className="space-y-4">
              {candidate.candidate_educations?.map((edu: any) => (
                <div key={edu.id} className="flex justify-between items-center p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center text-orange-600">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 flex items-center gap-2">
                        {edu.school}
                        <div className="flex gap-1">
                          {edu.school_tags?.map((t: string) => (
                            <span key={t} className="text-[10px] font-normal px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded border border-orange-100">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        {edu.degree} · {edu.major}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {edu.start_date} - {edu.end_date || '至今'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: PDF Preview */}
        <div className="flex-1 bg-gray-100 flex flex-col border-l border-gray-200 relative hidden lg:flex">
          {/* Toolbar */}
          <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4">
            <span className="text-sm font-medium text-gray-600">原始简历预览</span>
            <div className="flex gap-2">
              <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded text-xs">缩小</button>
              <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded text-xs">放大</button>
              {pdfUrl && (
                <a 
                  href={pdfUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded text-xs flex items-center gap-1"
                >
                  <ExternalLink size={12} /> 新窗口打开
                </a>
              )}
            </div>
          </div>
          
          {/* PDF Placeholder */}
          <div className="flex-1 overflow-auto p-4 flex justify-center bg-gray-200/50">
            {pdfUrl ? (
              <iframe 
                src={`${pdfUrl}#toolbar=0&navpanes=0`} 
                className="w-full h-full bg-white shadow-sm rounded border border-gray-200"
                title="Resume Preview"
              />
            ) : (
              <div className="bg-white shadow-lg w-full max-w-[800px] min-h-[1000px] flex flex-col items-center justify-center text-gray-300 border border-gray-200">
                <FileText size={64} className="mb-4 text-gray-200" />
                <p className="text-lg font-medium text-gray-400">PDF 文件预览区域</p>
                <p className="text-sm text-gray-400 mt-2">{filename}</p>
                <p className="text-xs text-red-400 mt-2">无法加载预览链接，请检查 Bucket 权限或控制台日志。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

