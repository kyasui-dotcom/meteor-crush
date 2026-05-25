'use client';

import { useEffect, useRef, useState } from 'react';
import { getWebGameOverAdState } from '@/lib/ads';

type Props = {
  locale: 'ja' | 'en';
};

type PushStatus = 'idle' | 'loading' | 'ready' | 'failed';

type AdSenseQueue = {
  push: (config: Record<string, never>) => unknown;
};

declare global {
  interface Window {
    adsbygoogle?: AdSenseQueue;
  }
}

const MAX_PUSH_ATTEMPTS = 12;
const PUSH_RETRY_MS = 300;

export default function GameOverAdSense({ locale }: Props) {
  const adState = getWebGameOverAdState();
  const adRef = useRef<HTMLElement | null>(null);
  const pushedRef = useRef(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>('idle');

  useEffect(() => {
    if (!adState.eligible || !adState.slotId) {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let timeoutId: number | null = null;
    let frameId: number | null = null;

    const scheduleRetry = () => {
      if (cancelled) {
        return;
      }

      if (attempts >= MAX_PUSH_ATTEMPTS) {
        setPushStatus('failed');
        return;
      }

      attempts += 1;
      timeoutId = window.setTimeout(() => {
        frameId = window.requestAnimationFrame(tryPush);
      }, PUSH_RETRY_MS);
    };

    const tryPush = () => {
      if (cancelled || pushedRef.current) {
        return;
      }

      const adElement = adRef.current;
      const queue = window.adsbygoogle;
      if (!adElement || adElement.offsetWidth === 0 || !queue || typeof queue.push !== 'function') {
        setPushStatus('loading');
        scheduleRetry();
        return;
      }

      try {
        setPushStatus('loading');
        queue.push({});
        pushedRef.current = true;
        setPushStatus('ready');
      } catch (error) {
        console.warn('Game-over AdSense push failed:', error);
        scheduleRetry();
      }
    };

    frameId = window.requestAnimationFrame(tryPush);

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [adState.eligible, adState.slotId]);

  if (!adState.eligible || !adState.slotId) {
    return null;
  }

  const label = locale === 'ja' ? 'スポンサーリンク' : 'Advertisement';
  const loadingLabel = locale === 'ja' ? '広告を読み込み中...' : 'Loading ad...';

  return (
    <div style={{
      width: 'min(100%, 360px)',
      marginTop: '10px',
      padding: '12px',
      borderRadius: '18px',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.04)',
      display: 'grid',
      gap: '10px',
      boxSizing: 'border-box',
    }}>
      <span style={{
        fontSize: '10px',
        color: '#98a4c0',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <div style={{
        position: 'relative',
        width: '100%',
        minHeight: '250px',
        borderRadius: '14px',
        overflow: 'hidden',
        background: 'rgba(5,8,18,0.68)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        {pushStatus !== 'ready' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: '#7f879a',
            pointerEvents: 'none',
          }}>
            {loadingLabel}
          </div>
        )}
        <ins
          ref={(node) => {
            adRef.current = node;
          }}
          className="adsbygoogle"
          style={{
            display: 'block',
            width: '100%',
            minHeight: '250px',
          }}
          data-ad-client={adState.clientId}
          data-ad-slot={adState.slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
