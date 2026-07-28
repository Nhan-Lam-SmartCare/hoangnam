@echo off
echo ===================================================
echo   KHOI DONG MOTOCARE PRO - PHIEN BAN DIEN TU
echo ===================================================
echo.

:: Cau hinh Supabase doc tu file .env (da nam trong .gitignore).
:: KHONG dat khoa truc tiep trong file .bat nay: file .bat duoc commit len
:: GitHub, ma SUPABASE_SERVICE_ROLE_KEY bo qua toan bo RLS - lo ra la mat sach
:: du lieu moi chi nhanh, ke ca bang luong.
if not exist ".env" (
    echo [LOI] Khong tim thay file .env
    echo.
    echo Tao file .env o thu muc goc voi noi dung:
    echo    VITE_SUPABASE_URL=https://^<project^>.supabase.co
    echo    VITE_SUPABASE_ANON_KEY=^<anon key^>
    echo    SUPABASE_URL=https://^<project^>.supabase.co
    echo    SUPABASE_SERVICE_ROLE_KEY=^<service role key^>
    echo.
    pause
    exit /b 1
)

echo Dang khoi dong server... (Vite tu doc .env)
echo.

npm run dev

pause
