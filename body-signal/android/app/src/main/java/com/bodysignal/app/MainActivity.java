package com.bodysignal.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.assist.AssistContent;
import android.content.Intent;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private Object screenCaptureCallback;
    private boolean securityBlocked = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SecureAuthPlugin.class);
        super.onCreate(savedInstanceState);
        if (!BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(false);
        }
        applyScreenSecurity();
        applyFontScale();
        enforceDeviceIntegrity();
    }

    @Override
    public void onStart() {
        super.onStart();
        if (Build.VERSION.SDK_INT >= 34) {
            Activity.ScreenCaptureCallback callback = () -> runOnUiThread(() -> {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('bignal:screen-capture-attempt'));",
                        null
                    );
                }
            });
            screenCaptureCallback = callback;
            registerScreenCaptureCallback(getMainExecutor(), callback);
        }
    }

    @Override
    public void onStop() {
        if (Build.VERSION.SDK_INT >= 34 && screenCaptureCallback instanceof Activity.ScreenCaptureCallback) {
            try {
                unregisterScreenCaptureCallback((Activity.ScreenCaptureCallback) screenCaptureCallback);
            } catch (Exception ignored) {
            }
            screenCaptureCallback = null;
        }
        super.onStop();
    }

    @Override
    public void onResume() {
        super.onResume();
        applyScreenSecurity();
        applyFontScale();
        enforceDeviceIntegrity();
    }

    @Override
    public void onDestroy() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().clearCache(true);
            getBridge().getWebView().clearFormData();
        }
        super.onDestroy();
    }

    private void enforceDeviceIntegrity() {
        SecurityCheck.Result integrity = SecurityCheck.assessDevice(this);
        if (!integrity.secure && !securityBlocked) {
            securityBlocked = true;
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().stopLoading();
                getBridge().getWebView().loadUrl("about:blank");
            }
            boolean isKo = java.util.Locale.getDefault().getLanguage().startsWith("ko");
            new AlertDialog.Builder(this)
                .setTitle(isKo ? "보안 위협 감지" : "Security Threat Detected")
                .setMessage(integrity.reason + (isKo
                    ? "\n\n민감한 의료 데이터 보호를 위해 앱을 종료합니다."
                    : "\n\nClosing the app to protect sensitive medical data."))
                .setCancelable(false)
                .setPositiveButton(isKo ? "앱 종료" : "Exit App", (dialog, which) -> finishAffinity())
                .show();
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyFontScale();
    }

    /**
     * Block Google Assistant / Gemini screen-context sharing and assist scraping of clinical records.
     */
    @Override
    public void onProvideAssistData(Bundle data) {
        if (data != null) {
            data.clear();
        }
    }

    @Override
    public void onProvideAssistContent(AssistContent outContent) {
        if (outContent != null) {
            outContent.setWebUri(null);
            outContent.setIntent(new Intent());
            outContent.setStructuredData("{\"restricted\":true}");
        }
        if (getBridge() != null && getBridge().getWebView() != null) {
            runOnUiThread(() -> getBridge().getWebView().evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('bignal:assist-blocked'));",
                null
            ));
        }
    }

    /**
     * Enforce FLAG_SECURE and disable Recents snapshots to block screenshots and screen-sharing.
     */
    private void applyScreenSecurity() {
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            setRecentsScreenshotEnabled(false);
        }
    }

    /**
     * Inherit Android OS fontScale accessibility setting into the Capacitor WebView textZoom.
     */
    private void applyFontScale() {
        if (getBridge() != null && getBridge().getWebView() != null && getBridge().getWebView().getSettings() != null) {
            float fontScale = getResources().getConfiguration().fontScale;
            getBridge().getWebView().getSettings().setTextZoom((int)(fontScale * 100));
        }
    }
}
