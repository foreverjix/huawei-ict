$ErrorActionPreference = "Continue"

$WB  = "D:\华为ict\.arts\workbench\bin\workbench-windows-amd64\workbench.exe"
$IID = "i-f8z5xc0jglnyqor8p65p"
$LOG = "/opt/jinglang/logs"

Write-Host "[1/5] 日志文件是否存在" -ForegroundColor Cyan
& $WB exec -i $IID -c "ls -lh $LOG 2>/dev/null || echo NO_LOG"

Write-Host "[2/5] 总请求数（PV，包含图片/JS/音频）" -ForegroundColor Cyan
& $WB exec -i $IID -c "cat $LOG/access*.log 2>/dev/null | wc -l"

Write-Host "[3/5] 独立 IP 数（近似访客数 UV）" -ForegroundColor Cyan
& $WB exec -i $IID -c "cut -d' ' -f1 $LOG/access*.log 2>/dev/null | sort -u | wc -l"

Write-Host "[4/5] 打开首页的独立 IP（排除静态资源）" -ForegroundColor Cyan
& $WB exec -i $IID -c "grep -vE '\.(js|css|png|jpg|mp3|wasm|mjs|json|ico)' $LOG/access*.log 2>/dev/null | grep 'GET / ' | cut -d' ' -f1 | sort -u | wc -l"

Write-Host "[5/5] 最近 5 条记录（看第一列是公网 IP 还是 127.0.0.1）" -ForegroundColor Cyan
& $WB exec -i $IID -c "tail -5 $LOG/access*.log 2>/dev/null"

Write-Host ""
Write-Host "如果 [1/5] 显示 NO_LOG，说明 enable-accesslog.ps1 还没跑成功。" -ForegroundColor Yellow
Write-Host "如果 [5/5] 第一列全是 127.0.0.1，说明隧道回源没透传真实 IP，需要改用 CF-Connecting-IP。" -ForegroundColor Yellow