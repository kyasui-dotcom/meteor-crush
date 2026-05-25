import { Capacitor } from '@capacitor/core';
import { isAdFreeActive } from './storage';
import { NativeAndroidAdMob, type NativeInterstitialState } from './nativeAndroidAdMob';

const DEFAULT_ADMOB_APP_ID = 'ca-app-pub-9351947872274309~2751565349';
const DEFAULT_INTERSTITIAL_AD_ID = 'ca-app-pub-9351947872274309/6934352937';
const TEST_ADMOB_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_INTERSTITIAL_AD_ID = 'ca-app-pub-3940256099942544/1033173712';
export const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || 'ca-pub-3647558722400460';
const ADSENSE_GAME_OVER_SLOT_ID = process.env.NEXT_PUBLIC_ADSENSE_GAME_OVER_SLOT || process.env.NEXT_PUBLIC_ADSENSE_SLOT || '';
const LEGACY_TEST_MODE = process.env.NEXT_PUBLIC_ADMOB_TEST_MODE === 'true';
const USE_TEST_AD_UNITS = LEGACY_TEST_MODE || process.env.NEXT_PUBLIC_USE_TEST_AD_UNITS === 'true';
const AD_DEBUG_TOOLS = LEGACY_TEST_MODE || process.env.NEXT_PUBLIC_AD_DEBUG_TOOLS === 'true';
const USE_NATIVE_ANDROID_ADS = process.env.NEXT_PUBLIC_USE_NATIVE_ANDROID_ADS === 'true';
const ADMOB_APP_ID = process.env.NEXT_PUBLIC_ADMOB_APP_ID
  || (USE_TEST_AD_UNITS ? TEST_ADMOB_APP_ID : DEFAULT_ADMOB_APP_ID);
const INTERSTITIAL_AD_ID = process.env.NEXT_PUBLIC_INTERSTITIAL_AD_ID
  || (USE_TEST_AD_UNITS ? TEST_INTERSTITIAL_AD_ID : DEFAULT_INTERSTITIAL_AD_ID);
const AD_FREE_PLAYS_PER_SESSION = 2;
const DEBUG_HISTORY_LIMIT = 8;

type AdMobModule = typeof import('@capacitor-community/admob');
type InterstitialState = 'idle' | 'loading' | 'ready' | 'show_requested' | 'showing' | 'disabled';
type AdDecisionStage = 'initialize' | 'prepare' | 'show';
type AdDecisionOutcome = 'started' | 'ready' | 'success' | 'skipped' | 'failed' | 'cancelled';

export type ShowInterstitialOptions = {
  shouldShow?: () => boolean;
};

export type WebGameOverAdState = {
  clientId: string;
  slotId: string | null;
  eligible: boolean;
  reason: 'eligible' | 'native-platform' | 'missing-slot' | 'ad-free-reward' | 'session-gate';
};

let admobModule: AdMobModule | null = null;
let admobPromise: Promise<AdMobModule['AdMob'] | null> | null = null;
let listenerSetupPromise: Promise<void> | null = null;
let preparePromise: Promise<boolean> | null = null;
let showPromise: Promise<boolean> | null = null;
let initialized = false;
let adReady = false;
let interstitialState: InterstitialState = 'idle';
let completedPlaysThisSession = 0;
let lastAdError: string | null = null;
let lastAdErrorCode: string | number | null = null;
let lastDecision = 'idle';
let lastDecisionDetail = 'No ad activity yet.';
let initializeAttempts = 0;
let prepareAttempts = 0;
let showAttempts = 0;
let decisionHistory: string[] = [];
let nativeLoadCount = 0;
let nativeShowCount = 0;
let currentAdId: string | null = null;

export function recordCompletedPlay() {
  completedPlaysThisSession += 1;
  return completedPlaysThisSession;
}

