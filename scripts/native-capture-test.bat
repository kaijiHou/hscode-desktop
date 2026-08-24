@echo off
cd /d D:\hscode
node scripts\native-capture-test.cjs > D:\natcap-out.txt 2> D:\natcap-err.txt
exit /b %errorlevel%