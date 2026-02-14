'use client';

import { useRouter, useParams } from 'next/navigation';
import { MainLayout } from '@/components/MainLayout';
import { ResumeDetail } from '@/components/ResumeDetail';

export default function ResumeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const candidateId = params.id as string;

  const handleBack = () => {
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
