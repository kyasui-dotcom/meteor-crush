// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const isNativePlatformMock = vi.fn(() => true);
const getPlatformMock = vi.fn(() => 'web');
const initializeMock = vi.fn(async () => {});
const addListenerMock = vi.fn(async () => ({ remove: vi.fn() }));
const prepareInterstitialMock = vi.fn(async () => ({}));
const showInterstitialMock = vi.fn(async () => {});
const nativeGetStateMock = vi.fn(async () => ({}));
const nativeInitializeMock = vi.fn(async () => ({}));
const nativePrepareInterstitialMock = vi.fn(async () => ({}));
const nativeShowInterstitialMock = vi.fn(async () => ({}));
const registerPluginMock = vi.fn(() => ({
  getState: (...args: unknown[]) => nativeGetStateMock(...args),
  initialize: (...args: unknown[]) => nativeInitializeMock(...args),
  prepareInterstitial: (...args: unknown[]) => nativePrepareInterstitialMock(...args),
  showInterstitial: (...args: unknown[]) => nativeShowInterstitialMock(...args),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatformMock(),
    getPlatform: () => getPlatformMock(),
  },
  registerPlugin: (...args: unknown[]) => registerPluginMock(...args),
}));

vi.mock('@capacitor-community/admob', () => ({
  AdMob: {
    initialize: (...args: unknown[]) => initializeMock(...args),
    addListener: (...args: unknown[]) => addListenerMock(...args),
    prepareInterstitial: (...args: unknown[]) => prepareInterstitialMock(...args),
    showInterstitial: (...args: unknown[]) => showInterstitialMock(...args),
  },
  InterstitialAdPluginEvents: {
    Loaded: 'interstitialAdLoaded',
    FailedToLoad: 'interstitialAdFailedToLoad',
    Showed: 'interstitialAdShowed',
    FailedToShow: 'interstitialAdFailedToShow',
    Dismissed: 'interstitialAdDismissed',
  },
}));

async function loadAdsModule() {
  vi.resetModules();
  return import('@/lib/ads');
}

