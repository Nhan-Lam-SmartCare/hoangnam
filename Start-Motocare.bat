@echo off
echo ===================================================
echo   KHOI DONG MOTOCARE PRO - PHIEN BAN DIEN TU
echo ===================================================
echo.
echo Dang thiet lap ket noi toi Supabase moi...

:: Thiet lap bien moi truong cho phien lam viec nay
set "VITE_SUPABASE_URL=https://cduxyrvufttsyfatfdvo.supabase.co"
set "VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkdXh5cnZ1ZnR0c3lmYXRmZHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTU4ODIsImV4cCI6MjA4NDMzMTg4Mn0.aV5d82Zveie8vLUYfeZD2H0lK4u9Du7mpJlNC4Fh4Xs"

echo.
echo URL: %VITE_SUPABASE_URL%
echo Key: [Da duoc thiet lap an toan]
echo.
echo Dang khoi dong server...
echo.

npm run dev

pause
