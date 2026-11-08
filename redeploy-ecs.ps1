$ErrorActionPreference = "Continue"

$WB  = "D:\华为ict\.arts\workbench\bin\workbench-windows-amd64\workbench.exe"
$IID = "i-f8z5xc0jglnyqor8p65p"
$JAR = "D:\华为ict\target\mindflow-0.0.1-SNAPSHOT.jar"

if (-not (Test-Path $JAR)) {
    Write-Host "找不到 $JAR，请先在项目根目录打包" -ForegroundColor Red
    exit 1
}

Write-Host "[1/3] 上传新 jar（67MB，约 1-3 分钟）" -ForegroundColor Cyan
& $WB upload $JAR /opt/jinglang/app-new.jar --instance-id $IID

Write-Host "[2/3] 替换 jar 并重启服务" -ForegroundColor Cyan
& $WB exec -i $IID -c "systemctl stop jinglang; mv -f /opt/jinglang/app-new.jar /opt/jinglang/app.jar; chown jinglang:jinglang /opt/jinglang/app.jar; systemctl start jinglang; sleep 22; systemctl is-active jinglang"

Write-Host "[3/3] 验证接口与新前端是否生效" -ForegroundColor Cyan
& $WB exec -i $IID -c "curl -s -o /dev/null -w 'skills:%{http_code}\n' http://127.0.0.1:8080/api/v1/skills; curl -s -o /dev/null -w 'index:%{http_code}\n' http://127.0.0.1:8080/; echo -n 'cameraReady:'; curl -s http://127.0.0.1:8080/app.js | grep -c cameraReady; echo -n 'hud-music:'; curl -s http://127.0.0.1:8080/index.html | grep -c hud-music"

Write-Host ""
Write-Host "skills/index 都是 200，且 cameraReady、hud-music 都 >=1，说明新版本已生效。" -ForegroundColor Green
Write-Host "公网访问：http://47.113.179.219:8080" -ForegroundColor Yellow