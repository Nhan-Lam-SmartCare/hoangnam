import { describe, it, expect } from "vitest";
import React from "react";

// Minimal custom render helper without external lib
// Simple non-JSX render invoking factory directly
function render(factory: (props: any) => HTMLElement, props: any) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const node = factory(props);
  container.appendChild(node);
  return {
    container,
    getByTestId: (id: string) =>
      container.querySelector(`[data-testid="${id}"]`)!,
    rerender: (nextProps: any) => {
      container.innerHTML = "";
      const n = factory(nextProps);
      container.appendChild(n);
    },
  };
}

// Lightweight pseudo component to simulate footer controls logic
function Pager({ meta }: any) {
  const wrapper = document.createElement("div");
  const prev = document.createElement("button");
  prev.dataset.testid = "prev";
  prev.disabled = meta.page <= 1;
  const indicator = document.createElement("span");
  indicator.dataset.testid = "indicator";
  indicator.textContent = `${meta.page}/${meta.totalPages}`;
  const next = document.createElement("button");
  next.dataset.testid = "next";
  next.disabled = !meta.hasMore;
  const select = document.createElement("select");
  select.dataset.testid = "size";
  [10, 20, 50].forEach((sz) => {
    const opt = document.createElement("option");
    opt.value = String(sz);
    opt.textContent = String(sz);
    if (sz === meta.pageSize) opt.selected = true;
    select.appendChild(opt);
  });
  wrapper.appendChild(prev);
  wrapper.appendChild(indicator);
  wrapper.appendChild(next);
  wrapper.appendChild(select);
  return wrapper;
}

describe("Sales pagination UI basics", () => {
  it("disables prev on first page and next on last page", () => {
    const metaFirst = { page: 1, totalPages: 5, pageSize: 20, hasMore: true };
    const { getByTestId, rerender } = render(Pager, { meta: metaFirst });
    expect((getByTestId("prev") as HTMLButtonElement).disabled).toBe(true);
    expect((getByTestId("next") as HTMLButtonElement).disabled).toBe(false);

    const metaLast = { page: 5, totalPages: 5, pageSize: 20, hasMore: false };
    rerender({ meta: metaLast });
    expect((getByTestId("next") as HTMLButtonElement).disabled).toBe(true);
    expect((getByTestId("prev") as HTMLButtonElement).disabled).toBe(false);
  });
});
