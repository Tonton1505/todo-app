@echo off
chcp 65001 >nul
echo ===================================================
echo   AUTOMATED DOCKER BUILD & PUSH SCRIPT (V1.0 & V2.0)
echo ===================================================

set DOCKER_USER=tonton15
echo [*] Docker Hub Username: %DOCKER_USER%
echo [*] Vui long kiem tra Docker Desktop dang chay!
echo.

:: ----------------------------------------------------
:: BUOC 1: BUILD & PUSH V1.0 (Theme Xanh duong)
:: ----------------------------------------------------
echo [1/4] Dang chuan bi ma nguon Frontend V1.0 (Xanh duong)...
copy /Y "frontend\src\App.v1.jsx" "frontend\src\App.jsx" >nul

echo [2/4] Dang Build va Push V1.0 len Docker Hub...
echo - Dang build todo-backend:v1.0...
docker build -t %DOCKER_USER%/todo-backend:v1.0 ./backend || goto :error
echo - Dang push todo-backend:v1.0...
docker push %DOCKER_USER%/todo-backend:v1.0 || goto :error

echo - Dang build todo-frontend:v1.0...
docker build -t %DOCKER_USER%/todo-frontend:v1.0 ./frontend || goto :error
echo - Dang push todo-frontend:v1.0...
docker push %DOCKER_USER%/todo-frontend:v1.0 || goto :error

echo.
echo ===================================================
echo [V1.0 HOAN TAT] Backend & Frontend v1.0 da len Docker Hub!
echo ===================================================
echo.

:: ----------------------------------------------------
:: BUOC 2: BUILD & PUSH V2.0 (Theme Cam/Do Hot Update)
:: ----------------------------------------------------
echo [3/4] Dang chuan bi ma nguon Frontend V2.0 (Cam/Do Hot Update)...
copy /Y "frontend\src\App.v2.jsx" "frontend\src\App.jsx" >nul

echo [4/4] Dang Build va Push V2.0 len Docker Hub...
echo - Dang build todo-backend:v2.0...
docker build -t %DOCKER_USER%/todo-backend:v2.0 ./backend || goto :error
echo - Dang push todo-backend:v2.0...
docker push %DOCKER_USER%/todo-backend:v2.0 || goto :error

echo - Dang build todo-frontend:v2.0...
docker build -t %DOCKER_USER%/todo-frontend:v2.0 ./frontend || goto :error
echo - Dang push todo-frontend:v2.0...
docker push %DOCKER_USER%/todo-frontend:v2.0 || goto :error

echo.
echo ===================================================
echo [THI CONG THANH CONG 100%%] Tat ca 4 Image da len Hub:
echo   - %DOCKER_USER%/todo-backend:v1.0
echo   - %DOCKER_USER%/todo-frontend:v1.0
echo   - %DOCKER_USER%/todo-backend:v2.0
echo   - %DOCKER_USER%/todo-frontend:v2.0
echo ===================================================
echo.
pause
exit /b 0

:error
echo.
echo [LOI] Co loi xay ra trong qua trinh build hoac push!
pause
exit /b 1
