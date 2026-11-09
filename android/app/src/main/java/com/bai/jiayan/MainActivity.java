package com.bai.jiayan;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.io.OutputStream;

/** Online H5 shell. App data and the existing PWA update flow remain on the website. */
public class MainActivity extends Activity {
    private static final int PICK_FILE = 10, SAVE_IMAGE = 11;
    private WebView web;
    private ProgressBar progress;
    private LinearLayout errorPanel;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingImage;
    private boolean pageFailed;
    private boolean pageReady;
    private android.window.SplashScreenView startupView;
    private long lastBack;

    private boolean trusted(Uri uri) {
        Uri home = Uri.parse(BuildConfig.WEB_URL);
        return "https".equals(uri.getScheme()) && home.getHost().equals(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443)
            && uri.getPath() != null && uri.getPath().startsWith(home.getPath());
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (android.os.Build.VERSION.SDK_INT >= 31) {
            getSplashScreen().setOnExitAnimationListener(view -> {
                startupView = view;
                if (pageReady || pageFailed) releaseStartup();
            });
        }
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundResource(com.bai.jiayan.R.drawable.startup_background);
        // Apply the system bars as padding, including on edge-to-edge Android versions.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progress, new LinearLayout.LayoutParams(-1, 6));
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setPadding(40, 60, 40, 40);
        TextView message = new TextView(this);
        message.setText("暂时无法打开家宴，请检查网络后重试。");
        message.setTextSize(18);
        errorPanel.addView(message);
        Button retry = new Button(this);
        retry.setText("重新加载");
        retry.setOnClickListener(v -> web.loadUrl(BuildConfig.WEB_URL));
        errorPanel.addView(retry);
        errorPanel.setVisibility(View.GONE);
        root.addView(errorPanel);
        web = new WebView(this);
        web.setVisibility(View.INVISIBLE);
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        root.requestApplyInsets();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " JiayanAndroid/1.0");
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.addJavascriptInterface(new ImageExport(), "JiayanImageExport");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return !trusted(request.getUrl());
                if (trusted(request.getUrl())) return false;
                String scheme = request.getUrl().getScheme();
                if ("https".equals(scheme) || "http".equals(scheme) || "mailto".equals(scheme) || "tel".equals(scheme)) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); }
                    catch (ActivityNotFoundException e) { toast("没有可打开此链接的应用"); }
                }
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, Bitmap icon) {
                pageFailed = false;
                errorPanel.setVisibility(View.GONE);
                progress.setVisibility(pageReady ? View.VISIBLE : View.GONE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) showError();
            }
            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                if (pageFailed || !trusted(Uri.parse(url))) return;
                // WebView doesn't implement the browser's blob download UI. Export only images,
                // with an explicit system save picker; no filesystem or auth bridge is exposed.
                view.evaluateJavascript("(function(){if(window.__jiayanExport)return;window.__jiayanExport=true;"
                    + "document.documentElement.classList.add('is-standalone');"
                    + "document.addEventListener('click',function(e){var a=e.target.closest('a[download]');"
                    + "if(!a||!a.href)return;e.preventDefault();"
                    + "fetch(a.href).then(r=>r.blob()).then(b=>{if(b.size>20*1024*1024)throw Error();"
                    + "var reader=new FileReader();reader.onload=()=>JiayanImageExport.save(reader.result);reader.readAsDataURL(b);"
                    + "}).catch(()=>alert('图片保存失败，请重试'));},true);})()", null);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) { progress.setProgress(value); }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    Intent picker = params.createIntent();
                    picker.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(picker, PICK_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback.onReceiveValue(null);
                    fileCallback = null;
                    toast("无法打开文件选择器");
                }
                return true;
            }
        });
        web.setDownloadListener((url, agent, disposition, mime, size) -> toast("请使用图片预览中的下载按钮保存"));
        if (state == null || web.restoreState(state) == null) web.loadUrl(BuildConfig.WEB_URL);
        // Broken or outdated H5 must never leave the system splash blocking retry controls.
        root.postDelayed(() -> { if (!pageReady && !pageFailed) showError(); }, 20000);
    }

    private void releaseStartup() {
        if (android.os.Build.VERSION.SDK_INT >= 31 && startupView != null) {
            startupView.remove();
            startupView = null;
        }
    }
    private void showError() {
        pageFailed = true;
        releaseStartup();
        progress.setVisibility(View.GONE);
        errorPanel.setVisibility(View.VISIBLE);
    }
    private void toast(String text) { Toast.makeText(this, text, Toast.LENGTH_SHORT).show(); }

    private class ImageExport {
        @JavascriptInterface public void ready() {
            runOnUiThread(() -> {
                if (isFinishing() || pageFailed || !trusted(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) return;
                pageReady = true;
                web.setVisibility(View.VISIBLE);
                releaseStartup();
            });
        }
        @JavascriptInterface public void save(String dataUrl) {
            if (dataUrl == null || dataUrl.length() > 28 * 1024 * 1024) return;
            int comma = dataUrl.indexOf(',');
            if (comma < 0) return;
            String header = dataUrl.substring(0, comma);
            String mime, extension;
            switch (header) {
                case "data:image/png;base64": mime = "image/png"; extension = ".png"; break;
                case "data:image/jpeg;base64": mime = "image/jpeg"; extension = ".jpg"; break;
                case "data:image/webp;base64": mime = "image/webp"; extension = ".webp"; break;
                default: return;
            }
            final byte[] bytes;
            try { bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT); }
            catch (IllegalArgumentException e) { return; }
            if (bytes.length > 20 * 1024 * 1024) return;
            runOnUiThread(() -> {
                if (isFinishing() || !trusted(Uri.parse(web.getUrl() == null ? "" : web.getUrl())) || pendingImage != null) return;
                pendingImage = bytes;
                Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                save.addCategory(Intent.CATEGORY_OPENABLE);
                save.setType(mime);
                save.putExtra(Intent.EXTRA_TITLE, "家宴-" + System.currentTimeMillis() + extension);
                try { startActivityForResult(save, SAVE_IMAGE); }
                catch (ActivityNotFoundException e) { pendingImage = null; toast("无法打开保存窗口"); }
            });
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        }
        if (request == SAVE_IMAGE) {
            byte[] bytes = pendingImage;
            pendingImage = null;
            if (result != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
            Uri target = data.getData();
            new Thread(() -> {
                try (OutputStream out = getContentResolver().openOutputStream(target)) {
                    if (out == null) throw new java.io.IOException();
                    out.write(bytes);
                    runOnUiThread(() -> toast("图片已保存"));
                } catch (Exception e) { runOnUiThread(() -> toast("保存失败，请重试")); }
            }).start();
        }
    }
    @Override public void onBackPressed() {
        if (web.canGoBack()) { web.goBack(); return; }
        if (System.currentTimeMillis() - lastBack < 2000) { super.onBackPressed(); return; }
        lastBack = System.currentTimeMillis();
        toast("再按一次返回键退出家宴");
    }
    @Override protected void onSaveInstanceState(Bundle state) { web.saveState(state); super.onSaveInstanceState(state); }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            web.evaluateJavascript("navigator.serviceWorker&&navigator.serviceWorker.getRegistration().then(r=>r&&r.update()).catch(()=>{});", null);
        }
    }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        web.removeJavascriptInterface("JiayanImageExport");
        web.destroy();
        super.onDestroy();
    }
}