function shouldUseNativeAndroidAds() {
  return USE_NATIVE_ANDROID_ADS && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function isAdFreeGateActive() {
  return !AD_DEBUG_TOOLS && isAdFreeActive();
}

function isSessionGateActive() {
  return !AD_DEBUG_TOOLS && completedPlaysThisSession <= AD_FREE_PLAYS_PER_SESSION;
}

function resetInterstitialState(nextState: InterstitialState = 'idle') {
  adReady = false;
  interstitialState = nextState;
}

function formatAdError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return String(error);
}

function parseAdError(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    const code = error.code;
    if (typeof code === 'string' || typeof code === 'number') {
      return {
        code,
        message: formatAdError(error),
      };
    }
  }

  return {
    code: null,
    message: formatAdError(error),
  };
}

function canContinue(shouldShow?: () => boolean) {
  return shouldShow ? shouldShow() : true;
}

function noteDecision(stage: AdDecisionStage, outcome: AdDecisionOutcome, detail: string) {
  lastDecision = `${stage}:${outcome}`;
  lastDecisionDetail = detail;
  decisionHistory = [`${lastDecision} - ${detail}`, ...decisionHistory].slice(0, DEBUG_HISTORY_LIMIT);
}

function mapNativeState(state?: string): InterstitialState {
  switch (state) {
    case 'loading':
      return 'loading';
    case 'ready':
      return 'ready';
    case 'show_requested':
      return 'show_requested';
    case 'showing':
      return 'showing';
    case 'disabled':
      return 'disabled';
    default:
      return 'idle';
  }
}

function syncNativeState(result?: NativeInterstitialState | null) {
  if (!result) return;

  if (typeof result.initialized === 'boolean') {
    initialized = result.initialized;
  }
  if (typeof result.ready === 'boolean') {
    adReady = result.ready;
  }
  if (typeof result.state === 'string') {
    interstitialState = mapNativeState(result.state);
  }
  if (Object.prototype.hasOwnProperty.call(result, 'lastError')) {
    lastAdError = result.lastError ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(result, 'lastErrorCode')) {
    lastAdErrorCode = result.lastErrorCode ?? null;
  }
  if (typeof result.loadCount === 'number') {
    nativeLoadCount = result.loadCount;
  }
  if (typeof result.showCount === 'number') {
    nativeShowCount = result.showCount;
  }
  if (Object.prototype.hasOwnProperty.call(result, 'currentAdId')) {
    currentAdId = result.currentAdId ?? null;
  }
}

async function ensureInterstitialListeners(module: AdMobModule) {
  if (listenerSetupPromise) {
    await listenerSetupPromise;
    return;
  }

  listenerSetupPromise = (async () => {
    const { AdMob, InterstitialAdPluginEvents } = module;

    await AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
      initialized = true;
      adReady = true;
      interstitialState = 'ready';
      lastAdError = null;
      lastAdErrorCode = null;
      noteDecision('prepare', 'success', 'Interstitial loaded and is ready to show.');
    });

    await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (error) => {
      resetInterstitialState('idle');
      lastAdError = `${error.code}: ${error.message}`;
      lastAdErrorCode = error.code;
      noteDecision('prepare', 'failed', `Interstitial failed to load: ${error.code}: ${error.message}`);
    });

    await AdMob.addListener(InterstitialAdPluginEvents.Showed, () => {
      adReady = false;
      interstitialState = 'showing';
      lastAdError = null;
      lastAdErrorCode = null;
      noteDecision('show', 'success', 'Interstitial is now visible.');
    });

    await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (error) => {
      resetInterstitialState('idle');
      lastAdError = `${error.code}: ${error.message}`;
      lastAdErrorCode = error.code;
      noteDecision('show', 'failed', `Interstitial failed to show: ${error.code}: ${error.message}`);
      void prepareInterstitial();
    });

    await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
      resetInterstitialState('idle');
      noteDecision('show', 'success', 'Interstitial was dismissed.');
      void prepareInterstitial();
    });
  })();

  try {
    await listenerSetupPromise;
  } catch (error) {
    listenerSetupPromise = null;
    throw error;
  }
}

