export function printElementById(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  const isThermalReceipt = id === "work-order-receipt";
  const pageStyle = isThermalReceipt
    ? `
    @page { size: 80mm auto; margin: 0; }
    body { font-family: Arial, Helvetica, sans-serif; width: 80mm; margin: 0 auto; }
    #work-order-receipt {
      width: 76mm !important;
      margin: 0 auto !important;
      padding: 2mm !important;
      box-sizing: border-box;
      overflow-wrap: break-word;
    }
    @media print {
      .no-print { display: none; }
      body { width: 80mm; margin: 0 auto; }
    }
  `
    : `
    body { font-family: Arial, Helvetica, sans-serif; }
    @media print { .no-print { display: none; } }
  `;

  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;

  w.document.write(`<!doctype html><html><head><title>Print</title>
  <style>
    ${pageStyle}
  </style>
  </head><body>${el.outerHTML}</body></html>`);
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
