import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { usePagination } from "../../src/hooks/usePagination";

// Cleanup DOM after each test
afterEach(() => {
  cleanup();
});

// Test component
function UsePaginationTestComponent({
  totalItems,
  itemsPerPage = 10,
}: {
  totalItems: number;
  itemsPerPage?: number;
}) {
  const pagination = usePagination({ totalItems, itemsPerPage });
  const items = Array.from({ length: totalItems }, (_, i) => `Item ${i + 1}`);
  const pagedItems = pagination.pageItems(items);

  return (
    <div>
      <span data-testid="current-page">{pagination.currentPage}</span>
      <span data-testid="total-pages">{pagination.totalPages}</span>
      <span data-testid="start-index">{pagination.startIndex}</span>
      <span data-testid="end-index">{pagination.endIndex}</span>
      <span data-testid="has-next">
        {pagination.hasNextPage ? "yes" : "no"}
      </span>
      <span data-testid="has-prev">
        {pagination.hasPrevPage ? "yes" : "no"}
      </span>
      <span data-testid="paged-items">{pagedItems.join(",")}</span>
      <button data-testid="next-btn" onClick={pagination.nextPage}>
        Next
      </button>
      <button data-testid="prev-btn" onClick={pagination.prevPage}>
        Prev
      </button>
      <button data-testid="reset-btn" onClick={pagination.resetPage}>
        Reset
      </button>
      <button data-testid="goto-3" onClick={() => pagination.goToPage(3)}>
        Go to 3
      </button>
      <button data-testid="goto-100" onClick={() => pagination.goToPage(100)}>
        Go to 100
      </button>
      <button data-testid="goto-0" onClick={() => pagination.goToPage(0)}>
        Go to 0
      </button>
    </div>
  );
}

