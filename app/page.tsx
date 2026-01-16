'use client';

import { useState, useMemo, useEffect } from 'react';
import { Star, ChevronDown, User, UploadCloud, LogOut, Loader2 } from 'lucide-react';
import { FilterSidebar } from '@/components/FilterSidebar';
import { ResumeList } from '@/components/ResumeList';
import { ResumeDetail } from '@/components/ResumeDetail';
import { JobList } from '@/components/JobList';
import { UploadCenter } from '@/components/UploadCenter';
import { UserProfile } from '@/components/UserProfile';
import { UserManagement } from '@/components/UserManagement';
import { Login } from '@/components/Login';
import { useAuth } from '@/contexts/AuthContext';
import { FilterState, Candidate } from '@/types';
import { supabase } from '@/lib/supabase';

export default function ResumeApp() {
  const { user, displayName, isAdmin, loading: authLoading, signOut } = useAuth();
  
  const [activeTab, setActiveTab] = useState<string>('resumes'); // 'resumes', 'jobs', 'upload', 'profile', 'users'
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  // Real Data State
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncStats, setSyncStats] = useState<{ pagesLoaded: number; totalLoaded: number }>({
    pagesLoaded: 0,
    totalLoaded: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // Resume List State
  const [filters, setFilters] = useState<FilterState>({
    search: '', degrees: [], schoolTags: [], minYears: '', companyTypes: [], tags: [], special: []
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(10);

  // Fetch candidates from Supabase
  useEffect(() => {
    if (!user) return;

    const fetchCandidates = async () => {
      let cancelled = false;

      const formatCandidates = (data: any[]): Candidate[] => {
        return (data || []).map((item: any) => {
          // Get latest work experience for title and company
          const works = item.candidate_work_experiences || [];
          const latestWork = works.length > 0 ? works[0] : null; // Assuming order or just taking first found

          // Get highest/first education
          const edus = item.candidate_educations || [];
          const mainEdu = edus.length > 0 ? edus[0] : null;

          // Extract tags
          const tags = (item.candidate_tags || []).map((t: any) => t.tags?.tag_name).filter(Boolean);

          return {
            id: item.id,
            name: (item.name && item.name.trim()) || 'Unknown',
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.id}`, // Generate avatar based on ID
            title: latestWork?.role || '待定职位',
            work_years: item.work_years || 0,
            degree: item.degree_level || mainEdu?.degree || '未知',
            phone: item.phone,
            email: item.email || '', // 允许 email 为空字符串
            school: {
              name: mainEdu?.school || '未填写',
              tags: mainEdu?.school_tags || []
            },
            company: latestWork?.company || '未填写',
            company_tags: [], // DB doesn't have company tags yet, leave empty or infer
            is_outsourcing: false, // DB doesn't have this field on candidate level easily available without logic
            location: item.location || '未知',
            skills: tags,
            match_score: Math.floor(Math.random() * 40) + 60, // Random score for demo
            last_active: new Date(item.updated_at).toLocaleDateString(),
            // 扩展字段用于搜索
            work_experiences: works.map((w: any) => ({
              company: w.company || '',
              role: w.role || '',
              department: w.department || '',
              start_date: w.start_date || '',
              end_date: w.end_date || '',
              description: w.description || ''
            })),
            educations: edus.map((e: any) => ({
              school: e.school || '',
              degree: e.degree || '',
              major: e.major || '',
              school_tags: e.school_tags || []
            })),
            projects: (item.candidate_projects || []).map((p: any) => ({
              project_name: p.project_name || '',
              role: p.role || '',
              description: p.description || ''
            })),
            self_evaluation: item.self_evaluation || ''
          };
        });
      };

      setLoading(true);
      setSyncing(false);
      setSyncStats({ pagesLoaded: 0, totalLoaded: 0 });
      setError(null);
      try {
        // 分页获取所有数据，Supabase 默认限制 1000 行
        // 优化：先拉首屏立即渲染，剩余页后台增量同步，避免“永远加载中”的体验。
        const PAGE_SIZE = 1000;
        const fetchPage = async (page: number) => {
          const from = page * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;
          return await supabase
            .from('candidates')
            .select(`
              *,
              candidate_educations (school, degree, major, school_tags),
              candidate_work_experiences (company, role, department, start_date, end_date, description),
              candidate_projects (project_name, role, description),
              candidate_tags (
                tags (tag_name, category)
              )
            `)
            .order('updated_at', { ascending: false })
            .range(from, to);
        };

        // 1) First page (fast path)
        const first = await fetchPage(0);
        if (first.error) throw first.error;
        const firstFormatted = formatCandidates(first.data || []);
        if (!cancelled) {
          setCandidates(firstFormatted);
          setSyncStats({ pagesLoaded: 1, totalLoaded: firstFormatted.length });
          setLoading(false);
        }

        // 2) Background sync remaining pages
        if ((first.data || []).length >= PAGE_SIZE) {
          if (!cancelled) setSyncing(true);
          let page = 1;
          let hasMore = true;

          while (hasMore && !cancelled) {
            const res = await fetchPage(page);
            if (res.error) {
              console.error('Error fetching candidates (background):', res.error);
              setError(res.error.message || '加载失败');
              break;
            }

            const rows = res.data || [];
            if (rows.length === 0) {
              hasMore = false;
              break;
            }

            const formatted = formatCandidates(rows);
            setCandidates(prev => [...prev, ...formatted]);
            setSyncStats(prev => ({
              pagesLoaded: prev.pagesLoaded + 1,
              totalLoaded: prev.totalLoaded + formatted.length,
            }));

            if (rows.length < PAGE_SIZE) hasMore = false;
            page += 1;
          }

          if (!cancelled) setSyncing(false);
        } else {
          if (!cancelled) setSyncing(false);
        }
      } catch (err: any) {
        console.error('Error fetching candidates:', err);
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchCandidates();
  }, [user]);

  const filteredCandidates = useMemo(() => {
    const result = candidates.filter(c => {
      // 确保候选人有有效的 ID 和 name
      if (!c.id || !c.name || c.name === 'Unknown') {
        return false; // 过滤掉无效数据
      }

      if (filters.search) {
        const q = filters.search.trim();
        if (!q) return true; // 空搜索返回所有
        
        // 对于中文搜索，不转换为小写（保持原样）
        const qLower = q.toLowerCase();
        
        // 搜索所有字段（中文字段保持原样，英文字段转小写）
        const searchFields = [
          // 基本信息 - 中文字段保持原样
          c.name || '',
          c.email?.toLowerCase() || '',
          c.phone || '',
          c.location || '',
          c.title || '',
          c.company || '',
          c.degree || '',
          c.self_evaluation || '',
          // 学校信息
          c.school?.name || '',
          ...(c.school?.tags || []),
          // 技能标签
          ...(c.skills || []),
          // 工作经历
          ...(c.work_experiences || []).flatMap(w => [
            w.company || '',
            w.role || '',
            w.department || '',
            w.description || ''
          ]),
          // 教育经历
          ...(c.educations || []).flatMap(e => [
            e.school || '',
            e.degree || '',
            e.major || '',
            ...(e.school_tags || [])
          ]),
          // 项目经历
          ...(c.projects || []).flatMap(p => [
            p.project_name || '',
            p.role || '',
            p.description || ''
          ])
        ];
        
        // 检查搜索关键词是否在任何字段中
        // 对于中文字符，直接匹配；对于英文字符，不区分大小写
        const matches = searchFields.some(field => {
          if (!field) return false;
          // 如果搜索词包含中文字符，直接匹配
          if (/[\u4e00-\u9fa5]/.test(q)) {
            return field.includes(q);
          }
          // 否则不区分大小写匹配
          return field.toLowerCase().includes(qLower);
        });
        
        if (!matches) {
          // 调试：如果没匹配到，记录原因
          if (c.name && (c.name.includes('俞勇') || c.name.includes('Renee'))) {
            console.log(`Candidate ${c.name} did not match search "${q}"`, {
              name: c.name,
              nameIncludes: c.name.includes(q),
              searchFields: searchFields.slice(0, 5) // 只显示前5个字段
            });
          }
          return false;
        }
      }
      if (filters.degrees.length > 0 && !filters.degrees.includes(c.degree)) return false;
      if (filters.schoolTags.length > 0 && !c.school.tags.some(t => filters.schoolTags.includes(t))) return false;
      if (filters.minYears && c.work_years < parseInt(filters.minYears)) return false;
      if (filters.companyTypes.length > 0 && !c.company_tags.some(t => filters.companyTypes.includes(t))) return false;
      if (filters.tags.length > 0 && !c.skills.some(s => filters.tags.includes(s))) return false;
      if (filters.special.includes('outsourcing') && !c.is_outsourcing) return false;
      if (filters.special.includes('noPhone') && c.phone !== null) return false;
      return true;
    });
    
    // 调试：记录过滤结果
    if (filters.search) {
      console.log(`Search "${filters.search}": ${result.length} results from ${candidates.length} total`);
    }
    
    return result;
  }, [filters, candidates]);

  // Paginated candidates
  const paginatedCandidates = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredCandidates.slice(startIndex, endIndex);
  }, [filteredCandidates, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleResetFilters = () => {
    setFilters({search:'', degrees:[], schoolTags:[], minYears:'', companyTypes:[], tags: [], special:[]}); 
    setSelectedIds([]);
  };

  const handleCandidateClick = (id: string) => {
    setSelectedCandidateId(id);
  };

  const handleBackToResumeList = () => {
    setSelectedCandidateId(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsUserMenuOpen(false);
      // Force reload to clear all cached state
      window.location.href = '/';
    } catch (e) {
      console.error('signOut failed:', e);
      // Force reload anyway
      window.location.href = '/';
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={48} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col h-screen">
      {!selectedCandidateId && (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm flex-shrink-0">
          <div className="w-full px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8 h-full">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('resumes')}>
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">AI</div>
                <span className="text-lg font-bold text-gray-900 tracking-tight">TalentScout</span>
              </div>
              <nav className="hidden md:flex space-x-6 text-sm font-medium text-gray-500 h-full">
                {[
                  {id: 'resumes', label: '简历管理'}, 
                  {id: 'jobs', label: '职位匹配'}, 
                  {id: 'upload', label: '上传中心'},
                  ...(isAdmin ? [{ id: 'users', label: '用户管理' }] : []),
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`h-full border-b-2 pt-1 transition-colors ${activeTab === tab.id ? 'text-indigo-600 border-indigo-600' : 'border-transparent hover:text-gray-900'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-4 relative">
              <button className="p-2 text-gray-400 hover:text-gray-600"><Star size={20} /></button>
              <div className="relative">
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 hover:bg-gray-50 p-1 rounded-full pr-3 transition-colors border border-transparent hover:border-gray-200"
                >
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
                     {(displayName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <ChevronDown size={14} className="text-gray-400" />
                </button>
                
                {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)}></div>
                    <div className="absolute right-0 top-12 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                      <div className="px-4 py-3 border-b border-gray-100 mb-1">
                        <div className="font-medium text-sm text-gray-900 truncate">{displayName || '用户'}</div>
                        <div className="text-xs text-gray-500 truncate">已登录</div>
                      </div>
                      <button 
                        onClick={() => {setActiveTab('profile'); setIsUserMenuOpen(false)}}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <User size={14} /> 用户(HR)信息
                      </button>
                      <button 
                        onClick={() => {setActiveTab('upload'); setIsUserMenuOpen(false)}}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <UploadCloud size={14} /> 我的上传
                      </button>
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <button 
                          onClick={handleSignOut}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <LogOut size={14} /> 退出登录
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      <main className="flex-1 w-full flex overflow-hidden">
        {activeTab === 'resumes' && !selectedCandidateId && (
          <div className="flex h-full w-full">
            <FilterSidebar filters={filters} setFilters={setFilters} onReset={handleResetFilters} />
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center h-full text-gray-400">
                <Loader2 size={48} className="animate-spin text-indigo-500 mb-4" />
                <p>正在加载简历数据...</p>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center h-full text-red-500">
                <p>加载失败: {error}</p>
                <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100">重试</button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col h-full">
                {syncing && (
                  <div className="px-6 py-2 text-xs text-indigo-700 bg-indigo-50 border-b border-indigo-100">
                    正在后台同步简历数据：已加载 <span className="font-medium">{syncStats.totalLoaded}</span> 条（第{' '}
                    <span className="font-medium">{syncStats.pagesLoaded}</span> 页）…
                  </div>
                )}
                <ResumeList 
                  candidates={paginatedCandidates}
                  allCandidates={filteredCandidates}
                  filters={filters} 
                  setFilters={setFilters} 
                  selectedIds={selectedIds} 
                  setSelectedIds={setSelectedIds} 
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onUploadClick={() => setActiveTab('upload')}
                  onCandidateClick={handleCandidateClick}
                />
              </div>
            )}
          </div>
        )}
        {activeTab === 'resumes' && selectedCandidateId && (
          <ResumeDetail onBack={handleBackToResumeList} candidateId={selectedCandidateId} />
        )}

        {activeTab === 'jobs' && !selectedCandidateId && <JobList />}
        {activeTab === 'upload' && !selectedCandidateId && <UploadCenter onViewClick={() => setActiveTab('resumes')} />}
        {activeTab === 'profile' && !selectedCandidateId && <UserProfile />}
        {activeTab === 'users' && !selectedCandidateId && <UserManagement />}
      </main>
    </div>
  );
}

