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
  const [loading, setLoading] = useState(true);
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

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('candidates')
          .select(`
            *,
            candidate_educations (*),
            candidate_work_experiences (*),
            candidate_projects (*),
            candidate_tags (
              tags (tag_name, category)
            ),
            resume_uploads (id, filename, oss_raw_path, status, error_reason, updated_at, uploader_email, uploader_name, created_at)
          `)
          .eq('id', candidateId)
          .single();

        if (error) throw error;
        setCandidate(data);

        // Handle resume_uploads being an array or object
        const uploadData = Array.isArray(data.resume_uploads) ? data.resume_uploads[0] : data.resume_uploads;

        // init edit form
        setEditForm({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          location: data.location || '',
          degree_level: data.degree_level || '',
          work_years: data.work_years != null ? String(data.work_years) : '',
          self_evaluation: data.self_evaluation || ''
        });

        // init file form
        setFileForm({
          oss_raw_path: uploadData?.oss_raw_path || ''
        });

        // Fetch PDF URL if path exists (支持新旧存储 fallback)
        if (uploadData?.oss_raw_path) {
          const signedUrl = await getStorageUrl(uploadData.oss_raw_path, ['resumes', 'resume'], 3600);
          if (signedUrl) {
            setPdfUrl(signedUrl);
          } else {
            console.error('无法从新存储或旧存储获取 PDF URL');
          }
        } else {
          console.warn('No oss_raw_path found in resume_uploads', data.resume_uploads);
        }

      } catch (err: any) {
        console.error('Error fetching candidate detail:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
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
    if (!confirm('确定要重新 OCR 吗？这会把状态重置为 PENDING，等待后端 Pipeline 重新处理。')) return;
    setRepairing(true);
    try {
      const { error } = await supabase
        .from('resume_uploads')
        .update({ status: 'PENDING', error_reason: null, ocr_content: null })
        .eq('id', uploadData.id);
      if (error) throw error;
      alert('已提交重新 OCR（PENDING）。请等待后端 Pipeline 处理。');
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
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

            {/* Skills */}
            {skills.length > 0 && (
              <div className="mb-8">
                <h3 className="font-bold text-gray-900 mb-3 text-sm">技能标签</h3>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill: string) => (
                    <span key={skill} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm font-medium border border-gray-200">
                      {skill}
                    </span>
                  ))}
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
            <SectionTitle title="原始文件与修复" icon={Wrench} />
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
              <div className="text-xs text-gray-500">
                上传记录状态：<span className="font-medium text-gray-900">{uploadData?.status || '-'}</span>
                {uploadData?.error_reason ? (
                  <span className="ml-2 text-red-600">失败原因：{uploadData.error_reason}</span>
                ) : null}
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">oss_raw_path（可手动修复）</div>
                <input
                  value={fileForm.oss_raw_path}
                  onChange={e => setFileForm({ oss_raw_path: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="例如：userId/xxx.pdf 或 https://.../object/public/resumes/xxx"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={saveFilePath}
                  disabled={repairing}
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60"
                >
                  保存文件路径
                </button>
                <button
                  onClick={refreshPreviewUrl}
                  disabled={repairing}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-60 flex items-center gap-2"
                >
                  <RefreshCcw size={14} /> 刷新预览链接
                </button>
                <button
                  onClick={rerunOCR}
                  disabled={repairing}
                  className="px-3 py-2 rounded-lg border border-orange-300 text-orange-700 text-sm hover:bg-orange-50 disabled:opacity-60"
                  title="把 resume_uploads.status 置为 PENDING"
                >
                  重新 OCR
                </button>
                <button
                  onClick={rerunParse}
                  disabled={repairing}
                  className="px-3 py-2 rounded-lg border border-blue-300 text-blue-700 text-sm hover:bg-blue-50 disabled:opacity-60"
                  title="把 resume_uploads.status 置为 OCR_DONE"
                >
                  重新解析
                </button>
              </div>
              <div className="text-xs text-gray-500">
                说明：以上"重新 OCR/解析"会把状态改回待处理，需后端 <code>full_pipeline_test.py</code> 在跑，才会自动执行。
              </div>
            </div>

            {/* Work Experience */}
            <SectionTitle title="工作经历" icon={Briefcase} action="添加经历" />
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
            <SectionTitle title="项目经历" icon={Calendar} />
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
            <SectionTitle title="教育经历" icon={GraduationCap} action="添加" />
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

