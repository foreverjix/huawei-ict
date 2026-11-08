$ErrorActionPreference = "Continue"

$WB  = "D:\华为ict\.arts\workbench\bin\workbench-windows-amd64\workbench.exe"
$IID = "i-f8z5xc0jglnyqor8p65p"
$UNIT = "D:\华为ict\.arts\jinglang.service"

Write-Host "[1/4] 准备日志目录" -ForegroundColor Cyan
& $WB exec -i $IID -c "mkdir -p /opt/jinglang/logs && chown -R jinglang:jinglang /opt/jinglang/logs && echo dir-ready"

Write-Host "[2/4] 写入带 access log 与真实 IP 透传的 systemd 服务" -ForegroundColor Cyan
$unitText = @"
[Unit]
Description=Jinglang (MindFlow) demo service
After=network.target

[Service]
User=jinglang
WorkingDirectory=/opt/jinglang
ExecStart=/usr/bin/java -Xms128m -Xmx400m -Xss256k -jar /opt/jinglang/app.jar --server.port=8080 --server.address=0.0.0.0 --server.tomcat.accesslog.enabled=true --server.tomcat.accesslog.directory=/opt/jinglang/logs --server.tomcat.accesslog.prefix=access --server.tomcat.accesslog.suffix=.log --server.tomcat.accesslog.pattern=combined --server.tomcat.accesslog.buffered=false --server.tomcat.accesslog.rotate=true --server.tomcat.remoteip.remote-ip-header=X-Forwarded-For --server.tomcat.remoteip.internal-proxies=.*
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"@
[System.IO.File]::WriteAllText($UNIT, $unitText.Replace("`r`n", "`n"), (New-Object System.Text.UTF8Encoding($false)))
& $WB upload $UNIT /etc/systemd/system/jinglang.service --instance-id $IID

Write-Host "[3/4] 重启服务（约 20 秒不可用）" -ForegroundColor Cyan
& $WB exec -i $IID -c "systemctl daemon-reload && systemctl restart jinglang && sleep 20 && systemctl is-active jinglang"

Write-Host "[4/4] 产生测试访问并检查日志首列" -ForegroundColor Cyan
& $WB exec -i $IID -c "curl -s -o /dev/null http://127.0.0.1:8080/ ; sleep 2; ls -lh /opt/jinglang/logs/; echo ---; tail -2 /opt/jinglang/logs/access.log* 2>/dev/null"

Write-Host ""
Write-Host "日志目录：/opt/jinglang/logs/（按天滚动，access.YYYY-MM-DD.log）" -ForegroundColor Green
Write-Host ""
Write-Host "看上面日志的第一列：" -ForegroundColor Yellow
Write-Host "  是公网 IP   -> 统计可用，直接按 IP 去重"
Write-Host "  是 127.0.0.1 -> 说明走了隧道回源且没拿到 X-Forwarded-For"
Write-Host "                  把参数改成 --server.tomcat.remoteip.remote-ip-header=CF-Connecting-IP 再跑一次"
Write-Host ""
Write-Host "统计独立访客（把 <IID> 换成实例 ID）：" -ForegroundColor Yellow
Write-Host '  & "D:\华为ict\.arts\workbench\bin\workbench-windows-amd64\workbench.exe" exec -i <IID> -c "awk ''{print \$1}'' /opt/jinglang/logs/access.log* | sort -u | wc -l"'