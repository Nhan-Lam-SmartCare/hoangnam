package com.motocarepro.standalone.plugins;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.OutputStream;
import java.text.Normalizer;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import android.Manifest;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "BluetoothPrintPlugin",
    permissions = {
        @Permission(
            strings = {
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN
            },
            alias = "bluetooth"
        ),
        @Permission(
            strings = {
                "android.permission.BLUETOOTH_SCAN",
                "android.permission.BLUETOOTH_CONNECT"
            },
            alias = "bluetooth_s"
        ),
        @Permission(
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION
            },
            alias = "location"
        )
    }
)
public class BluetoothPrintPlugin extends Plugin {

    private static final String TAG = "BluetoothPrintPlugin";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothSocket socket;
    private OutputStream outputStream;
    private String connectedAddress = null;

    @Override
    public void load() {
        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
    }

    @PluginMethod
    public void getPairedDevices(PluginCall call) {
        if (bluetoothAdapter == null) {
            call.reject("Bluetooth not supported on this device");
            return;
        }

        if (!bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth is disabled");
            return;
        }

        try {
            Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
            JSArray devicesArray = new JSArray();

            for (BluetoothDevice device : pairedDevices) {
                JSObject deviceObj = new JSObject();
                deviceObj.put("name", device.getName());
                deviceObj.put("address", device.getAddress());
                devicesArray.put(deviceObj);
            }

            JSObject result = new JSObject();
            result.put("devices", devicesArray);
            call.resolve(result);
        } catch (SecurityException se) {
            call.reject("Missing Bluetooth permissions: " + se.getMessage());
        } catch (Exception e) {
            call.reject("Failed to get paired devices: " + e.getMessage());
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("Device MAC address is required");
            return;
        }

        if (bluetoothAdapter == null) {
            call.reject("Bluetooth not supported on this device");
            return;
        }

        // Close existing connection if any
        disconnectDevice();

        try {
            BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            outputStream = socket.getOutputStream();
            connectedAddress = address;

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("connectedDevice", device.getName());
            call.resolve(result);
        } catch (SecurityException se) {
            call.reject("Missing Bluetooth permissions: " + se.getMessage());
        } catch (IOException e) {
            disconnectDevice();
            call.reject("Failed to connect to device: " + e.getMessage());
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        disconnectDevice();
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text");
        if (text == null) {
            call.reject("Text to print is required");
            return;
        }

        if (socket == null || outputStream == null) {
            call.reject("No connected printer. Please connect first.");
            return;
        }

        try {
            // Strip accents for thermal printers
            String cleanText = removeAccent(text);
            
            // Standard ESC/POS reset code
            outputStream.write(new byte[]{0x1B, 0x40}); // Initialize printer
            
            // Print clean text converted to standard CP437/ASCII bytes
            outputStream.write(cleanText.getBytes("US-ASCII"));
            
            // Feed paper and cut (or space)
            outputStream.write(new byte[]{0x0A, 0x0A, 0x0A, 0x0A}); // 4 line feeds
            outputStream.flush();

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (IOException e) {
            disconnectDevice();
            call.reject("Error printing text: " + e.getMessage());
        }
    }

    private void disconnectDevice() {
        try {
            if (outputStream != null) {
                outputStream.close();
                outputStream = null;
            }
            if (socket != null) {
                socket.close();
                socket = null;
            }
            connectedAddress = null;
        } catch (IOException e) {
            Log.e(TAG, "Error closing connection: " + e.getMessage());
        }
    }

    // Professional helper to strip accents from Vietnamese text
    private String removeAccent(String s) {
        if (s == null) return "";
        String temp = Normalizer.normalize(s, Normalizer.Form.NFD);
        Pattern pattern = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
        String clean = pattern.matcher(temp).replaceAll("")
                .replace('đ', 'd').replace('Đ', 'D')
                .replace('ơ', 'o').replace('Ơ', 'O')
                .replace('ư', 'u').replace('Ư', 'U');
        return clean;
    }
}
