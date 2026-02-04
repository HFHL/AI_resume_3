'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Settings, X, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Position } from '@/types';

export const JobList: React.FC = () => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [saving, setSaving] = useState(false);

  const [isMatchOpen, setIsMatchOpen] = useState(false);
  const [matchingPos, setMatchingPos] = useState<Position | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchRows, setMatchRows] = useState<
    { candidate_id: string; match_score: number; matched_keywords: string[]; total_keywords: number }[]
  >([]);
  const [matchCandidateById, setMatchCandidateById] = useState<
    Record<
      string,
      {
        id: string;
        name: string | null;
        degree_level: string | null;
        work_years: number | null;
        location: string | null;
        latest_company: string | null;
        latest_role: string | null;
        updated_at: string | null;
      }
    >
  >({});

  const [form, setForm] = useState({
    title: '',
    department: '',
    category: '',
    status: 'OPEN' as Position['status'],
    match_mode: 'any' as Position['match_mode'],
    required_keywords_text: '',
    description: '',
  });

  const resetForm = () => {
    setForm({
      title: '',
      department: '',
      category: '',
      status: 'OPEN',
      match_mode: 'any',
      required_keywords_text: '',
      description: '',
    });
  };

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (p: Position) => {
    setEditing(p);
    setForm({
      title: p.title || '',
      department: p.department || '',
      category: p.category || '',
      status: (p.status || 'OPEN') as any,
      match_mode: (p.match_mode || 'any') as any,
      required_keywords_text: (p.required_keywords || []).join(', '),
      description: p.description || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditing(null);
  };

  const openMatch = async (p: Position) => {
    setMatchingPos(p);
    setIsMatchOpen(true);
    setMatchError(null);
    setMatchRows([]);
    setMatchCandidateById({});
    setMatchLoading(true);
    try {
      const { data, error } = await supabase.rpc('match_candidates_for_position', {
        p_position_id: p.id,
        p_limit: 50,
        p_offset: 0
      });
      if (error) throw error;
      const rows = (data || []) as any[];
      setMatchRows(rows as any);

      // 批量补充候选人基础信息（用于展示）
      const ids = rows.map(r => r.candidate_id).filter(Boolean);
      if (ids.length > 0) {
        const { data: candRows, error: candErr } = await supabase
          .from('candidates')
          .select(`
            id,
            name,
            degree_level,
            work_years,
            location,
            updated_at,
            candidate_work_experiences (company, role)
          `)
          .in('id', ids);
        if (candErr) throw candErr;

        const map: Record<string, any> = {};
        (candRows || []).forEach((c: any) => {
          const works = c.candidate_work_experiences || [];
          const latest = works.length > 0 ? works[0] : null;
          map[c.id] = {
            id: c.id,
            name: c.name || null,
            degree_level: c.degree_level || null,
            work_years: c.work_years ?? null,
            location: c.location || null,
            latest_company: latest?.company || null,
            latest_role: latest?.role || null,
            updated_at: c.updated_at || null,
          };
        });
        setMatchCandidateById(map);
      }
    } catch (e: any) {
      console.error('match_candidates_for_position failed:', e);
      setMatchError(e?.message || '匹配失败（请确认已在数据库执行 migration/函数已创建）');
    } finally {
      setMatchLoading(false);
    }
  };

  const closeMatch = () => {
    if (matchLoading) return;
    setIsMatchOpen(false);
    setMatchingPos(null);
    setMatchRows([]);
    setMatchError(null);
    setMatchCandidateById({});
  };

  const openCandidateInNewTab = (candidateId: string) => {
    const url = `/resumes/${candidateId}`;
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  };

  const parseKeywords = (text: string): string[] => {
    const parts = text
      .split(/[,，\n]/g)
      .map(s => s.trim())
      .filter(Boolean);
    // 去重但保持顺序
    const seen = new Set<string>();
    return parts.filter(k => (seen.has(k) ? false : (seen.add(k), true)));
  };

  const fetchPositions = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setPositions((data || []) as Position[]);
    } catch (e: any) {
      console.error('Error fetching positions:', e);
      setError(e?.message || '加载职位失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = useMemo(() => positions, [positions]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      alert('请填写职位名称');
      return;
    }
    if (!form.description.trim()) {
      alert('请填写职位描述 / JD');
      return;
    }

    const payload = {
      title: form.title.trim(),
      department: form.department.trim() || null,
      category: form.category.trim() || null,
      status: form.status || 'OPEN',
      match_mode: form.match_mode || 'any',
      required_keywords: parseKeywords(form.required_keywords_text),
      description: form.description.trim(),
    };

    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from('positions')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('positions').insert(payload);
        if (error) throw error;
      }
      closeModal();
      await fetchPositions();
    } catch (e: any) {
      console.error('Error saving position:', e);
      alert(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">职位管理与匹配</h2>
          <p className="text-gray-500 mt-1">定义职位 JD，系统自动计算候选人匹配度</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
        >
          <Plus size={18} /> 新增职位
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={28} className="animate-spin text-indigo-500 mr-3" />
          <span>正在加载职位...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-lg flex items-center justify-between">
          <span>加载失败：{error}</span>
          <button
            onClick={fetchPositions}
            className="px-3 py-1.5 rounded bg-white border border-red-200 text-red-700 hover:bg-red-50"
          >
            重试
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map(p => {
            const keywords = p.required_keywords || [];
            const isOpen = (p.status || '').toUpperCase() === 'OPEN';
            return (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow relative group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg text-gray-900 truncate">{p.title}</h3>
                    <span className="text-xs text-gray-500">{p.department || '未填写部门'}</span>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full border ${
                      isOpen
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {p.status || 'OPEN'}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                    核心关键词（required_keywords）
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {keywords.length > 0 ? (
                      keywords.slice(0, 10).map(k => (
                        <span key={k} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
                          {k}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">未配置</span>
                    )}
                    {keywords.length > 10 && (
                      <span className="text-xs text-gray-400">+{keywords.length - 10}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-100">
                  <span className="text-xs">
                    匹配模式 <span className="font-medium text-gray-900">{p.match_mode || 'any'}</span>
                  </span>
                  <span className="text-xs">
                    更新于 {p.updated_at ? new Date(p.updated_at).toLocaleString() : '-'}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => openMatch(p)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
                  >
                    <Sparkles size={14} /> 匹配候选人
                  </button>
                </div>

                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(p)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="编辑职位"
                  >
                    <Settings size={16} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add New Placeholder */}
          <button
            onClick={openCreate}
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
          >
            <Plus size={32} className="mb-2" />
            <span className="font-medium">创建新职位</span>
          </button>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closeModal} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    {editing ? '编辑职位' : '新增职位'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    保存到 Supabase 表：<code>positions</code>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  disabled={saving}
                  className="p-2 rounded-lg hover:bg-gray-50 text-gray-500 disabled:opacity-50"
                  aria-label="关闭"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <div className="text-xs text-gray-500 mb-1">职位名称 *</div>
                    <input
                      value={form.title}
                      onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="例如：后端工程师 / 产品经理"
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs text-gray-500 mb-1">部门</div>
                    <input
                      value={form.department}
                      onChange={e => setForm(prev => ({ ...prev, department: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="例如：技术部"
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs text-gray-500 mb-1">类别</div>
                    <input
                      value={form.category}
                      onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="例如：AI / Web3 / 后端"
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs text-gray-500 mb-1">状态</div>
                    <select
                      value={form.status}
                      onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="text-xs text-gray-500 mb-1">匹配模式</div>
                    <select
                      value={form.match_mode}
                      onChange={e => setForm(prev => ({ ...prev, match_mode: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="any">any（命中任一关键词）</option>
                      <option value="all">all（必须命中全部关键词）</option>
                    </select>
                  </label>

                  <label className="block md:col-span-2">
                    <div className="text-xs text-gray-500 mb-1">必备关键词（逗号/换行分隔）</div>
                    <textarea
                      value={form.required_keywords_text}
                      onChange={e => setForm(prev => ({ ...prev, required_keywords_text: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                      placeholder="例如：Java, Spring Boot, MySQL"
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <div className="text-xs text-gray-500 mb-1">职位描述 / JD *</div>
                    <textarea
                      value={form.description}
                      onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[160px]"
                      placeholder="粘贴 JD，或描述职责/要求..."
                    />
                  </label>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
                <button
                  onClick={closeModal}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm disabled:opacity-60 flex items-center gap-2"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  保存
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Match Modal */}
      {isMatchOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closeMatch} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Sparkles size={18} className="text-indigo-600" />
                    候选人匹配结果
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    职位：<span className="font-medium text-gray-900">{matchingPos?.title}</span>（关键词来自
                    <code className="ml-1">positions.required_keywords</code>）
                  </div>
                </div>
                <button
                  onClick={closeMatch}
                  disabled={matchLoading}
                  className="p-2 rounded-lg hover:bg-gray-50 text-gray-500 disabled:opacity-50"
                  aria-label="关闭"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-5 max-h-[70vh] overflow-auto">
                {matchLoading ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 size={28} className="animate-spin text-indigo-500 mr-3" />
                    <span>正在计算匹配...</span>
                  </div>
                ) : matchError ? (
                  <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-lg">
                    {matchError}
                  </div>
                ) : matchRows.length === 0 ? (
                  <div className="text-gray-400 text-sm py-10 text-center">
                    暂无匹配结果（请检查关键词配置，或候选人数据是否已入库）。 
                  </div>
                ) : (
                  <div className="space-y-3">
                    {matchRows.map(r => {
                      const info = matchCandidateById[r.candidate_id];
                      const name = info?.name || '未命名';
                      const headlineParts = [
                        info?.latest_role,
                        info?.latest_company,
                        info?.work_years != null ? `${info.work_years}年` : null,
                        info?.degree_level,
                        info?.location,
                      ].filter(Boolean);
                      const headline = headlineParts.join(' · ');

                      return (
                      <div key={r.candidate_id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-900 font-medium flex items-center gap-2 min-w-0">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="font-bold text-gray-900 truncate">{name}</div>
                                <span className="text-xs text-gray-400 shrink-0">ID</span>
                                <button
                                  onClick={() => openCandidateInNewTab(r.candidate_id)}
                                  className="text-indigo-600 hover:text-indigo-700 hover:underline truncate"
                                  title="新开标签页打开简历"
                                >
                                  <code>{r.candidate_id}</code>
                                </button>
                              </div>
                              {headline && <div className="text-xs text-gray-500 mt-1 truncate">{headline}</div>}
                            </div>
                            <button
                              onClick={() => openCandidateInNewTab(r.candidate_id)}
                              className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-medium shrink-0"
                            >
                              打开简历
                            </button>
                          </div>
                          <div className="text-sm font-bold text-indigo-600">
                            {(r.match_score * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          命中 {r.matched_keywords?.length || 0} / {r.total_keywords} 关键词
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {(r.matched_keywords || []).slice(0, 12).map(k => (
                            <span key={k} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100">
                              {k}
                            </span>
                          ))}
                          {(r.matched_keywords || []).length > 12 && (
                            <span className="text-xs text-gray-400">+{(r.matched_keywords || []).length - 12}</span>
                          )}
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

