'use client';

import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { MainLayout } from '@/components/MainLayout';
import { ResumeDetail } from '@/components/ResumeDetail';

export default function ResumeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const candidateId = params.id as string;
  const searchParams = useSearchParams();

  const handleBack = () => {
    try {
      const from = searchParams?.get?.('from');
      const page = searchParams?.get?.('page');
      try { console.log('[ResumeDetailPage] handleBack params', { from, page }); } catch (e) {}
      if (from === 'admin_stats') {
        const q = page ? `?from=admin_stats&page=${encodeURIComponent(page)}` : `?from=admin_stats`;
        try { console.log('[ResumeDetailPage] navigating back to admin/stats' + q); } catch (e) {}
        router.push(`/admin/stats${q}`);
        return;
      }
      if (from === 'user_stats') {
        const q = page ? `?from=user_stats&page=${encodeURIComponent(page)}` : `?from=user_stats`;
        try { console.log('[ResumeDetailPage] navigating back to my-stats' + q); } catch (e) {}
        router.push(`/my-stats${q}`);
        return;
      }
      if (from === 'resumes') {
        const q = page ? `?from=resumes&page=${encodeURIComponent(page)}` : `?from=resumes`;
        try { console.log('[ResumeDetailPage] navigating back to resumes' + q); } catch (e) {}
        router.push(`/resumes${q}`);
        return;
      }
    } catch (e) {
      // fallthrough to history/back
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/resumes');
    }
  };

  return (
    <MainLayout hideHeader>
      <ResumeDetail onBack={handleBack} candidateId={candidateId} />
    </MainLayout>
  );
}
