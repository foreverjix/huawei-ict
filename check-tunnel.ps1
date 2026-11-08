$ErrorActionPreference = "Continue"

$WB  = "D:\华为ict\.arts\workbench\bin\workbench-windows-amd64\workbench.exe"
$IID = "i-f8z5xc0jglnyqor8p65p"

Write-Host "[1/4] 二进制是否存在" -ForegroundColor Cyan
& $WB exec -i $IID -c "ls -lh /usr/local/bin/cloudflared 2>/dev/null || echo MISSING"

Write-Host "[2/4] 服务状态" -ForegroundColor Cyan
& $WB exec -i $IID -c "systemctl is-active jinglang-tunnel; echo ---; systemctl status jinglang-tunnel --no-pager -l | head -18"

Write-Host "[3/4] 最近日志" -ForegroundColor Cyan
& $WB exec -i $IID -c "journalctl -u jinglang-tunnel -n 30 --no-pager"

Write-Host "[4/4] 重启并取最新公网地址" -ForegroundColor Cyan
& $WB exec -i $IID -c "systemctl restart jinglang-tunnel; sleep 15; systemctl is-active jinglang-tunnel; journalctl -u jinglang-tunnel --no-pager -n 120 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1"

Write-Host ""
Write-Host "判断方法：" -ForegroundColor Yellow
Write-Host "  [1] 显示 MISSING        -> 二进制没传上去，需要先跑 fix-tunnel2.ps1"
Write-Host "  [2] 显示 failed/activating -> 二进制在但启动失败，看 [3] 的报错"
Write-Host "  [4] 最后一行有 https 地址 -> 那就是当前可用的新地址（旧地址已失效）"