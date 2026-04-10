import { describe, it, expect } from "vitest";

type ReceiptItem = {
  name: string;
  qty: number;
  price: number;
};

function formatCurrency(value: number) {
  return value.toLocaleString("vi-VN");
}

function buildReceiptHtml(payload: {
  orderCode: string;
  customerName: string;
  items: ReceiptItem[];
  total: number;
}) {
  const rows = payload.items
    .map(
      (item) =>
        `<tr><td>${item.name}</td><td>${item.qty}</td><td>${formatCurrency(item.price)}</td></tr>`
    )
    .join("");

  return `
    <div data-testid="receipt">
      <h1>Hoa don ban hang</h1>
      <div data-testid="code">${payload.orderCode}</div>
      <div data-testid="customer">${payload.customerName}</div>
      <table data-testid="items">${rows}</table>
      <strong data-testid="total">${formatCurrency(payload.total)}</strong>
    </div>
  `;
}

describe("sales print receipt format compatibility", () => {
  it("renders required receipt sections and total", () => {
    const html = buildReceiptHtml({
      orderCode: "BH-20260410-001",
      customerName: "Nguyen Van A",
      items: [
        { name: "Nhot ELF", qty: 2, price: 120000 },
        { name: "Loc gio", qty: 1, price: 80000 },
      ],
      total: 320000,
    });

    expect(html).toContain('data-testid="receipt"');
    expect(html).toContain('data-testid="code">BH-20260410-001<');
    expect(html).toContain('data-testid="customer">Nguyen Van A<');
    expect((html.match(/<tr>/g) ?? []).length).toBe(2);
    expect(html).toContain('data-testid="total">320.000<');
  });
});
