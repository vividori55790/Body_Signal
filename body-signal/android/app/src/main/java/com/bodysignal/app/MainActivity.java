package com.bodysignal.app;

import android.content.res.Configuration;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SecureAuthPlugin.class);
        super.onCreate(savedInstanceState);
        // Prevent Android App Switcher thumbnail capture and unauthorized screenshots
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
        applyFontScale();
    }

    @Override
    public void onResume() {
        super.onResume();
        applyFontScale();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyFontScale();
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

