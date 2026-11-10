param(
    [switch]$Confirm
)

$ErrorActionPreference = "Continue"

$WB  = "D:\华为ict\.arts\workbench\bin\workbench-windows-amd64\workbench.exe"
$IID = "i-f8z5xc0jglnyqor8p65p"
$JAR = "D:\华为ict\target\mindflow-0.0.1-SNAPSHOT.jar"
$STAMP = Get-Date -Format "yyyyMMdd-HHmmss"
$BACKUP = "/opt/jinglang/data-backup-$STAMP"

if (-not $Confirm) {
    Write-Host "这个脚本会：上传新 jar、停止服务、把云端 data 改名备份、重建空库。" -ForegroundColor Yellow
    Write-Host "确认执行：.\secure-redeploy.ps1 -Confirm" -ForegroundColor Yellow
    exit 0
}

if (-not (Test-Path $JAR)) {
    Write-Host "找不到 $JAR，请先打包" -ForegroundColor Red
    exit 1
}

Write-Host "[1/5] 上传新 jar（73MB）" -ForegroundColor Cyan
& $WB upload $JAR /opt/jinglang/app-new.jar --instance-id $IID

Write-Host "[2/5] 停服务并备份云端 data" -ForegroundColor Cyan
& $WB exec -i $IID -c "systemctl stop jinglang; if [ -d /opt/jinglang/data ]; then mv /opt/jinglang/data $BACKUP; fi; ls -ld /opt/jinglang/data* 2>/dev/null"

Write-Host "[3/5] 替换 jar 并启动（自动生成空库）" -ForegroundColor Cyan
& $WB exec -i $IID -c "mv -f /opt/jinglang/app-new.jar /opt/jinglang/app.jar; chown jinglang:jinglang /opt/jinglang/app.jar; systemctl start jinglang; sleep 22; systemctl is-active jinglang"

Write-Host "[4/5] 验证数据与代码版本" -ForegroundColor Cyan
& $WB exec -i $IID -c "echo -n 'documents: '; curl -s http://127.0.0.1:8080/api/v1/documents; echo; echo -n 'llm: '; curl -s http://127.0.0.1:8080/api/v1/llm/settings; echo; echo -n 'tide-fx: '; curl -s http://127.0.0.1:8080/app.js | grep -c tide-fx; echo -n 'jellyfish: '; curl -s http://127.0.0.1:8080/app.js | grep -c jellyfish; echo -n 'preload: '; curl -s http://127.0.0.1:8080/app.js | grep -c is-assets-ready; echo -n 'events: '; curl -s http://127.0.0.1:8080/app.js | grep -c buildEventPlan"

Write-Host "[5/5] 后续两件事" -ForegroundColor Yellow
Write-Host "1) 备份目录 $BACKUP 里仍有旧 key 与文档，确认页面正常后删除：" -ForegroundColor Yellow
Write-Host "   $WB exec -i $IID -c ""rm -rf $BACKUP""" -ForegroundColor Yellow
Write-Host "2) 到模型控制台吊销尾部 8557 的旧 key，生成新 key 后写入云端：" -ForegroundColor Yellow
Write-Host "   $WB exec -i $IID -c ""echo 'MINDFLOW_LLM_API_KEY=新key' > /opt/jinglang/.env; chown jinglang:jinglang /opt/jinglang/.env; chmod 600 /opt/jinglang/.env; systemctl restart jinglang""" -ForegroundColor Yellow