async function getCommunityAdMob() {
  if (!Capacitor.isNativePlatform()) return null;
  if (admobModule) {
    await ensureInterstitialListeners(admobModule);
    return admobModule.AdMob;
  }

  if (!admobPromise) {
    admobPromise = (async () => {
      const module = await import('@capacitor-community/admob');
      admobModule = module;
      await module.AdMob.initialize({
        initializeForTesting: USE_TEST_AD_UNITS,
      });
      await ensureInterstitialListeners(module);
      initialized = true;
      return module.AdMob;
    })();
  }

  try {
    return await admobPromise;
  } catch (error) {
    const parsed = parseAdError(error);
    admobPromise = null;
    admobModule = null;
    resetInterstitialState('idle');
    lastAdError = parsed.message;
    lastAdErrorCode = parsed.code;
    noteDecision('initialize', 'failed', `AdMob initialize failed: ${parsed.message}`);
    console.warn('AdMob initialize failed:', error);
    return null;
  }
}

async function refreshNativeState() {
  if (!shouldUseNativeAndroidAds()) {
    return getInterstitialDebugState();
  }

  try {
    const result = await NativeAndroidAdMob.getState();
    syncNativeState(result);
  } catch (error) {
    const parsed = parseAdError(error);
    lastAdError = parsed.message;
    lastAdErrorCode = parsed.code;
    noteDecision('show', 'failed', `Native bridge state refresh failed: ${parsed.message}`);
  }

  return getInterstitialDebugState();
}

export async function refreshInterstitialDebugState() {
  return refreshNativeState();
}

export async function initializeAds() {
  const nativePlatform = Capacitor.isNativePlatform();
  initializeAttempts += 1;
  noteDecision(
    'initialize',
    'started',
    shouldUseNativeAndroidAds()
      ? 'Initializing Android ad bridge.'
      : USE_TEST_AD_UNITS
        ? 'Initializing AdMob with test ad units.'
        : 'Initializing AdMob.',
  );

  if (shouldUseNativeAndroidAds()) {
    try {
      const result = await NativeAndroidAdMob.initialize({ isTesting: USE_TEST_AD_UNITS });
      syncNativeState(result);
      if (result.initialized) {
        initialized = true;
        lastAdError = null;
        lastAdErrorCode = null;
        noteDecision('initialize', 'success', 'Android ad bridge initialized successfully.');
        return true;
      }
      noteDecision('initialize', 'failed', result.lastError || 'Android ad bridge failed to initialize.');
      return false;
    } catch (error) {
      const parsed = parseAdError(error);
      lastAdError = parsed.message;
      lastAdErrorCode = parsed.code;
      noteDecision('initialize', 'failed', `Android ad bridge initialize failed: ${parsed.message}`);
      return false;
    }
  }

  const AdMob = await getCommunityAdMob();
  if (!AdMob) {
    if (!nativePlatform) {
      noteDecision('initialize', 'skipped', 'Interstitials only work on native Android/iOS builds.');
    }
    return false;
  }
  lastAdError = null;
  lastAdErrorCode = null;
  noteDecision('initialize', 'success', 'AdMob initialized successfully.');
  return true;
}

