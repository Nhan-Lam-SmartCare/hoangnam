/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";

// --- Mocks -------------------------------------------------------------
const authState: any = {
  user: null,
  profile: null,
  loading: false,
  error: null,
};

vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("react-router-dom", () => ({
  Navigate: ({ to }: { to: string }) => <div>REDIRECT:{to}</div>,
}));

vi.mock("../../src/utils/toast", () => ({
  showToast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../src/components/common/LoadingSpinner", () => ({
  default: () => <div>LOADING</div>,
}));

import { ProtectedRoute } from "../../src/components/auth/ProtectedRoute";

const Child = () => <div>SECRET_CONTENT</div>;

function setAuth(next: Partial<typeof authState>) {
  Object.assign(authState, { user: null, profile: null, loading: false, error: null }, next);
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    cleanup();
    setAuth({});
  });

  it("redirects to /login when there is no user", () => {
    setAuth({ user: null });
    render(
      <ProtectedRoute>
        <Child />
      </ProtectedRoute>
    );
    expect(screen.getByText("REDIRECT:/login")).toBeTruthy();
    expect(screen.queryByText("SECRET_CONTENT")).toBeNull();
  });

  it("shows loader while user exists but profile not yet loaded", () => {
    setAuth({ user: { id: "u1" }, profile: null });
    render(
      <ProtectedRoute>
        <Child />
      </ProtectedRoute>
    );
    expect(screen.getByText("LOADING")).toBeTruthy();
    expect(screen.queryByText("SECRET_CONTENT")).toBeNull();
  });

  it("denies access when role is not in requiredRoles", () => {
    setAuth({ user: { id: "u1" }, profile: { id: "u1", role: "staff" } });
    render(
      <ProtectedRoute requiredRoles={["owner", "manager"]}>
        <Child />
      </ProtectedRoute>
    );
    expect(screen.getByText("Không có quyền truy cập")).toBeTruthy();
    expect(screen.queryByText("SECRET_CONTENT")).toBeNull();
  });

  it("allows access when role is in requiredRoles", () => {
    setAuth({ user: { id: "u1" }, profile: { id: "u1", role: "owner" } });
    render(
      <ProtectedRoute requiredRoles={["owner", "manager"]}>
        <Child />
      </ProtectedRoute>
    );
    expect(screen.getByText("SECRET_CONTENT")).toBeTruthy();
  });

  it("denies access when custom allow() returns false", () => {
    setAuth({ user: { id: "u1" }, profile: { id: "u1", role: "staff" } });
    render(
      <ProtectedRoute allow={({ profile }) => profile.role === "owner"}>
        <Child />
      </ProtectedRoute>
    );
    expect(screen.getByText("Không có quyền truy cập")).toBeTruthy();
    expect(screen.queryByText("SECRET_CONTENT")).toBeNull();
  });

  it("allows access when custom allow() returns true", () => {
    setAuth({ user: { id: "u1" }, profile: { id: "u1", role: "staff" } });
    render(
      <ProtectedRoute allow={({ profile }) => profile.role === "staff"}>
        <Child />
      </ProtectedRoute>
    );
    expect(screen.getByText("SECRET_CONTENT")).toBeTruthy();
  });
});
