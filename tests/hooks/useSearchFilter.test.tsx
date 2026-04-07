import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { useSearchFilter } from "../../src/hooks/useSearchFilter";

// Cleanup DOM after each test
afterEach(() => {
  cleanup();
});

interface TestItem extends Record<string, unknown> {
  id: number;
  name: string;
  sku: string;
  category: string;
}

const testItems: TestItem[] = [
  { id: 1, name: "Nhớt Castrol 10W40", sku: "OIL001", category: "Nhớt" },
  { id: 2, name: "Lọc gió Honda", sku: "FIL001", category: "Lọc" },
  { id: 3, name: "Bugi NGK", sku: "SPK001", category: "Bugi" },
  { id: 4, name: "Nhớt Shell 15W50", sku: "OIL002", category: "Nhớt" },
  { id: 5, name: "Lọc nhớt Yamaha", sku: "FIL002", category: "Lọc" },
];

// Test component
function UseSearchFilterTestComponent({
  items,
  searchFields,
}: {
  items: TestItem[];
  searchFields: (keyof TestItem)[];
}) {
  const {
    searchQuery,
    setSearchQuery,
    filteredItems,
    clearSearch,
    hasResults,
    resultCount,
  } = useSearchFilter({ items, searchFields });

  return (
    <div>
      <input
        data-testid="search-input"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search..."
      />
      <button data-testid="clear-btn" onClick={clearSearch}>
        Clear
      </button>
      <span data-testid="result-count">{resultCount}</span>
      <span data-testid="has-results">{hasResults ? "yes" : "no"}</span>
      <ul data-testid="results">
        {filteredItems.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}

describe("useSearchFilter hook", () => {
  it("khởi tạo với tất cả items khi searchQuery rỗng", () => {
    render(
      <UseSearchFilterTestComponent items={testItems} searchFields={["name"]} />
    );

    expect(screen.getByTestId("result-count").textContent).toBe("5");
    expect(screen.getByTestId("has-results").textContent).toBe("yes");
  });

  it("lọc items theo searchQuery", () => {
    render(
      <UseSearchFilterTestComponent items={testItems} searchFields={["name"]} />
    );

    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "Nhớt" } });

    // "Nhớt" matches: Nhớt Castrol, Nhớt Shell, Lọc nhớt Yamaha (partial match)
    expect(screen.getByTestId("result-count").textContent).toBe("3");
    const results = screen.getByTestId("results");
    expect(results.textContent).toContain("Nhớt Castrol");
    expect(results.textContent).toContain("Nhớt Shell");
  });

  it("lọc theo nhiều fields", () => {
    render(
      <UseSearchFilterTestComponent
        items={testItems}
        searchFields={["name", "sku", "category"]}
      />
    );

    const input = screen.getByTestId("search-input");

    // Tìm theo sku
    fireEvent.change(input, { target: { value: "OIL" } });
    expect(screen.getByTestId("result-count").textContent).toBe("2");

    // Tìm theo category
    fireEvent.change(input, { target: { value: "Lọc" } });
    expect(screen.getByTestId("result-count").textContent).toBe("2");
    const results = screen.getByTestId("results");
    expect(results.textContent).toContain("Lọc gió Honda");
    expect(results.textContent).toContain("Lọc nhớt Yamaha");
  });

  it("tìm kiếm case-insensitive", () => {
    render(
      <UseSearchFilterTestComponent items={testItems} searchFields={["name"]} />
    );

    const input = screen.getByTestId("search-input");

    // Tìm với lowercase
    fireEvent.change(input, { target: { value: "bugi" } });
    expect(screen.getByTestId("result-count").textContent).toBe("1");

    // Tìm với uppercase
    fireEvent.change(input, { target: { value: "BUGI" } });
    expect(screen.getByTestId("result-count").textContent).toBe("1");

    // Tìm với mixed case
    fireEvent.change(input, { target: { value: "BuGi" } });
    expect(screen.getByTestId("result-count").textContent).toBe("1");
  });

  it("clearSearch reset về rỗng và hiển thị tất cả items", () => {
    render(
      <UseSearchFilterTestComponent items={testItems} searchFields={["name"]} />
    );

    const input = screen.getByTestId("search-input");

    // Tìm kiếm trước
    fireEvent.change(input, { target: { value: "NGK" } });
    expect(screen.getByTestId("result-count").textContent).toBe("1");

    // Clear
    fireEvent.click(screen.getByTestId("clear-btn"));
    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.getByTestId("result-count").textContent).toBe("5");
  });

  it("hasResults = false khi không có kết quả", () => {
    render(
      <UseSearchFilterTestComponent items={testItems} searchFields={["name"]} />
    );

    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "không tồn tại xyz" } });

    expect(screen.getByTestId("has-results").textContent).toBe("no");
    expect(screen.getByTestId("result-count").textContent).toBe("0");
  });

  it("xử lý whitespace trong searchQuery", () => {
    render(
      <UseSearchFilterTestComponent items={testItems} searchFields={["name"]} />
    );

    const input = screen.getByTestId("search-input");

    // Chỉ có whitespace -> hiển thị tất cả (vì trim() trả về rỗng)
    fireEvent.change(input, { target: { value: "   " } });
    expect(screen.getByTestId("result-count").textContent).toBe("5");

    // Tìm kiếm với text (không trim input, chỉ trim khi check)
    fireEvent.change(input, { target: { value: "Honda" } });
    expect(screen.getByTestId("result-count").textContent).toBe("1");
  });

  it("xử lý empty items array", () => {
    render(<UseSearchFilterTestComponent items={[]} searchFields={["name"]} />);

    expect(screen.getByTestId("result-count").textContent).toBe("0");
    expect(screen.getByTestId("has-results").textContent).toBe("no");
  });

  it("tìm kiếm partial match", () => {
    render(
      <UseSearchFilterTestComponent items={testItems} searchFields={["name"]} />
    );

    const input = screen.getByTestId("search-input");

    // Tìm một phần của tên
    fireEvent.change(input, { target: { value: "cast" } });
    expect(screen.getByTestId("result-count").textContent).toBe("1");
    expect(screen.getByTestId("results").textContent).toContain("Nhớt Castrol");
  });
});
