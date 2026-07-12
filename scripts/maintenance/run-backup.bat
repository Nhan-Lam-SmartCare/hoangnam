@echo off
cd /d "g:\hoangnam-main\hoangnam-main"
npm run db:backup > backups\backup_cron.log 2>&1
