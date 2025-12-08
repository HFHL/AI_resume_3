import { Candidate, FilterState, WorkExperience } from '../types';
import { HIGHLIGHT_COMPANIES, OUTSOURCING_COMPANIES, GEO_KEYWORDS } from '../data/mockData';

// Helper to calculate total years of experience
export const calculateWorkYears = (experiences: WorkExperience[]): number => {
  if (experiences.length === 0) return 0;
  
  // Find the earliest start date
  const startDates = experiences.map(exp => new Date(exp.start_date).getTime());
  const earliest = Math.min(...startDates);
  
  const now = new Date().getTime();
  const diffTime = Math.abs(now - earliest);
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25); 
  
  return parseFloat(diffYears.toFixed(1));
};

// Helper to check if company is in highlight list
const isHighlightCompany = (companyName: string): boolean => {
  const allHighlight = Object.values(HIGHLIGHT_COMPANIES).flat().map(c => c.toLowerCase());
  return allHighlight.some(h => companyName.toLowerCase().includes(h.toLowerCase()));
};

// Helper to check outsourcing
const isOutsourcingCompany = (companyName: string): boolean => {
  return OUTSOURCING_COMPANIES.some(o => companyName.toLowerCase().includes(o.toLowerCase()));
};

// Helper to check geo keywords
const hasGeoKeyword = (companyName: string): boolean => {
  return GEO_KEYWORDS.some(geo => companyName.toLowerCase().includes(geo.toLowerCase()));
};

export const filterCandidates = (candidates: Candidate[], filters: FilterState): Candidate[] => {
  return candidates.filter(candidate => {
    // 1. Degree Filter
    if (filters.degree.length > 0) {
      if (!filters.degree.includes(candidate.education.degree)) return false;
    }

    // 2. School Tags Filter (Union/OR logic as per spec)
    if (filters.schoolTags.length > 0) {
      const hasTag = candidate.education.school_tags.some(tag => filters.schoolTags.includes(tag));
      if (!hasTag) return false;
    }

    const workYears = calculateWorkYears(candidate.work_experiences);

    // 3. Work Years Range
    if (filters.workYearsRange.length > 0) {
      const matchesRange = filters.workYearsRange.some(range => {
        if (range === '0-1') return workYears < 1;
        if (range === '1-3') return workYears >= 1 && workYears < 3;
        if (range === '3-5') return workYears >= 3 && workYears < 5;
        if (range === '5-10') return workYears >= 5 && workYears < 10;
        if (range === '10+') return workYears >= 10;
        return false;
      });
      if (!matchesRange) return false;
    }

    // 4. Min Work Years
    if (filters.minWorkYears !== '' && typeof filters.minWorkYears === 'number') {
      if (workYears < filters.minWorkYears) return false;
    }

    // 5. Highlight Companies
    const companies = candidate.work_experiences.map(e => e.company);
    const hasHighlight = companies.some(c => isHighlightCompany(c));
    
    if (filters.highlightCompanyMode === 'include' && !hasHighlight) return false;
    if (filters.highlightCompanyMode === 'exclude' && hasHighlight) return false;

    // 6. Outsourcing
    if (filters.onlyOutsourcing) {
      const hasOutsourcing = companies.some(c => isOutsourcingCompany(c));
      if (!hasOutsourcing) return false;
    }

    // 7. Geo Name (Negative/Feature filter)
    // "Geo Filter" logic: if checked, we match candidates who have geo keywords in company names?
    // Spec says: "Check Company Name Contains Geo... Purpose: Judge if candidate is long-term local or exclude local small biz".
    // Usually a filter means "Keep ONLY these". So if checked, we keep those with Geo keywords.
    if (filters.geoNameExclude) {
       const hasGeo = companies.some(c => hasGeoKeyword(c));
       if (!hasGeo) return false;
    }

    // 8. Data Quality (Phone Empty)
    if (filters.dataQualityPhoneEmpty) {
      if (candidate.phone !== null && candidate.phone !== '') return false;
    }

    // 9. Job Title (Secondary Filter)
    if (filters.jobTitle) {
      const titleMatch = candidate.work_experiences.some(exp => 
        exp.title.toLowerCase().includes(filters.jobTitle.toLowerCase())
      );
      if (!titleMatch) return false;
    }

    // 10. Global Search (Keywords)
    if (filters.keywords) {
      const term = filters.keywords.toLowerCase();
      const inName = candidate.name.toLowerCase().includes(term);
      const inSkills = candidate.tags.some(t => t.name.toLowerCase().includes(term));
      const inDesc = candidate.work_experiences.some(exp => 
        (exp.description || '').toLowerCase().includes(term) ||
        exp.title.toLowerCase().includes(term) ||
        exp.company.toLowerCase().includes(term)
      );
      
      if (!inName && !inSkills && !inDesc) return false;
    }

    return true;
  });
};

