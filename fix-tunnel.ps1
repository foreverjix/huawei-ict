$ErrorActionPreference = "Continue"

$WB  = "D:\华为ict\.arts\workbench\bin\workbench-windows-amd64\workbench.exe"
$IID = "i-f8z5xc0jglnyqor8p65p"
$CF  = "D:\华为ict\.arts\cloudflared-linux-amd64"

if (-not (Test-Path $CF)) {
    Write-Host "找不到 $CF，请先确认文件已下载（约 38MB）" -ForegroundColor Red
    exit 1
}

Write-Host "[1/4] 上传到 /tmp（避免 /usr/local/bin 写权限问题）" -ForegroundColor Cyan
& $WB upload $CF /tmp/cloudflared --instance-id $IID

Write-Host "[2/4] 移动到 /usr/local/bin 并赋执行权限" -ForegroundColor Cyan
& $WB exec -i $IID -c "mv -f /tmp/cloudflared /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared && ls -lh /usr/local/bin/cloudflared && /usr/local/bin/cloudflared --version"

Write-Host "[3/4] 重启隧道服务" -ForegroundColor Cyan
& $WB exec -i $IID -c "systemctl daemon-reload && systemctl restart jinglang-tunnel && sleep 14 && systemctl is-active jinglang-tunnel"

Write-Host "[4/4] 提取公网 HTTPS 地址" -ForegroundColor Cyan
& $WB exec -i $IID -c "journalctl -u jinglang-tunnel --no-pager -n 150 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1"

Write-Host ""
Write-Host "上面那行 https 地址就是给别人用的入口；如果为空，说明隧道还没连上，稍等 10 秒重跑第 4 步。" -ForegroundColor Yellow