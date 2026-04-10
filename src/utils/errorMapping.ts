import { RepoErrorDetail } from "../lib/repository/types";

// User-facing message mapping based on code
export function mapRepoErrorForUser(err: RepoErrorDetail): string {
  switch (err.code) {
    case "network":
      return "Mất kết nối máy chủ. Vui lòng kiểm tra mạng.";
    case "validation":
      return err.message;
    case "not_found":
      return "Không tìm thấy bản ghi.";
    case "supabase": {
      // Attempt to map specific DB codes to user-friendly messages
      const dbCode = (err.cause as any)?.code;
      if (dbCode === "23505") return "Dữ liệu đã tồn tại (trùng lặp).";
      if (dbCode === "42501") return "Bạn không có quyền thực hiện thao tác này.";
      if (dbCode === "23503") return "Không thể thao tác vì dữ liệu đang được sử dụng ở nơi khác.";
      return "Có lỗi dữ liệu. Thử lại hoặc liên hệ quản trị.";
    }
    // New codes mapped here
    case "timeout" as any:
      return "Máy chủ phản hồi quá chậm. Vui lòng thử lại sau.";
    case "offline" as any:
      return "Bạn đang ngoại tuyến. Dữ liệu sẽ được đồng bộ khi có mạng.";
    case "permission" as any:
      return "Từ chối truy cập: Không đủ quyền hạn.";
    default:
      return err.message || "Lỗi không xác định.";
  }
}
