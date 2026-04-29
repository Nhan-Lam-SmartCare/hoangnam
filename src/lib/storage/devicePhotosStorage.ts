import { supabase } from "../../supabaseClient";

/**
 * Tên bucket mặc định trong Supabase Storage.
 * Bạn nên chắc chắn bucket này đã được tạo và set là public.
 */
const BUCKET_NAME = "public-assets";
const FOLDER_NAME = "device-photos";

/**
 * Upload ảnh thiết bị đã nén lên Supabase Storage
 * @param workOrderId Mã phiếu sửa chữa (dùng để tạo folder/prefix)
 * @param compressedBlob File hoặc Blob đã nén
 * @returns Public URL của ảnh
 */
export async function uploadDevicePhoto(
  workOrderId: string,
  compressedBlob: Blob
): Promise<string> {
  try {
    // Tạo tên file ngẫu nhiên tránh trùng lặp
    const fileName = `${workOrderId}_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
    const filePath = `${FOLDER_NAME}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, compressedBlob, {
        contentType: "image/webp",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new Error("Không thể lấy URL công khai của ảnh.");
    }

    return data.publicUrl;
  } catch (error: any) {
    console.error("Error uploading device photo:", error);
    throw new Error(error.message || "Đã xảy ra lỗi khi upload ảnh.");
  }
}

/**
 * Xóa một ảnh thiết bị khỏi Supabase Storage dựa trên URL của nó
 * @param photoUrl Public URL của ảnh cần xóa
 */
export async function deleteDevicePhoto(photoUrl: string): Promise<void> {
  try {
    if (!photoUrl) return;

    // Trích xuất filePath từ URL
    // Giả định public URL có dạng: https://.../storage/v1/object/public/public-assets/device-photos/filename.webp
    const bucketAndPathStr = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const index = photoUrl.indexOf(bucketAndPathStr);
    
    if (index === -1) {
      console.warn("Không thể parse được filePath từ photoUrl:", photoUrl);
      return; // Không ném lỗi để tránh break luồng
    }

    const filePath = photoUrl.substring(index + bucketAndPathStr.length);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.error("Error deleting device photo:", error);
    throw new Error(error.message || "Đã xảy ra lỗi khi xóa ảnh.");
  }
}
