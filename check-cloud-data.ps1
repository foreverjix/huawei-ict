$ErrorActionPreference = "Continue"

$WB  = "D:\华为ict\.arts\workbench\bin\workbench-windows-amd64\workbench.exe"
$IID = "i-f8z5xc0jglnyqor8p65p"

Write-Host "[1/2] 云端运行目录与 data" -ForegroundColor Cyan
& $WB exec -i $IID -c "echo '--- /opt/jinglang ---'; ls -lh /opt/jinglang; echo '--- data ---'; ls -lh /opt/jinglang/data 2>/dev/null; echo '--- uploads ---'; ls -lh /opt/jinglang/data/uploads 2>/dev/null; echo '--- env ---'; ls -l /opt/jinglang/.env 2>/dev/null"

Write-Host "[2/2] 接口当前返回的数据" -ForegroundColor Cyan
& $WB exec -i $IID -c "echo -n 'documents: '; curl -s http://127.0.0.1:8080/api/v1/documents | head -c 1500; echo; echo -n 'llm: '; curl -s http://127.0.0.1:8080/api/v1/llm/settings; echo"

Write-Host ""
Write-Host "如果 documents 里出现你本地的文档名，或 data 目录不为空，执行：.\purge-cloud-data.ps1 -Confirm" -ForegroundColor Yellow