export async function prepareInterstitial() {
  if (isAdFreeGateActive()) {
    resetInterstitialState('disabled');
    noteDecision('prepare', 'skipped', 'Ad-free reward is active, so interstitial loading is disabled.');
    return false;
  }

  if (shouldUseNativeAndroidAds()) {
    if (adReady) {
      noteDecision('prepare', 'ready', 'Android native interstitial was already prepared.');
      return true;
    }
    if (interstitialState === 'loading' && preparePromise) {
      noteDecision('prepare', 'skipped', 'Android native interstitial load is already in progress.');
      return preparePromise;
    }

    prepareAttempts += 1;
    interstitialState = 'loading';
    lastAdError = null;
    lastAdErrorCode = null;
    currentAdId = INTERSTITIAL_AD_ID;
    noteDecision('prepare', 'started', USE_TEST_AD_UNITS ? 'Preparing a native Android test interstitial.' : 'Preparing a native Android interstitial.');
    preparePromise = (async () => {
      try {
        const result = await NativeAndroidAdMob.prepareInterstitial({
          adId: INTERSTITIAL_AD_ID,
          isTesting: USE_TEST_AD_UNITS,
        });
        syncNativeState(result);
        if (result.ready) {
          noteDecision('prepare', 'success', 'Native Android interstitial loaded.');
          return true;
        }
        noteDecision('prepare', 'failed', result.lastError || result.detail || 'Native Android interstitial failed to load.');
        return false;
      } catch (error) {
        const parsed = parseAdError(error);
        resetInterstitialState('idle');
        lastAdError = parsed.message;
        lastAdErrorCode = parsed.code;
        noteDecision('prepare', 'failed', `Native Android interstitial prepare failed: ${parsed.message}`);
        return false;
      } finally {
        preparePromise = null;
      }
    })();

    return preparePromise;
  }

  const AdMob = await getCommunityAdMob();
  if (!AdMob) {
    if (!Capacitor.isNativePlatform()) {
      noteDecision('prepare', 'skipped', 'Not a native platform, so no interstitial can be prepared.');
    }
    return false;
  }
  if (adReady) {
    noteDecision('prepare', 'ready', 'Interstitial was already prepared.');
    return true;
  }
  if (interstitialState === 'loading' && preparePromise) {
    noteDecision('prepare', 'skipped', 'Interstitial load is already in progress.');
    return preparePromise;
  }

  prepareAttempts += 1;
  interstitialState = 'loading';
  lastAdError = null;
  lastAdErrorCode = null;
  currentAdId = INTERSTITIAL_AD_ID;
  noteDecision('prepare', 'started', USE_TEST_AD_UNITS ? 'Preparing a test interstitial.' : 'Preparing a live interstitial.');
  preparePromise = (async () => {
    try {
      await AdMob.prepareInterstitial({
        adId: INTERSTITIAL_AD_ID,
        isTesting: USE_TEST_AD_UNITS,
      });
      initialized = true;
      adReady = true;
      interstitialState = 'ready';
      noteDecision('prepare', 'success', 'Interstitial prepare call completed.');
      return true;
    } catch (error) {
      const parsed = parseAdError(error);
      resetInterstitialState('idle');
      lastAdError = parsed.message;
      lastAdErrorCode = parsed.code;
      noteDecision('prepare', 'failed', `Interstitial prepare failed: ${parsed.message}`);
      console.warn('Ad prepare failed:', error);
      return false;
    } finally {
      preparePromise = null;
    }
  })();

  return preparePromise;
}

