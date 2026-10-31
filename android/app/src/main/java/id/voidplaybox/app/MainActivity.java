package id.voidplaybox.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

public class MainActivity extends Activity {
    private static final int LOCATION_REQUEST = 10;
    private static final int BACKGROUND = Color.rgb(8, 12, 27);
    private final NavigationPolicy policy = new NavigationPolicy(BuildConfig.WEB_URL);
    private WebView web;
    private ProgressBar progress;
    private LinearLayout errorPanel;
    private TextView errorMessage;
    private boolean pageFailed;
    private GeolocationPermissions.Callback locationCallback;
    private String locationOrigin;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BACKGROUND);
        root.setFitsSystemWindows(true);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return insets;
            });
        }
        setContentView(root);

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(16), 0, dp(4), 0);
        TextView title = new TextView(this);
        title.setText(R.string.app_name);
        title.setTextSize(17);
        title.setTextColor(Color.WHITE);
        title.setTypeface(null, Typeface.BOLD);
        toolbar.addView(title, new LinearLayout.LayoutParams(0, dp(52), 1));
        title.setGravity(Gravity.CENTER_VERTICAL);
        Button menu = new Button(this);
        menu.setText("⋮");
        menu.setTextSize(24);
        menu.setTextColor(Color.WHITE);
        menu.setBackgroundColor(Color.TRANSPARENT);
        menu.setContentDescription("Menu aplikasi");
        menu.setOnClickListener(this::showMenu);
        toolbar.addView(menu, new LinearLayout.LayoutParams(dp(52), dp(52)));
        root.addView(toolbar);

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        root.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));
        FrameLayout content = new FrameLayout(this);
        root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
        web = new WebView(this);
        web.setBackgroundColor(BACKGROUND);
        content.addView(web, new FrameLayout.LayoutParams(-1, -1));
        createErrorPanel(content);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return !policy.isInternal(request.getUrl().toString());
                String url = request.getUrl().toString();
                if (policy.isInternal(url)) return false;
                openExternal(url);
                return true;
            }

            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                finishLocationRequest(false);
                pageFailed = false;
                errorPanel.setVisibility(View.GONE);
                progress.setVisibility(View.VISIBLE);
            }

            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.INVISIBLE);
                CookieManager.getInstance().flush();
                if (!policy.isInternal(url) || pageFailed) return;
                // Google Identity is unsupported inside embedded WebViews. Keep email login usable.
                view.evaluateJavascript("(() => {const b=document.getElementById('googleSignInButton');"
                        + "if(b)b.style.display='none';"
                        + "const m=document.getElementById('googleAuthMessage');"
                        + "if(m && !document.getElementById('androidLoginHelp')){"
                        + "const h=document.createElement('p');h.id='androidLoginHelp';"
                        + "h.style.cssText='font-size:12px;line-height:1.6;color:#b5b5cc;margin-top:12px';"
                        + "h.textContent='Di aplikasi, gunakan email dan password. Untuk masuk dengan Google, pilih Buka di browser pada menu ⋮. Sesi browser terpisah dari aplikasi.';"
                        + "m.insertAdjacentElement('afterend',h);m.style.display='none';}})()", null);
            }

            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError("Periksa koneksi internet, lalu coba lagi.");
            }

            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) showError("Server sedang tidak tersedia (" + response.getStatusCode() + "). Coba lagi sebentar.");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) { progress.setProgress(value); }

            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                finishLocationRequest(false);
                if (!policy.isInternal(origin) || !policy.isInternal(web.getUrl())) {
                    callback.invoke(origin, false, false);
                    return;
                }
                locationOrigin = origin;
                locationCallback = callback;
                if (hasLocationPermission()) { finishLocationRequest(true); return; }
                new AlertDialog.Builder(MainActivity.this)
                        .setTitle("Lokasi untuk pengiriman")
                        .setMessage("Playbox memakai lokasi saat kamu menekan Gunakan lokasi saya untuk menentukan titik pengiriman. Lokasi tidak dilacak di latar belakang.")
                        .setPositiveButton("Lanjutkan", (dialog, which) -> {
                            if (locationCallback != null) requestPermissions(new String[] {
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                    Manifest.permission.ACCESS_COARSE_LOCATION }, LOCATION_REQUEST);
                        })
                        .setNegativeButton("Batal", (dialog, which) -> finishLocationRequest(false))
                        .setOnCancelListener(dialog -> finishLocationRequest(false)).show();
            }

            @Override public void onGeolocationPermissionsHidePrompt() { finishLocationRequest(false); }

            @Override public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                if (!isUserGesture) return false;
                WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView child, WebResourceRequest request) {
                        String url = request.getUrl().toString();
                        if (policy.isInternal(url)) web.loadUrl(url); else openExternal(url);
                        child.post(child::destroy);
                        return true;
                    }
                });
                ((WebView.WebViewTransport) resultMsg.obj).setWebView(popup);
                resultMsg.sendToTarget();
                return true;
            }
        });

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
        }
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(BuildConfig.WEB_URL);
        }
    }

    private void showMenu(View anchor) {
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenu().add(0, 1, 0, "Muat ulang");
        menu.getMenu().add(0, 2, 1, "Buka di browser (termasuk Google)");
        menu.getMenu().add(0, 3, 2, "Tentang aplikasi");
        menu.setOnMenuItemClickListener(item -> {
            if (item.getItemId() == 1) reload();
            if (item.getItemId() == 2) openExternal(BuildConfig.WEB_URL);
            if (item.getItemId() == 3) new AlertDialog.Builder(this).setTitle("Void Play Box " + BuildConfig.VERSION_NAME)
                    .setMessage("Sewa PS4 offline di Banda Aceh.\n\nAplikasi membutuhkan internet dan mengikuti pembaruan web Playbox. Login aplikasi menggunakan email dan password.\n\nLogin Google tersedia di browser; sesi browser terpisah. Notifikasi chat di dalam aplikasi aktif saat aplikasi dibuka. Belum ada push notification saat aplikasi ditutup.")
                    .setPositiveButton("Tutup", null).show();
            return true;
        });
        menu.show();
    }

    private void createErrorPanel(FrameLayout content) {
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setGravity(Gravity.CENTER);
        errorPanel.setPadding(dp(28), dp(28), dp(28), dp(28));
        errorPanel.setBackgroundColor(BACKGROUND);
        TextView heading = new TextView(this);
        heading.setText(R.string.connection_heading);
        heading.setTextSize(21);
        heading.setTextColor(Color.WHITE);
        heading.setGravity(Gravity.CENTER);
        errorPanel.addView(heading);
        errorMessage = new TextView(this);
        errorMessage.setTextColor(Color.LTGRAY);
        errorMessage.setTextSize(15);
        errorMessage.setGravity(Gravity.CENTER);
        errorMessage.setPadding(0, dp(14), 0, dp(20));
        errorPanel.addView(errorMessage);
        Button retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setOnClickListener(view -> reload());
        errorPanel.addView(retry);
        errorPanel.setVisibility(View.GONE);
        content.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1));
    }

    private void showError(String message) {
        pageFailed = true;
        progress.setVisibility(View.INVISIBLE);
        errorMessage.setText(message);
        errorPanel.setVisibility(View.VISIBLE);
    }

    private void reload() {
        errorPanel.setVisibility(View.GONE);
        if (policy.isInternal(web.getUrl())) web.reload(); else web.loadUrl(BuildConfig.WEB_URL);
    }

    private void openExternal(String url) {
        if (!policy.canOpenExternally(url)) {
            Toast.makeText(this, "Tautan ini tidak didukung.", Toast.LENGTH_SHORT).show();
            return;
        }
        try {
            Uri uri = Uri.parse(url);
            Intent intent = new Intent("tel".equalsIgnoreCase(uri.getScheme()) ? Intent.ACTION_DIAL : Intent.ACTION_VIEW, uri);
            startActivity(intent);
        } catch (ActivityNotFoundException | SecurityException ex) {
            Toast.makeText(this, "Tidak ada aplikasi untuk membuka tautan ini.", Toast.LENGTH_LONG).show();
        }
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void finishLocationRequest(boolean granted) {
        GeolocationPermissions.Callback callback = locationCallback;
        String origin = locationOrigin;
        locationCallback = null;
        locationOrigin = null;
        if (callback != null) callback.invoke(origin, granted, false);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_REQUEST) finishLocationRequest(hasLocationPermission()
                && policy.isInternal(web.getUrl()));
    }

    private void goBack() { if (web.canGoBack()) web.goBack(); else finish(); }
    @SuppressWarnings("deprecation")
    @SuppressLint("GestureBackNavigation") // API 33+ uses OnBackInvokedDispatcher registered above.
    @Override public void onBackPressed() { goBack(); }
    @Override protected void onSaveInstanceState(Bundle outState) {
        web.saveState(outState);
        super.onSaveInstanceState(outState);
    }
    @Override protected void onPause() { web.onPause(); CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        finishLocationRequest(false);
        web.stopLoading();
        ((android.view.ViewGroup) web.getParent()).removeView(web);
        web.destroy();
        super.onDestroy();
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
