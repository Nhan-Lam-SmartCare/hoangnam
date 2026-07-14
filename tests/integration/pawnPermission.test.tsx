/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { canDo } from "../../src/utils/permissions";
import type { UserRole } from "../../src/contexts/AuthContext";

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

vi.mock("../../src/components/common/LoadingSpinner", () => ({
  default: () => <div>LOADING</div>,
}));

import { ProtectedRoute } from "../../src/components/auth/ProtectedRoute";

const PawnMock = () => <div>PAWN_PAGE_CONTENT</div>;

function setAuth(next: Partial<typeof authState>) {
  Object.assign(authState, { user: null, profile: null, loading: false, error: null }, next);
}

describe("Pawn Permission Integration Test", () => {
  beforeEach(() => {
    cleanup();
    setAuth({});
  });

  it("should deny access and show deny message when logged in as staff", () => {
    setAuth({
      user: { id: "u-staff" },
      profile: { id: "u-staff", role: "staff" as UserRole },
    });

    render(
      <ProtectedRoute
        allow={({ profile }) => canDo(profile, "pawn.manage")}
        denyMessage="Không có quyền truy cập."
      >
        <PawnMock />
      </ProtectedRoute>
    );

    expect(screen.getByText("Không có quyền truy cập.")).toBeTruthy();
    expect(screen.queryByText("PAWN_PAGE_CONTENT")).toBeNull();
  });

  it("should allow access and render pawn page when logged in as manager", () => {
    setAuth({
      user: { id: "u-manager" },
      profile: { id: "u-manager", role: "manager" as UserRole },
    });

    render(
      <ProtectedRoute
        allow={({ profile }) => canDo(profile, "pawn.manage")}
        denyMessage="Không có quyền truy cập."
      >
        <PawnMock />
      </ProtectedRoute>
    );

    expect(screen.getByText("PAWN_PAGE_CONTENT")).toBeTruthy();
    expect(screen.queryByText("Không có quyền truy cập.")).toBeNull();
  });

  it("should allow access and render pawn page when logged in as owner", () => {
    setAuth({
      user: { id: "u-owner" },
      profile: { id: "u-owner", role: "owner" as UserRole },
    });

    render(
      <ProtectedRoute
        allow={({ profile }) => canDo(profile, "pawn.manage")}
        denyMessage="Không có quyền truy cập."
      >
        <PawnMock />
      </ProtectedRoute>
    );

    expect(screen.getByText("PAWN_PAGE_CONTENT")).toBeTruthy();
    expect(screen.queryByText("Không có quyền truy cập.")).toBeNull();
  });
});
