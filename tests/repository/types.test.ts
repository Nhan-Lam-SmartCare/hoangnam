/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  success,
  failure,
  mapRepoErrorForAdmin,
} from "../../src/lib/repository/types";
import type { RepoErrorDetail } from "../../src/lib/repository/types";

describe("Repository Types", () => {
  describe("success", () => {
    it("should create success result with data", () => {
      const data = { id: 1, name: "Test" };
      const result = success(data);

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(data);
    });

    it("should include meta when provided", () => {
      const data = [{ id: 1 }, { id: 2 }];
      const meta = { total: 100, page: 1 };
      const result = success(data, meta);

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.meta).toEqual(meta);
    });

    it("should handle null data", () => {
      const result = success(null);

      expect(result.ok).toBe(true);
      expect(result.data).toBeNull();
    });

    it("should handle array data", () => {
      const data = [1, 2, 3];
      const result = success(data);

      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(3);
    });
  });

  describe("failure", () => {
    beforeEach(() => {
      // Mock window for dev environment
      vi.stubGlobal("window", { __repoErrors: [] });
    });

    it("should create failure result with error details", () => {
      const error: RepoErrorDetail = {
        code: "validation",
        message: "Invalid input",
      };
      const result = failure(error);

      expect(result.ok).toBe(false);
      expect(result.error.code).toBe("validation");
      expect(result.error.message).toBe("Invalid input");
    });

    it("should include cause when provided", () => {
      const originalError = new Error("Original error");
      const error: RepoErrorDetail = {
        code: "supabase",
        message: "Database error",
        cause: originalError,
      };
      const result = failure(error);

      expect(result.error.cause).toBe(originalError);
    });

    it("should handle all error codes", () => {
      const codes: RepoErrorDetail["code"][] = [
        "network",
        "validation",
        "not_found",
        "supabase",
        "unknown",
      ];

      codes.forEach((code) => {
        const result = failure({ code, message: `${code} error` });
        expect(result.error.code).toBe(code);
      });
    });
  });

  describe("mapRepoErrorForAdmin", () => {
    it("should format error with code prefix", () => {
      const error: RepoErrorDetail = {
        code: "validation",
        message: "Field is required",
      };

      const result = mapRepoErrorForAdmin(error);

      expect(result).toBe("[VALIDATION] Field is required");
    });

    it("should include supabase cause message when available", () => {
      const error: RepoErrorDetail = {
        code: "supabase",
        message: "Query failed",
        cause: { message: "duplicate key value violates unique constraint" },
      };

      const result = mapRepoErrorForAdmin(error);

      expect(result).toContain("[SUPABASE]");
      expect(result).toContain("Query failed");
      expect(result).toContain("duplicate key value");
    });

    it("should handle error without cause", () => {
      const error: RepoErrorDetail = {
        code: "network",
        message: "Connection timeout",
      };

      const result = mapRepoErrorForAdmin(error);

      expect(result).toBe("[NETWORK] Connection timeout");
    });

    it("should uppercase error code", () => {
      const error: RepoErrorDetail = {
        code: "not_found",
        message: "Resource not found",
      };

      const result = mapRepoErrorForAdmin(error);

      expect(result).toBe("[NOT_FOUND] Resource not found");
    });
  });
});
