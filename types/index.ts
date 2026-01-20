export interface WorkExperience {
  company: string;
  role: string;
  department?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

export interface Education {
  school: string;
  degree: string;
  major?: string;
  school_tags?: string[];
}

export interface Project {
  project_name: string;
  role?: string;
  description?: string;
}

export interface Candidate {
  id: string;
  name: string;
  avatar: string;
  title: string;
  work_years: number;
  degree: string;
  phone: string | null;
  email: string | null;
  school: {
    name: string;
    tags: string[];
  };
  company: string;
  company_tags: string[];
  is_outsourcing: boolean;
  location: string;
  skills: string[];
  match_score: number;
  last_active: string;
  // 扩展字段用于搜索
  work_experiences?: WorkExperience[];
  educations?: Education[];
  projects?: Project[];
  self_evaluation?: string;
  // AI 打标标签
  tags?: CandidateTag[];
}

export interface CandidateTag {
  id: number;
  tag_name: string;
  category: string;
}

export interface Tag {
  id: number;
  tag_name: string;
  category: 'tech' | 'non_tech' | 'web3' | 'quant' | 'ai' | string;
}

export interface Job {
  id: string;
  title: string;
  department: string;
  match_mode: string;
  keywords: string[];
  status: string;
  candidates_count: number;
  updated_at: string;
}

// Supabase: public.positions
export interface Position {
  id: number;
  title: string;
  department: string | null;
  description: string;
  category: string | null;
  status: 'OPEN' | 'CLOSED' | string;
  match_mode: 'any' | 'all' | string;
  required_keywords: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Upload {
  id: string;
  filename: string;
  size: string;
  status: 'success' | 'processing' | 'failed' | 'all' | 'PENDING' | 'OCR_DONE';
  error?: string;
  date: string;
  uploader_email?: string;
}

export type UserRole = 'user' | 'admin' | 'super_admin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  user_id: string;
  email: string | null;
  display_name: string;
  role: UserRole;
  approval_status: ApprovalStatus;
  created_at?: string;
  updated_at?: string;
}

export interface FilterState {
  search: string;
  degrees: string[];
  schoolTags: string[];
  minYears: string;
  companyTypes: string[];
  tags: string[];
  special: string[];
}

