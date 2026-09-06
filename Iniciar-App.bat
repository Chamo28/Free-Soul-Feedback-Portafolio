@echo off
setlocal
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

echo Iniciando FreeSoul Feedback...
echo (deja esta ventana abierta mientras usas la app)
echo.

start "" cmd /c "npm run dev"

REM Esperar a que los servidores levanten y abrir el navegador
timeout /t 6 /nobreak >nul
start "" http://localhost:5173

echo.
echo La app deberia abrirse en tu navegador en http://localhost:5173
echo Panel admin: http://localhost:5173/admin
echo.
echo Para CERRAR la app: cierra tambien la otra ventana negra que se abrio.
pause