describe("usePagination hook", () => {
  it("khởi tạo với giá trị mặc định đúng", () => {
    render(<UsePaginationTestComponent totalItems={25} itemsPerPage={10} />);

    expect(screen.getByTestId("current-page").textContent).toBe("1");
    expect(screen.getByTestId("total-pages").textContent).toBe("3");
    expect(screen.getByTestId("start-index").textContent).toBe("0");
    expect(screen.getByTestId("end-index").textContent).toBe("10");
    expect(screen.getByTestId("has-next").textContent).toBe("yes");
    expect(screen.getByTestId("has-prev").textContent).toBe("no");
  });

  it("tính totalPages đúng (làm tròn lên)", () => {
    const { rerender } = render(
      <UsePaginationTestComponent totalItems={21} itemsPerPage={10} />
    );
    expect(screen.getByTestId("total-pages").textContent).toBe("3");

    rerender(<UsePaginationTestComponent totalItems={20} itemsPerPage={10} />);
    expect(screen.getByTestId("total-pages").textContent).toBe("2");

    rerender(<UsePaginationTestComponent totalItems={1} itemsPerPage={10} />);
    expect(screen.getByTestId("total-pages").textContent).toBe("1");
  });

  it("nextPage chuyển sang trang kế tiếp", () => {
    render(<UsePaginationTestComponent totalItems={25} itemsPerPage={10} />);

    fireEvent.click(screen.getByTestId("next-btn"));
    expect(screen.getByTestId("current-page").textContent).toBe("2");
    expect(screen.getByTestId("start-index").textContent).toBe("10");
    expect(screen.getByTestId("end-index").textContent).toBe("20");
  });

  it("nextPage không vượt quá trang cuối", () => {
    render(<UsePaginationTestComponent totalItems={25} itemsPerPage={10} />);

    // Đi đến trang cuối
    fireEvent.click(screen.getByTestId("next-btn")); // page 2
    fireEvent.click(screen.getByTestId("next-btn")); // page 3

    expect(screen.getByTestId("current-page").textContent).toBe("3");
    expect(screen.getByTestId("has-next").textContent).toBe("no");

    // Bấm next khi đã ở trang cuối
    fireEvent.click(screen.getByTestId("next-btn"));
    expect(screen.getByTestId("current-page").textContent).toBe("3");
  });

  it("prevPage chuyển về trang trước", () => {
    render(<UsePaginationTestComponent totalItems={25} itemsPerPage={10} />);

    // Đi đến trang 2
    fireEvent.click(screen.getByTestId("next-btn"));
    expect(screen.getByTestId("current-page").textContent).toBe("2");

    // Quay lại trang 1
    fireEvent.click(screen.getByTestId("prev-btn"));
    expect(screen.getByTestId("current-page").textContent).toBe("1");
  });

  it("prevPage không xuống dưới trang 1", () => {
    render(<UsePaginationTestComponent totalItems={25} itemsPerPage={10} />);

    expect(screen.getByTestId("current-page").textContent).toBe("1");
    expect(screen.getByTestId("has-prev").textContent).toBe("no");

    // Bấm prev khi đã ở trang 1
    fireEvent.click(screen.getByTestId("prev-btn"));
    expect(screen.getByTestId("current-page").textContent).toBe("1");
  });

  it("goToPage chuyển đến trang cụ thể", () => {
    render(<UsePaginationTestComponent totalItems={50} itemsPerPage={10} />);

    fireEvent.click(screen.getByTestId("goto-3"));
    expect(screen.getByTestId("current-page").textContent).toBe("3");
  });

  it("goToPage không vượt giới hạn", () => {
    render(<UsePaginationTestComponent totalItems={25} itemsPerPage={10} />);

    // goToPage(100) khi chỉ có 3 trang -> về trang 3
    fireEvent.click(screen.getByTestId("goto-100"));
    expect(screen.getByTestId("current-page").textContent).toBe("3");

    // goToPage(0) -> về trang 1
    fireEvent.click(screen.getByTestId("goto-0"));
    expect(screen.getByTestId("current-page").textContent).toBe("1");
  });

  it("resetPage về trang 1", () => {
    render(<UsePaginationTestComponent totalItems={50} itemsPerPage={10} />);

    // Đi đến trang 3
    fireEvent.click(screen.getByTestId("goto-3"));
    expect(screen.getByTestId("current-page").textContent).toBe("3");

    // Reset về trang 1
    fireEvent.click(screen.getByTestId("reset-btn"));
    expect(screen.getByTestId("current-page").textContent).toBe("1");
  });

  it("pageItems trả về items đúng cho trang hiện tại", () => {
    render(<UsePaginationTestComponent totalItems={25} itemsPerPage={10} />);

    // Trang 1: Item 1-10
    expect(screen.getByTestId("paged-items").textContent).toBe(
      "Item 1,Item 2,Item 3,Item 4,Item 5,Item 6,Item 7,Item 8,Item 9,Item 10"
    );

    // Trang 2: Item 11-20
    fireEvent.click(screen.getByTestId("next-btn"));
    expect(screen.getByTestId("paged-items").textContent).toBe(
      "Item 11,Item 12,Item 13,Item 14,Item 15,Item 16,Item 17,Item 18,Item 19,Item 20"
    );

    // Trang 3: Item 21-25
    fireEvent.click(screen.getByTestId("next-btn"));
    expect(screen.getByTestId("paged-items").textContent).toBe(
      "Item 21,Item 22,Item 23,Item 24,Item 25"
    );
  });

  it("endIndex không vượt quá totalItems", () => {
    render(<UsePaginationTestComponent totalItems={25} itemsPerPage={10} />);

    // Đi đến trang cuối
    fireEvent.click(screen.getByTestId("goto-3"));

    // endIndex nên là 25 (không phải 30)
    expect(screen.getByTestId("end-index").textContent).toBe("25");
  });

  it("xử lý đúng khi totalItems = 0", () => {
    render(<UsePaginationTestComponent totalItems={0} itemsPerPage={10} />);

    expect(screen.getByTestId("total-pages").textContent).toBe("1");
    expect(screen.getByTestId("current-page").textContent).toBe("1");
    expect(screen.getByTestId("paged-items").textContent).toBe("");
  });
});