export async function showInterstitial(options: ShowInterstitialOptions = {}) {
  if (isAdFreeGateActive()) {
    resetInterstitialState('disabled');
    noteDecision('show', 'skipped', 'Ad-free reward is active, so the interstitial was skipped.');
    return false;
  }

  if (isSessionGateActive()) {
    noteDecision('show', 'skipped', `Session gate active: ${completedPlaysThisSession}/${AD_FREE_PLAYS_PER_SESSION} completed plays.`);
    void prepareInterstitial();
    return false;
  }

  if (!canContinue(options.shouldShow)) {
    noteDecision('show', 'cancelled', 'Caller guard returned false before showing the interstitial.');
    void prepareInterstitial();
    return false;
  }

  if (showPromise) {
    noteDecision('show', 'skipped', 'Another interstitial show request is already running.');
    return showPromise;
  }

  showAttempts += 1;
  noteDecision('show', 'started', shouldUseNativeAndroidAds() ? 'Attempting to show native Android interstitial.' : 'Attempting to show an interstitial.');
  showPromise = (async () => {
    try {
      const ready = adReady || await prepareInterstitial();
      if (!ready) {
        noteDecision('show', 'failed', 'Interstitial was not ready after preparing.');
        return false;
      }
      if (!canContinue(options.shouldShow)) {
        noteDecision('show', 'cancelled', 'Caller guard returned false after the interstitial became ready.');
        return false;
      }

      if (shouldUseNativeAndroidAds()) {
        const result = await NativeAndroidAdMob.showInterstitial();
        syncNativeState(result);
        if (result.shown) {
          interstitialState = 'show_requested';
          adReady = false;
          noteDecision('show', 'success', result.detail || 'Native Android show request accepted.');
          return true;
        }
        noteDecision('show', 'failed', result.lastError || result.detail || 'Native Android show request failed.');
        return false;
      }

      const AdMob = await getCommunityAdMob();
      if (!AdMob) {
        if (!Capacitor.isNativePlatform()) {
          noteDecision('show', 'skipped', 'Not a native platform, so the interstitial cannot be shown.');
        }
        return false;
      }

      resetInterstitialState('showing');
      await AdMob.showInterstitial();
      noteDecision('show', 'success', 'showInterstitial call completed.');
      return true;
    } catch (error) {
      const parsed = parseAdError(error);
      resetInterstitialState('idle');
      lastAdError = parsed.message;
      lastAdErrorCode = parsed.code;
      noteDecision('show', 'failed', `Interstitial show failed: ${parsed.message}`);
      console.warn('Ad show failed:', error);
      void prepareInterstitial();
      return false;
    } finally {
      showPromise = null;
    }
  })();

  return showPromise;
}

export function getInterstitialDebugState() {
  return {
    testMode: USE_TEST_AD_UNITS,
    debugToolsEnabled: AD_DEBUG_TOOLS,
    usingNativeAndroidBridge: shouldUseNativeAndroidAds(),
    nativePlatform: Capacitor.isNativePlatform(),
    initialized,
    appId: ADMOB_APP_ID,
    interstitialAdId: INTERSTITIAL_AD_ID,
    currentAdId,
    sessionGateBypassed: AD_DEBUG_TOOLS,
    adFreeGateBypassed: AD_DEBUG_TOOLS,
    adFreePlaysPerSession: AD_FREE_PLAYS_PER_SESSION,
    initializeAttempts,
    prepareAttempts,
    showAttempts,
    nativeLoadCount,
    nativeShowCount,
    adReady,
    interstitialState,
    completedPlaysThisSession,
    lastDecision,
    lastDecisionDetail,
    lastAdError,
    lastAdErrorCode,
    decisionHistory,
  };
}

export function getWebGameOverAdState(): WebGameOverAdState {
  if (Capacitor.isNativePlatform()) {
    return {
      clientId: ADSENSE_CLIENT_ID,
      slotId: ADSENSE_GAME_OVER_SLOT_ID || null,
      eligible: false,
      reason: 'native-platform',
    };
  }

  if (!ADSENSE_GAME_OVER_SLOT_ID) {
    return {
      clientId: ADSENSE_CLIENT_ID,
      slotId: null,
      eligible: false,
      reason: 'missing-slot',
    };
  }

  if (isAdFreeGateActive()) {
    return {
      clientId: ADSENSE_CLIENT_ID,
      slotId: ADSENSE_GAME_OVER_SLOT_ID,
      eligible: false,
      reason: 'ad-free-reward',
    };
  }

  if (isSessionGateActive()) {
    return {
      clientId: ADSENSE_CLIENT_ID,
      slotId: ADSENSE_GAME_OVER_SLOT_ID,
      eligible: false,
      reason: 'session-gate',
    };
  }

  return {
    clientId: ADSENSE_CLIENT_ID,
    slotId: ADSENSE_GAME_OVER_SLOT_ID,
    eligible: true,
    reason: 'eligible',
  };
}
