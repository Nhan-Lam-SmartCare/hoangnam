import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Wrapper cho renderHook/render khi thứ đang test có gọi hook của React Query.
 *
 * `retry: false` để một query lỗi báo ngay thay vì thử lại rồi làm test treo.
 * Mỗi lần gọi tạo QueryClient MỚI để cache của test trước không rớt sang test sau.
 */
export function createQueryWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return Wrapper;
}
