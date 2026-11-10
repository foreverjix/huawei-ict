param(
    [switch]$Confirm
)

$ErrorActionPreference = "Continue"

$WB  = "D:\华为ict\.arts\workbench\bin\workbench-windows-amd64\workbench.exe"
$IID = "i-f8z5xc0jglnyqor8p65p"
$STAMP = Get-Date -Format "yyyyMMdd-HHmmss"

if (-not $Confirm) {
    Write-Host "破坏性操作：停止服务、把云端 data 目录改名备份、重建空库。" -ForegroundColor Yellow
    Write-Host "确认执行：.\purge-cloud-data.ps1 -Confirm" -ForegroundColor Yellow
    exit 0
}

Write-Host "[1/4] 停止服务并备份 data" -ForegroundColor Cyan
& $WB exec -i $IID -c "systemctl stop jinglang; if [ -d /opt/jinglang/data ]; then mv /opt/jinglang/data /opt/jinglang/data-backup-$STAMP; fi; ls -ld /opt/jinglang/data* 2>/dev/null"

Write-Host "[2/4] 启动服务并等待空库生成" -ForegroundColor Cyan
& $WB exec -i $IID -c "systemctl start jinglang; sleep 22; systemctl is-active jinglang"

Write-Host "[3/4] 验证文档与 LLM 设置" -ForegroundColor Cyan
& $WB exec -i $IID -c "echo -n 'documents: '; curl -s http://127.0.0.1:8080/api/v1/documents; echo; echo -n 'llm: '; curl -s http://127.0.0.1:8080/api/v1/llm/settings; echo"

Write-Host "[4/4] 备份仍在云端磁盘上，确认无误后删除：" -ForegroundColor Yellow
Write-Host "  $WB exec -i $IID -c ""rm -rf /opt/jinglang/data-backup-$STAMP""" -ForegroundColor Yellow
Write-Host ""
Write-Host "必须同时做：到模型控制台吊销旧 API Key 并重新生成。" -ForegroundColor Red