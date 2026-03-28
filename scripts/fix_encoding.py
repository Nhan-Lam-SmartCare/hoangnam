"""
Fix double UTF-8 encoding in source files.
When text is encoded as UTF-8 twice, characters like "Tổng" become "Tá»•ng".
This script reads the corrupted bytes as Latin-1, then re-encodes as UTF-8.
"""
import os
import sys

def fix_double_utf8(filepath):
    """Fix a file with double UTF-8 encoding."""
    try:
        # Read raw bytes
        with open(filepath, 'rb') as f:
            raw_bytes = f.read()
        
        # Try to decode as UTF-8 first (this treats the double-encoded bytes as UTF-8)
        try:
            corrupted_text = raw_bytes.decode('utf-8')
        except UnicodeDecodeError:
            print(f"SKIP (not valid UTF-8): {filepath}")
            return False
        
        # Now encode as Latin-1 to get the original UTF-8 bytes
        # Then decode those bytes as UTF-8 to get the correct text
        try:
            # This reverses the double encoding:
            # double_encoded_utf8 -> decode as utf8 -> intermediate
            # intermediate -> encode as latin1 -> original_utf8_bytes  
            # original_utf8_bytes -> decode as utf8 -> correct_text
            original_bytes = corrupted_text.encode('latin-1')
            fixed_text = original_bytes.decode('utf-8')
        except (UnicodeDecodeError, UnicodeEncodeError):
            print(f"SKIP (encoding failed): {filepath}")
            return False
        
        # Check if text actually changed
        if corrupted_text == fixed_text:
            print(f"SKIP (no change): {filepath}")
            return False
        
        # Write fixed content
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            f.write(fixed_text)
        
        print(f"FIXED: {filepath}")
        return True
        
    except Exception as e:
        print(f"ERROR ({e}): {filepath}")
        return False

def main():
    files_to_fix = [
        r"src\components\inventory\components\AddProductModal.tsx",
        r"src\components\inventory\components\EditPartModal.tsx",
        r"src\components\inventory\components\EditReceiptModal.tsx",
        r"src\components\inventory\components\GoodsReceiptModal.tsx",
        r"src\components\inventory\components\ImportInventoryModal.tsx",
        r"src\components\inventory\components\InventoryHistoryModal.tsx",
        r"src\components\sales\SalesManager.tsx",
        r"src\components\service\components\WorkOrderModal.tsx",
        r"src\components\service\ServiceManager.tsx",
    ]
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    fixed_count = 0
    
    for filepath in files_to_fix:
        full_path = os.path.join(base_dir, filepath)
        if os.path.exists(full_path):
            if fix_double_utf8(full_path):
                fixed_count += 1
        else:
            print(f"NOT FOUND: {filepath}")
    
    print(f"\nTotal fixed: {fixed_count}/{len(files_to_fix)}")

if __name__ == "__main__":
    main()