async function settleBackgroundAdWork() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('interstitial ads', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  const originalTestModeEnv = process.env.NEXT_PUBLIC_ADMOB_TEST_MODE;
  const originalUseTestAdUnitsEnv = process.env.NEXT_PUBLIC_USE_TEST_AD_UNITS;
  const originalAdDebugToolsEnv = process.env.NEXT_PUBLIC_AD_DEBUG_TOOLS;
  const originalNativeBridgeEnv = process.env.NEXT_PUBLIC_USE_NATIVE_ANDROID_ADS;
  const originalAdSenseSlotEnv = process.env.NEXT_PUBLIC_ADSENSE_GAME_OVER_SLOT;

  beforeEach(() => {
    localStorage.clear();
    delete process.env.NEXT_PUBLIC_ADMOB_TEST_MODE;
    delete process.env.NEXT_PUBLIC_USE_TEST_AD_UNITS;
    delete process.env.NEXT_PUBLIC_AD_DEBUG_TOOLS;
    delete process.env.NEXT_PUBLIC_USE_NATIVE_ANDROID_ADS;
    delete process.env.NEXT_PUBLIC_ADSENSE_GAME_OVER_SLOT;
    isNativePlatformMock.mockReset();
    getPlatformMock.mockReset();
    initializeMock.mockReset();
    addListenerMock.mockReset();
    prepareInterstitialMock.mockReset();
    showInterstitialMock.mockReset();
    nativeGetStateMock.mockReset();
    nativeInitializeMock.mockReset();
    nativePrepareInterstitialMock.mockReset();
    nativeShowInterstitialMock.mockReset();
    registerPluginMock.mockClear();

    isNativePlatformMock.mockReturnValue(true);
    getPlatformMock.mockReturnValue('web');
    initializeMock.mockResolvedValue(undefined);
    addListenerMock.mockResolvedValue({ remove: vi.fn() });
    prepareInterstitialMock.mockResolvedValue({});
    showInterstitialMock.mockResolvedValue(undefined);
    nativeGetStateMock.mockResolvedValue({});
    nativeInitializeMock.mockResolvedValue({});
    nativePrepareInterstitialMock.mockResolvedValue({});
    nativeShowInterstitialMock.mockResolvedValue({});

    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (typeof originalTestModeEnv === 'string') {
      process.env.NEXT_PUBLIC_ADMOB_TEST_MODE = originalTestModeEnv;
    } else {
      delete process.env.NEXT_PUBLIC_ADMOB_TEST_MODE;
    }
    if (typeof originalUseTestAdUnitsEnv === 'string') {
      process.env.NEXT_PUBLIC_USE_TEST_AD_UNITS = originalUseTestAdUnitsEnv;
    } else {
      delete process.env.NEXT_PUBLIC_USE_TEST_AD_UNITS;
    }
    if (typeof originalAdDebugToolsEnv === 'string') {
      process.env.NEXT_PUBLIC_AD_DEBUG_TOOLS = originalAdDebugToolsEnv;
    } else {
      delete process.env.NEXT_PUBLIC_AD_DEBUG_TOOLS;
    }
    if (typeof originalNativeBridgeEnv === 'string') {
      process.env.NEXT_PUBLIC_USE_NATIVE_ANDROID_ADS = originalNativeBridgeEnv;
    } else {
      delete process.env.NEXT_PUBLIC_USE_NATIVE_ANDROID_ADS;
    }
    if (typeof originalAdSenseSlotEnv === 'string') {
      process.env.NEXT_PUBLIC_ADSENSE_GAME_OVER_SLOT = originalAdSenseSlotEnv;
    } else {
      delete process.env.NEXT_PUBLIC_ADSENSE_GAME_OVER_SLOT;
    }
    warnSpy.mockRestore();
  });

  it('enables the web game-over AdSense slot on the third eligible completed play', async () => {
    process.env.NEXT_PUBLIC_ADSENSE_GAME_OVER_SLOT = '1234567890';
    isNativePlatformMock.mockReturnValue(false);

    const ads = await loadAdsModule();

    expect(ads.getWebGameOverAdState()).toMatchObject({
      eligible: false,
      reason: 'session-gate',
      slotId: '1234567890',
    });

    ads.recordCompletedPlay();
    expect(ads.getWebGameOverAdState().eligible).toBe(false);
    ads.recordCompletedPlay();
    expect(ads.getWebGameOverAdState().eligible).toBe(false);
    ads.recordCompletedPlay();
    expect(ads.getWebGameOverAdState()).toMatchObject({
      eligible: true,
      reason: 'eligible',
      slotId: '1234567890',
    });
  });

  it('keeps the web game-over AdSense slot hidden when no slot is configured', async () => {
    isNativePlatformMock.mockReturnValue(false);

    const ads = await loadAdsModule();

    ads.recordCompletedPlay();
    ads.recordCompletedPlay();
    ads.recordCompletedPlay();

    expect(ads.getWebGameOverAdState()).toMatchObject({
      eligible: false,
      reason: 'missing-slot',
      slotId: null,
    });
  });

  it('keeps the first two plays ad-free and shows on the third eligible play', async () => {
    const ads = await loadAdsModule();

    ads.recordCompletedPlay();
    expect(await ads.showInterstitial()).toBe(false);
    expect(ads.getInterstitialDebugState().lastDecision).toBe('show:skipped');
    expect(ads.getInterstitialDebugState().lastDecisionDetail).toContain('Session gate active');
    await settleBackgroundAdWork();
    ads.recordCompletedPlay();
    expect(await ads.showInterstitial()).toBe(false);
    await settleBackgroundAdWork();
    expect(showInterstitialMock).not.toHaveBeenCalled();

    ads.recordCompletedPlay();
    expect(await ads.showInterstitial()).toBe(true);
    expect(showInterstitialMock).toHaveBeenCalledTimes(1);
    expect(ads.getInterstitialDebugState().completedPlaysThisSession).toBe(3);
    expect(ads.getInterstitialDebugState().lastDecision).toBe('show:success');
  });

  it('waits for a late interstitial load instead of skipping the eligible game over', async () => {
    prepareInterstitialMock
      .mockRejectedValueOnce(new Error('no fill #1'))
      .mockRejectedValueOnce(new Error('no fill #2'))
      .mockResolvedValueOnce({});

    const ads = await loadAdsModule();

    ads.recordCompletedPlay();
    expect(await ads.showInterstitial()).toBe(false);
    await settleBackgroundAdWork();
    ads.recordCompletedPlay();
    expect(await ads.showInterstitial()).toBe(false);
    await settleBackgroundAdWork();
    ads.recordCompletedPlay();
    expect(await ads.showInterstitial()).toBe(true);

    expect(prepareInterstitialMock).toHaveBeenCalledTimes(3);
    expect(showInterstitialMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the play count even if the caller has already left the game-over screen', async () => {
    prepareInterstitialMock
      .mockRejectedValueOnce(new Error('no fill #1'))
      .mockRejectedValueOnce(new Error('no fill #2'));

    let stillOnGameOver = true;
    prepareInterstitialMock.mockImplementationOnce(async () => {
      stillOnGameOver = false;
      return {};
    });

    const ads = await loadAdsModule();

    ads.recordCompletedPlay();
    expect(await ads.showInterstitial()).toBe(false);
    await settleBackgroundAdWork();
    ads.recordCompletedPlay();
    expect(await ads.showInterstitial()).toBe(false);
    await settleBackgroundAdWork();
    ads.recordCompletedPlay();
    expect(await ads.showInterstitial({ shouldShow: () => stillOnGameOver })).toBe(false);
    expect(showInterstitialMock).not.toHaveBeenCalled();
    expect(ads.getInterstitialDebugState().completedPlaysThisSession).toBe(3);

    stillOnGameOver = true;
    expect(await ads.showInterstitial({ shouldShow: () => stillOnGameOver })).toBe(true);
    expect(showInterstitialMock).toHaveBeenCalledTimes(1);
  });

  it('bypasses the ad-free reward and first-play gate in test mode', async () => {
    process.env.NEXT_PUBLIC_ADMOB_TEST_MODE = 'true';
    localStorage.setItem('meteor-crush', JSON.stringify({
      highScores: {},
      totalLinesCleared: 0,
      playerName: 'Tester',
      scoreHistory: {},
      continent: 'JP',
      showRulesBeforeGame: true,
      secretModeUnlocked: false,
      easterEggsFound: [],
      adFreeUntil: Date.now() + 60_000,
    }));

    const ads = await loadAdsModule();

    ads.recordCompletedPlay();
    expect(await ads.showInterstitial()).toBe(true);
    expect(showInterstitialMock).toHaveBeenCalledTimes(1);
    expect(initializeMock).toHaveBeenCalledWith(expect.objectContaining({ initializeForTesting: true }));
    expect(ads.getInterstitialDebugState().testMode).toBe(true);
    expect(ads.getInterstitialDebugState().adFreeGateBypassed).toBe(true);
    expect(ads.getInterstitialDebugState().lastDecision).toBe('show:success');
  });

  it('records why a guarded show request was cancelled', async () => {
    const ads = await loadAdsModule();

    ads.recordCompletedPlay();
    ads.recordCompletedPlay();
    ads.recordCompletedPlay();

    expect(await ads.showInterstitial({ shouldShow: () => false })).toBe(false);
    expect(ads.getInterstitialDebugState().lastDecision).toBe('show:cancelled');
    expect(ads.getInterstitialDebugState().lastDecisionDetail).toContain('Caller guard returned false');
  });

  it('keeps production-style gating when only test ad units are enabled', async () => {
    process.env.NEXT_PUBLIC_USE_TEST_AD_UNITS = 'true';
    localStorage.setItem('meteor-crush', JSON.stringify({
      highScores: {},
      totalLinesCleared: 0,
      playerName: 'Tester',
      scoreHistory: {},
      continent: 'JP',
      showRulesBeforeGame: true,
      secretModeUnlocked: false,
      easterEggsFound: [],
      adFreeUntil: Date.now() + 60_000,
    }));

    const ads = await loadAdsModule();

    ads.recordCompletedPlay();
    expect(await ads.showInterstitial()).toBe(false);

    const debugState = ads.getInterstitialDebugState();
    expect(debugState.testMode).toBe(true);
    expect(debugState.debugToolsEnabled).toBe(false);
    expect(debugState.adFreeGateBypassed).toBe(false);
    expect(debugState.lastDecision).toBe('show:skipped');
    expect(debugState.lastDecisionDetail).toContain('Session gate active: 1/2 completed plays.');
  });

  it('uses the native Android bridge when enabled for Android builds', async () => {
    process.env.NEXT_PUBLIC_ADMOB_TEST_MODE = 'true';
    process.env.NEXT_PUBLIC_USE_NATIVE_ANDROID_ADS = 'true';
    getPlatformMock.mockReturnValue('android');

    nativeInitializeMock.mockResolvedValue({
      initialized: true,
      ready: false,
      state: 'idle',
    });
    nativePrepareInterstitialMock.mockResolvedValue({
      initialized: true,
      ready: true,
      state: 'ready',
      loadCount: 1,
      currentAdId: 'ca-app-pub-3940256099942544/1033173712',
    });
    nativeShowInterstitialMock.mockResolvedValue({
      initialized: true,
      shown: true,
      ready: false,
      state: 'show_requested',
      showCount: 1,
    });

    const ads = await loadAdsModule();

    expect(await ads.initializeAds()).toBe(true);
    expect(await ads.prepareInterstitial()).toBe(true);
    expect(await ads.showInterstitial()).toBe(true);

    expect(nativeInitializeMock).toHaveBeenCalledWith({ isTesting: true });
    expect(nativePrepareInterstitialMock).toHaveBeenCalledWith({
      adId: 'ca-app-pub-3940256099942544/1033173712',
      isTesting: true,
    });
    expect(nativeShowInterstitialMock).toHaveBeenCalledTimes(1);
    expect(initializeMock).not.toHaveBeenCalled();
    expect(prepareInterstitialMock).not.toHaveBeenCalled();
    expect(showInterstitialMock).not.toHaveBeenCalled();

    const debugState = ads.getInterstitialDebugState();
    expect(debugState.usingNativeAndroidBridge).toBe(true);
    expect(debugState.nativeLoadCount).toBe(1);
    expect(debugState.nativeShowCount).toBe(1);
    expect(debugState.lastDecision).toBe('show:success');
  });

  it('refreshes debug state from the native Android bridge', async () => {
    process.env.NEXT_PUBLIC_USE_NATIVE_ANDROID_ADS = 'true';
    getPlatformMock.mockReturnValue('android');

    nativeGetStateMock.mockResolvedValue({
      initialized: true,
      ready: false,
      state: 'idle',
      lastError: 'No fill',
      lastErrorCode: '3',
      loadCount: 2,
      showCount: 1,
      currentAdId: 'native-ad-unit',
    });

    const ads = await loadAdsModule();
    const debugState = await ads.refreshInterstitialDebugState();

    expect(nativeGetStateMock).toHaveBeenCalledTimes(1);
    expect(debugState.usingNativeAndroidBridge).toBe(true);
    expect(debugState.initialized).toBe(true);
    expect(debugState.adReady).toBe(false);
    expect(debugState.nativeLoadCount).toBe(2);
    expect(debugState.nativeShowCount).toBe(1);
    expect(debugState.currentAdId).toBe('native-ad-unit');
    expect(debugState.lastAdError).toBe('No fill');
    expect(debugState.lastAdErrorCode).toBe('3');
  });
});
