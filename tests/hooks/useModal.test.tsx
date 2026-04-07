import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { useModal, useModalWithData } from "../../src/hooks/useModal";

// Cleanup DOM after each test
afterEach(() => {
  cleanup();
});

// Test component for useModal
function UseModalTestComponent() {
  const [isOpen, open, close, toggle] = useModal(false);
  return (
    <div>
      <span data-testid="status">{isOpen ? "open" : "closed"}</span>
      <button data-testid="open-btn" onClick={open}>
        Open
      </button>
      <button data-testid="close-btn" onClick={close}>
        Close
      </button>
      <button data-testid="toggle-btn" onClick={toggle}>
        Toggle
      </button>
    </div>
  );
}

// Test component for useModalWithData
function UseModalWithDataTestComponent() {
  const { isOpen, data, openModal, closeModal } = useModalWithData<{
    id: number;
    name: string;
  }>(false);
  return (
    <div>
      <span data-testid="status">{isOpen ? "open" : "closed"}</span>
      <span data-testid="data">{data ? JSON.stringify(data) : "null"}</span>
      <button
        data-testid="open-btn"
        onClick={() => openModal({ id: 1, name: "Test Item" })}
      >
        Open with Data
      </button>
      <button data-testid="open-empty-btn" onClick={() => openModal()}>
        Open Empty
      </button>
      <button data-testid="close-btn" onClick={closeModal}>
        Close
      </button>
    </div>
  );
}

describe("useModal hook", () => {
  it("khởi tạo với state đóng (false)", () => {
    render(<UseModalTestComponent />);
    expect(screen.getByTestId("status").textContent).toBe("closed");
  });

  it("mở modal khi gọi open()", () => {
    render(<UseModalTestComponent />);
    fireEvent.click(screen.getByTestId("open-btn"));
    expect(screen.getByTestId("status").textContent).toBe("open");
  });

  it("đóng modal khi gọi close()", () => {
    render(<UseModalTestComponent />);
    fireEvent.click(screen.getByTestId("open-btn"));
    expect(screen.getByTestId("status").textContent).toBe("open");

    fireEvent.click(screen.getByTestId("close-btn"));
    expect(screen.getByTestId("status").textContent).toBe("closed");
  });

  it("toggle modal state", () => {
    render(<UseModalTestComponent />);
    const toggleBtn = screen.getByTestId("toggle-btn");

    // Toggle từ closed -> open
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("status").textContent).toBe("open");

    // Toggle từ open -> closed
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("status").textContent).toBe("closed");

    // Toggle lại từ closed -> open
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("status").textContent).toBe("open");
  });
});

describe("useModalWithData hook", () => {
  it("khởi tạo với state đóng và data null", () => {
    render(<UseModalWithDataTestComponent />);
    expect(screen.getByTestId("status").textContent).toBe("closed");
    expect(screen.getByTestId("data").textContent).toBe("null");
  });

  it("mở modal với data", () => {
    render(<UseModalWithDataTestComponent />);
    fireEvent.click(screen.getByTestId("open-btn"));

    expect(screen.getByTestId("status").textContent).toBe("open");
    expect(screen.getByTestId("data").textContent).toBe(
      '{"id":1,"name":"Test Item"}'
    );
  });

  it("mở modal không có data", () => {
    render(<UseModalWithDataTestComponent />);
    fireEvent.click(screen.getByTestId("open-empty-btn"));

    expect(screen.getByTestId("status").textContent).toBe("open");
    expect(screen.getByTestId("data").textContent).toBe("null");
  });

  it("đóng modal và reset data về null", () => {
    render(<UseModalWithDataTestComponent />);

    // Mở modal với data
    fireEvent.click(screen.getByTestId("open-btn"));
    expect(screen.getByTestId("data").textContent).toBe(
      '{"id":1,"name":"Test Item"}'
    );

    // Đóng modal - data nên về null
    fireEvent.click(screen.getByTestId("close-btn"));
    expect(screen.getByTestId("status").textContent).toBe("closed");
    expect(screen.getByTestId("data").textContent).toBe("null");
  });
});
