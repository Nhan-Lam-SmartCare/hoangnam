type PrintElementOptions = {
  pageSize?: string;
  paperWidth?: string;
  customStyle?: string;
};

export function printElementById(id: string, options?: PrintElementOptions) {
  const el = document.getElementById(id);
  if (!el) return;

  const isThermalReceipt = id === "work-order-receipt" || !!options?.pageSize || !!options?.paperWidth;
  const paperWidth = options?.paperWidth || "80mm";
  const pageSize = options?.pageSize || `${paperWidth} auto`;
  const receiptSelector = `#${id}`;
  const baseStyle = isThermalReceipt
    ? `
    @page { size: ${pageSize}; margin: 0; }
    html, body { width: ${paperWidth}; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0 auto; }
    ${receiptSelector} {
      width: calc(${paperWidth} - 4mm) !important;
      margin: 0 auto !important;
      padding: 2mm !important;
      box-sizing: border-box;
      overflow-wrap: break-word;
    }
    @media print {
      .no-print { display: none; }
      html, body { width: ${paperWidth}; }
      body { margin: 0 auto; }
    }
  `
    : `
    body { font-family: Arial, Helvetica, sans-serif; }
    @media print { .no-print { display: none; } }
  `;
  const pageStyle = `${baseStyle}${options?.customStyle || ""}`;

  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.matchMedia?.("(pointer: coarse)").matches;

  if (isMobile) {
    // Mobile: Use hidden iframe instead of window.open (popup blockers)
    printViaIframe(el.outerHTML, pageStyle);
  } else {
    // Desktop: Use window.open as before
    printViaNewWindow(el.outerHTML, pageStyle);
  }
}

function printViaIframe(htmlContent: string, pageStyle: string) {
  // Remove existing print iframe
  const existingIframe = document.getElementById("system-print-iframe");
  if (existingIframe) existingIframe.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "system-print-iframe";
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    // Fallback to window.open if iframe fails
    printViaNewWindow(htmlContent, pageStyle);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(`<!doctype html><html><head><title>Print</title>
  <style>
    ${pageStyle}
  </style>
  </head><body>${htmlContent}</body></html>`);
  iframeDoc.close();

  // Wait for images then print
  const images = iframeDoc.getElementsByTagName("img");
  const imagePromises = Array.from(images).map((img) => {
    return new Promise<void>((resolve) => {
      if (img.complete) {
        resolve();
      } else {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(() => resolve(), 5000);
      }
    });
  });

  Promise.all(imagePromises).then(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // If iframe print fails, fallback to window.open
      printViaNewWindow(htmlContent, pageStyle);
    }

    // Cleanup
    setTimeout(() => {
      iframe.remove();
    }, 10000);
  });
}

function printViaNewWindow(htmlContent: string, pageStyle: string) {
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) {
    // window.open was blocked - try inline print as last resort
    window.print();
    return;
  }

  w.document.write(`<!doctype html><html><head><title>Print</title>
  <style>
    ${pageStyle}
  </style>
  </head><body>${htmlContent}</body></html>`);
  w.document.close();

  // Wait for all images to load before printing
  const images = w.document.getElementsByTagName("img");
  const imagePromises = Array.from(images).map((img) => {
    return new Promise<void>((resolve) => {
      if (img.complete) {
        resolve();
      } else {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Continue even if image fails to load
        // Timeout after 5 seconds
        setTimeout(() => resolve(), 5000);
      }
    });
  });

  Promise.all(imagePromises).then(() => {
    w.focus();
    w.print();
    w.close();
  });
}
