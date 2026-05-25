import type { Metadata } from 'next';
import PrivacyPageContent from '@/components/site/PrivacyPageContent';

export const metadata: Metadata = {
  title: 'Privacy Policy / プライバシーポリシー',
  description: 'Privacy Policy for Meteor Crush',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return <PrivacyPageContent />;
}
