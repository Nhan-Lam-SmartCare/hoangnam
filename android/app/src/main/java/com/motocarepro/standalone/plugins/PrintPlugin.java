package com.motocarepro.standalone.plugins;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PrintPlugin")
public class PrintPlugin extends Plugin {

    @PluginMethod
    public void printHtml(final PluginCall call) {
        final String htmlContent = call.getString("html");
        if (htmlContent == null || htmlContent.isEmpty()) {
            call.reject("HTML content is required");
            return;
        }

        getBridge().getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    // Create a WebView dynamically on the UI thread
                    WebView webView = new WebView(getContext());
                    webView.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageFinished(WebView view, String url) {
                            // Get PrintManager system service
                            PrintManager printManager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                            if (printManager != null) {
                                String jobName = "Motocare Document";
                                PrintDocumentAdapter printAdapter = view.createPrintDocumentAdapter(jobName);
                                printManager.print(jobName, printAdapter, new PrintAttributes.Builder().build());
                                JSObject result = new JSObject();
                                result.put("success", true);
                                call.resolve(result);
                            } else {
                                call.reject("PrintManager service not available");
                            }
                        }
                    });

                    // Load HTML content
                    webView.loadDataWithBaseURL("https://localhost", htmlContent, "text/html", "utf-8", null);
                } catch (Exception e) {
                    call.reject("Failed to trigger printing: " + e.getMessage());
                }
            }
        });
    }
}
