$ErrorActionPreference = "Continue"

$WB  = "D:\华为ict\.arts\workbench\bin\workbench-windows-amd64\workbench.exe"
$IID = "i-f8z5xc0jglnyqor8p65p"
$CF  = "D:\华为ict\.arts\cloudflared-linux-amd64"
$UNIT = "D:\华为ict\.arts\jinglang-tunnel.service"

if (-not (Test-Path $CF)) {
    Write-Host "下载 cloudflared Linux 版（约 40MB）..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" -OutFile $CF -UseBasicParsing
    } catch {
        Write-Host "本机下载失败：$($_.Exception.Message)" -ForegroundColor Red
        Write-Host "请开启代理后重试，或手动下载该文件放到 $CF" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "[1/4] 上传 cloudflared" -ForegroundColor Cyan
& $WB upload $CF /usr/local/bin/cloudflared --instance-id $IID
& $WB exec -i $IID -c "chmod +x /usr/local/bin/cloudflared && /usr/local/bin/cloudflared --version"

Write-Host "[2/4] 写入 systemd 服务" -ForegroundColor Cyan
$unitText = @"
[Unit]
Description=Cloudflare quick tunnel for Jinglang
After=network.target jinglang.service

[Service]
ExecStart=/usr/local/bin/cloudflared tunnel --url http://localhost:8080 --no-autoupdate
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"@
[System.IO.File]::WriteAllText($UNIT, $unitText.Replace("`r`n", "`n"), (New-Object System.Text.UTF8Encoding($false)))
& $WB upload $UNIT /etc/systemd/system/jinglang-tunnel.service --instance-id $IID

Write-Host "[3/4] 启动隧道" -ForegroundColor Cyan
& $WB exec -i $IID -c "systemctl daemon-reload && systemctl enable --now jinglang-tunnel && sleep 12 && systemctl is-active jinglang-tunnel"

Write-Host "[4/4] 提取公网 HTTPS 地址" -ForegroundColor Cyan
& $WB exec -i $IID -c "journalctl -u jinglang-tunnel --no-pager -n 120 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1"

Write-Host ""
Write-Host "上面输出的 https 地址就是给别人用的入口。" -ForegroundColor Green
Write-Host "注意：隧道重启后 URL 会变，重新执行第 4 步即可取新地址。" -ForegroundColor Yellow
Write-Host "确认可用后，可以把安全组里的 8080 入方向规则删掉。" -ForegroundColor Yellow