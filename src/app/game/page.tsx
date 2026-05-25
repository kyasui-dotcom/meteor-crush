import type { Metadata } from 'next';
import GameCanvas from '@/components/game/GameCanvas';
import { SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: `Play ${SITE_NAME}`,
  description: 'Play Meteor Crush instantly in your browser with original fragment stacking, rarer-fire Bomber chains, scarce-weapon ARMORY overdrives and 1-cell weapon chains, and Purify 4-line-plus-core-cluster runs.',
  alternates: {
    canonical: '/game',
  },
};

export default function GamePage() {
  return (
    <div style={{
      width: '100vw',
      minHeight: '100svh',
      height: '100dvh',
      overflow: 'hidden',
      background: '#0a0a1a',
      overscrollBehavior: 'none',
      touchAction: 'none',
    }}>
      <GameCanvas />
    </div>
  );
}
