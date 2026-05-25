'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { ADSENSE_CLIENT_ID } from '@/lib/ads';
const ADSENSE_SCRIPT_ID = 'meteor-crush-adsense-script';

export default function AdSenseLoader() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      return;
    }

    if (document.getElementById(ADSENSE_SCRIPT_ID)) {
      return;
    }

    const script = document.createElement('script');
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return null;
}
