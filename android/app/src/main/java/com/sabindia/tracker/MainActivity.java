package com.sabindia.tracker;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Force the WebView to sit BELOW the system status bar on every SDK
        // level. Android 15 (API 35+) forces edge-to-edge for targetSdk>=35
        // and ignores android:fitsSystemWindows + android:statusBarColor, so
        // we opt back into the legacy "decor fits system windows" behavior.
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, true);

        // Explicit orange status bar (SAB accent). On API 35+ this is a no-op
        // when edge-to-edge is enforced; the setDecorFitsSystemWindows call
        // above restores the hand-over to the framework.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(0xFFD97757);
        }
    }
}
