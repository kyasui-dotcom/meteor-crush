'use client';

import { useEffect } from 'react';

export default function PwaRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Service worker support is optional; gameplay still works without it.
    });
  }, []);

  return null;
}
