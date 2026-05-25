package com.meteorcrush.app;

import android.app.Activity;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;

@CapacitorPlugin(name = "MeteorAdMob")
public class MeteorAdMobPlugin extends Plugin {
    private static final String TAG = "MeteorAdMob";

    private InterstitialAd interstitialAd;
    private boolean initialized = false;
    private String state = "idle";
    private String lastError = null;
    private String lastErrorCode = null;
    private int loadCount = 0;
    private int showCount = 0;
    private String currentAdId = null;

    @PluginMethod
    public void initialize(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            resolveFailure(call, "NO_ACTIVITY", "Activity unavailable for Mobile Ads initialization.");
            return;
        }

        try {
            activity.runOnUiThread(() ->
                MobileAds.initialize(activity, initializationStatus -> {
                    initialized = true;
                    clearError();
                    if (interstitialAd == null) {
                        state = "idle";
                    }
                    Log.d(TAG, "Mobile Ads initialized.");
                    JSObject response = buildStateResponse();
                    response.put("initializedNow", true);
                    call.resolve(response);
                })
            );
        } catch (Exception ex) {
            resolveFailure(call, "INIT_EXCEPTION", ex.getMessage() == null ? "Failed to initialize Mobile Ads." : ex.getMessage());
        }
    }

    @PluginMethod
    public void prepareInterstitial(PluginCall call) {
        Activity activity = getActivity();
        String adId = call.getString("adId");

        if (activity == null) {
            resolveFailure(call, "NO_ACTIVITY", "Activity unavailable for interstitial loading.");
            return;
        }

        if (adId == null || adId.isBlank()) {
            resolveFailure(call, "MISSING_AD_UNIT", "Interstitial ad unit ID is missing.");
            return;
        }

        currentAdId = adId;
        loadCount += 1;
        state = "loading";
        clearError();

        try {
            activity.runOnUiThread(() -> InterstitialAd.load(
                activity,
                adId,
                new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdFailedToLoad(LoadAdError adError) {
                        interstitialAd = null;
                        state = "idle";
                        setError(String.valueOf(adError.getCode()), adError.getMessage());
                        Log.d(TAG, "Interstitial failed to load: " + adError);
                        JSObject response = buildStateResponse();
                        response.put("ready", false);
                        call.resolve(response);
                    }

                    @Override
                    public void onAdLoaded(InterstitialAd loadedAd) {
                        interstitialAd = loadedAd;
                        initialized = true;
                        state = "ready";
                        clearError();
                        attachFullScreenCallback(loadedAd);
                        Log.d(TAG, "Interstitial loaded.");
                        JSObject response = buildStateResponse();
                        response.put("ready", true);
                        call.resolve(response);
                    }
                }
            ));
        } catch (Exception ex) {
            resolveFailure(call, "LOAD_EXCEPTION", ex.getMessage() == null ? "Failed to load interstitial." : ex.getMessage());
        }
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        Activity activity = getActivity();
        showCount += 1;

        if (activity == null) {
            resolveFailure(call, "NO_ACTIVITY", "Activity unavailable for showing the interstitial.");
            return;
        }

        if (interstitialAd == null) {
            resolveFailure(call, "NOT_READY", "The interstitial ad wasn't ready yet.");
            return;
        }

        try {
            state = "show_requested";
            clearError();
            activity.runOnUiThread(() -> {
                try {
                    interstitialAd.show(activity);
                    Log.d(TAG, "Interstitial show requested.");
                    JSObject response = buildStateResponse();
                    response.put("shown", true);
                    response.put("detail", "Interstitial show() was called.");
                    call.resolve(response);
                } catch (Exception ex) {
                    resolveFailure(call, "SHOW_EXCEPTION", ex.getMessage() == null ? "Failed to show interstitial." : ex.getMessage());
                }
            });
        } catch (Exception ex) {
            resolveFailure(call, "SHOW_EXCEPTION", ex.getMessage() == null ? "Failed to show interstitial." : ex.getMessage());
        }
    }

    @PluginMethod
    public void getState(PluginCall call) {
        call.resolve(buildStateResponse());
    }

    private void attachFullScreenCallback(InterstitialAd loadedAd) {
        loadedAd.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdClicked() {
                Log.d(TAG, "Interstitial clicked.");
            }

            @Override
            public void onAdDismissedFullScreenContent() {
                Log.d(TAG, "Interstitial dismissed.");
                interstitialAd = null;
                state = "idle";
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError adError) {
                Log.d(TAG, "Interstitial failed to show: " + adError);
                interstitialAd = null;
                state = "idle";
                setError(String.valueOf(adError.getCode()), adError.getMessage());
            }

            @Override
            public void onAdImpression() {
                Log.d(TAG, "Interstitial impression recorded.");
            }

            @Override
            public void onAdShowedFullScreenContent() {
                Log.d(TAG, "Interstitial showed fullscreen content.");
                state = "showing";
                clearError();
            }
        });
    }

    private void resolveFailure(PluginCall call, String code, String message) {
        state = "idle";
        setError(code, message);
        Log.d(TAG, code + ": " + message);
        JSObject response = buildStateResponse();
        response.put("shown", false);
        response.put("ready", interstitialAd != null);
        response.put("detail", message);
        call.resolve(response);
    }

    private void clearError() {
        lastError = null;
        lastErrorCode = null;
    }

    private void setError(String code, String message) {
        lastErrorCode = code;
        lastError = message;
    }

    private JSObject buildStateResponse() {
        JSObject response = new JSObject();
        response.put("initialized", initialized);
        response.put("ready", interstitialAd != null);
        response.put("state", state);
        response.put("lastError", lastError);
        response.put("lastErrorCode", lastErrorCode);
        response.put("loadCount", loadCount);
        response.put("showCount", showCount);
        response.put("currentAdId", currentAdId);
        return response;
    }
}
