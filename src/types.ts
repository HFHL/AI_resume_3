export interface Candidate {
  id: string;
  name: string;
  avatar: string;
  title: string;
  work_years: number;
  degree: string;
  phone: string | null;
  email: string;
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

export interface Upload {
  id: string;
  filename: string;
  size: string;
  status: 'success' | 'processing' | 'failed' | 'all' | 'PENDING' | 'OCR_DONE';
  error?: string;
  date: string;
  uploader_email?: string;
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
