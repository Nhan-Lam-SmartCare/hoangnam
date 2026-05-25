package com.motocarepro.standalone;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.motocarepro.standalone.plugins.BluetoothPrintPlugin;
import com.motocarepro.standalone.plugins.PrintPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register custom Capacitor Plugins manually to ensure absolute reliability
        registerPlugin(PrintPlugin.class);
        registerPlugin(BluetoothPrintPlugin.class);
    }
}
