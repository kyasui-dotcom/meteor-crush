import type { Metadata } from 'next';
import LandingPageContent from '@/components/site/LandingPageContent';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE } from '@/lib/seo';

export const metadata: Metadata = {
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
};

export default function HomePage() {
  return <LandingPageContent />;
}
