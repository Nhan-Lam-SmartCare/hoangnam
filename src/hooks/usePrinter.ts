import { useState, useCallback } from 'react';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { showToast } from '../utils/toast';

export interface BluetoothDevice {
  name: string;
  address: string;
}

export interface BluetoothPrintPluginType {
  getPairedDevices(): Promise<{ devices: BluetoothDevice[] }>;
  connect(options: { address: string }): Promise<{ success: boolean; connectedDevice: string }>;
  disconnect(): Promise<{ success: boolean }>;
  printText(options: { text: string }): Promise<{ success: boolean }>;
  checkPermissions(): Promise<{ bluetooth: string; bluetooth_s: string; location: string }>;
  requestPermissions(): Promise<{ bluetooth: string; bluetooth_s: string; location: string }>;
}

export interface PrintPluginType {
  printHtml(options: { html: string }): Promise<{ success: boolean }>;
}

// Register plugins to bridge to native code
export const BluetoothPrint = registerPlugin<BluetoothPrintPluginType>('BluetoothPrintPlugin');
export const PrintPlugin = registerPlugin<PrintPluginType>('PrintPlugin');

export const usePrinter = () => {
  const [pairedDevices, setPairedDevices] = useState<BluetoothDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const isNative = Capacitor.isNativePlatform();

  // Scan and fetch paired Bluetooth devices
  const scanPairedDevices = useCallback(async () => {
    if (!isNative) return [];
    setIsLoadingDevices(true);
    try {
      // Check and request Bluetooth runtime permissions on Android 12+
      try {
        const permStatus = await BluetoothPrint.checkPermissions();
        if (permStatus.bluetooth !== 'granted' || permStatus.bluetooth_s !== 'granted') {
          await BluetoothPrint.requestPermissions();
        }
      } catch (permErr) {
        console.warn('Error checking/requesting bluetooth permissions:', permErr);
      }

      const result = await BluetoothPrint.getPairedDevices();
      setPairedDevices(result.devices || []);
      return result.devices || [];
    } catch (err) {
      console.error('Error fetching paired devices:', err);
      throw err;
    } finally {
      setIsLoadingDevices(false);
    }
  }, [isNative]);

  // Connect to a Bluetooth device by MAC address
  const connectBluetooth = useCallback(async (address: string) => {
    if (!isNative) return false;
    setIsConnecting(true);
    try {
      const result = await BluetoothPrint.connect({ address });
      if (result.success) {
        setConnectedDevice(result.connectedDevice);
        setConnectedAddress(address);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to connect to Bluetooth printer:', err);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [isNative]);

  // Disconnect current Bluetooth printer
  const disconnectBluetooth = useCallback(async () => {
    if (!isNative) return;
    try {
      await BluetoothPrint.disconnect();
      setConnectedDevice(null);
      setConnectedAddress(null);
    } catch (err) {
      console.error('Error disconnecting Bluetooth printer:', err);
    }
  }, [isNative]);

  // Print text via Bluetooth printer
  const printViaBluetooth = useCallback(async (text: string) => {
    if (!isNative) {
      showToast.warning('In Bluetooth chỉ hỗ trợ trên ứng dụng di động native');
      return false;
    }

    const savedAddress = localStorage.getItem('motocare_bt_address') || connectedAddress;
    if (!savedAddress) {
      showToast.error('Chưa kết nối máy in Bluetooth. Vui lòng vào "Cài đặt máy in di động" để chọn và kết nối máy in trước.');
      return false;
    }

    const printPromise = BluetoothPrint.printText({ text });

    showToast.promise(
      printPromise,
      {
        pending: 'Đang kết nối & truyền dữ liệu tới máy in Bluetooth...',
        success: 'Đã gửi lệnh in nhiệt Bluetooth thành công!',
        error: 'In Bluetooth thất bại. Vui lòng kiểm tra lại máy in.',
      }
    );

    try {
      const result = await printPromise;
      return result.success;
    } catch (err) {
      console.error('Error printing via Bluetooth:', err);
      return false;
    }
  }, [isNative]);

  // Print html via WiFi / System Print
  const printViaWiFi = useCallback(async (html: string) => {
    if (!isNative) {
      // Fallback on standard web: open print window
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        showToast.info('Đang chuẩn bị trang in...');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
        return true;
      }
      return false;
    }

    const printPromise = PrintPlugin.printHtml({ html });

    showToast.promise(
      printPromise,
      {
        pending: 'Đang khởi tạo dịch vụ in hệ thống...',
        success: 'Đã mở màn hình in thành công!',
        error: 'Chuẩn bị in thất bại. Vui lòng kiểm tra lại.',
      }
    );

    try {
      const result = await printPromise;
      return result.success;
    } catch (err) {
      console.error('Error printing via system PrintManager:', err);
      return false;
    }
  }, [isNative]);

  return {
    isNative,
    pairedDevices,
    isLoadingDevices,
    connectedDevice,
    connectedAddress,
    isConnecting,
    scanPairedDevices,
    connectBluetooth,
    disconnectBluetooth,
    printViaBluetooth,
    printViaWiFi,
  };
};
