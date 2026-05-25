import { registerPlugin } from '@capacitor/core';

export type NativeInterstitialState = {
  currentAdId?: string | null;
  detail?: string;
  initialized?: boolean;
  initializedNow?: boolean;
  lastError?: string | null;
  lastErrorCode?: string | null;
  loadCount?: number;
  ready?: boolean;
  showCount?: number;
  shown?: boolean;
  state?: string;
};

type NativeAndroidAdMobPlugin = {
  getState(): Promise<NativeInterstitialState>;
  initialize(options?: { isTesting?: boolean }): Promise<NativeInterstitialState>;
  prepareInterstitial(options: { adId: string; isTesting?: boolean }): Promise<NativeInterstitialState>;
  showInterstitial(): Promise<NativeInterstitialState>;
};

export const NativeAndroidAdMob = registerPlugin<NativeAndroidAdMobPlugin>('MeteorAdMob');
