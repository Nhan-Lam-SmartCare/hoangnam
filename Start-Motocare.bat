@echo off
echo ===================================================
echo   KHOI DONG MOTOCARE PRO - PHIEN BAN DIEN TU
echo ===================================================
echo.
echo Dang thiet lap ket noi toi Supabase moi...

:: Thiet lap bien moi truong cho phien lam viec nay
set "VITE_SUPABASE_URL=https://xduimljokohsqslwbtja.supabase.co"
set "VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdWltbGpva29oc3FzbHdidGphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3OTQxOTUsImV4cCI6MjA4MjM3MDE5NX0.rYkJU57EkwBKhJIiaaJdaRrprArrjvBe5UZCpP4yDDo"
set "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdWltbGpva29oc3FzbHdidGphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njc5NDE5NSwiZXhwIjoyMDgyMzcwMTk1fQ.Siq4iY2Q1hum1UdmxMUcdFsJxuEU4DctalGayxeKrYw"

echo.
echo URL: %VITE_SUPABASE_URL%
echo Key: [Da duoc thiet lap an toan]
echo.
echo Dang khoi dong server...
echo.

npm run dev

pause
