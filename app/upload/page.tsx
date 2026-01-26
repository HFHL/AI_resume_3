'use client';

import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/MainLayout';
import { UploadCenter } from '@/components/UploadCenter';

export default function UploadPage() {
  const router = useRouter();

  const handleViewResume = (candidateId: string) => {
    router.push(`/resumes/${candidateId}`);
  };

  return (
    <MainLayout>
      <UploadCenter onViewClick={handleViewResume} />
    </MainLayout>
  );
}
