$ErrorActionPreference = "Continue"

$WB  = "D:\华为ict\.arts\workbench\bin\workbench-windows-amd64\workbench.exe"
$IID = "i-f8z5xc0jglnyqor8p65p"
$JAR = "D:\华为ict\target\mindflow-0.0.1-SNAPSHOT.jar"
$UNIT = "D:\华为ict\.arts\jinglang.service"

function Step($n, $t) {
    Write-Host ""
    Write-Host "[$n] $t" -ForegroundColor Cyan
}

if (-not (Test-Path $JAR)) {
    Write-Host "找不到 jar：$JAR" -ForegroundColor Red
    Write-Host "请先在项目根目录执行打包，或用已生成的 target\mindflow-0.0.1-SNAPSHOT.jar"
    exit 1
}

Step "0/6" "测试与实例的连通性"
& $WB exec -i $IID -c "echo connected; uname -m"
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "本机也连不上实例。请改用控制台「远程连接 -> Workbench」网页终端手动执行。" -ForegroundColor Yellow
    exit 2
}

Step "1/6" "检查实例环境（系统 / 内存 / 磁盘 / Java）"
& $WB exec -i $IID -c "head -2 /etc/os-release; free -m | head -2; df -h / | tail -1; (java -version 2>&1 | head -1) || echo no-java"

Step "2/6" "创建目录与应用用户"
& $WB exec -i $IID -c "mkdir -p /opt/jinglang/data && (id jinglang >/dev/null 2>&1 || useradd -r -s /sbin/nologin jinglang) && chown -R jinglang:jinglang /opt/jinglang && echo dir-ready"

Step "3/6" "上传 jar（67MB，约 1-3 分钟）"
& $WB upload $JAR /opt/jinglang/app.jar --instance-id $IID
& $WB exec -i $IID -c "chown jinglang:jinglang /opt/jinglang/app.jar && ls -lh /opt/jinglang/app.jar"

Step "4/6" "安装 JDK 17（优先走内网镜像源）"
& $WB exec -i $IID --timeout 900 -c "if ! command -v java >/dev/null 2>&1; then cp /etc/apt/sources.list /etc/apt/sources.list.bak 2>/dev/null; sed -i 's|http://archive.ubuntu.com|http://mirrors.cloud.aliyuncs.com|g; s|http://security.ubuntu.com|http://mirrors.cloud.aliyuncs.com|g' /etc/apt/sources.list; apt-get update -y 2>&1 | tail -3; DEBIAN_FRONTEND=noninteractive apt-get install -y openjdk-17-jre-headless 2>&1 | tail -5; fi; java -version 2>&1 | head -1"

Step "5/6" "写入 systemd 服务并启动"
$unitText = @"
[Unit]
Description=Jinglang (MindFlow) demo service
After=network.target

[Service]
User=jinglang
WorkingDirectory=/opt/jinglang
ExecStart=/usr/bin/java -Xms128m -Xmx400m -Xss256k -jar /opt/jinglang/app.jar --server.port=8080 --server.address=0.0.0.0
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"@
[System.IO.File]::WriteAllText($UNIT, $unitText.Replace("`r`n", "`n"), (New-Object System.Text.UTF8Encoding($false)))
& $WB upload $UNIT /etc/systemd/system/jinglang.service --instance-id $IID
& $WB exec -i $IID --timeout 120 -c "systemctl daemon-reload && systemctl enable --now jinglang && sleep 20 && systemctl is-active jinglang && systemctl status jinglang --no-pager | head -12"

Step "6/6" "服务器内自测接口"
& $WB exec -i $IID -c "curl -s -o /dev/null -w 'skills:%{http_code}\n' http://127.0.0.1:8080/api/v1/skills; curl -s -o /dev/null -w 'index:%{http_code}\n' http://127.0.0.1:8080/"

Write-Host ""
Write-Host "部署结束。若上面 skills/index 都是 200，说明服务已在实例内跑起来。" -ForegroundColor Green
Write-Host ""
Write-Host "要让浏览器访问，还需要二选一：" -ForegroundColor Yellow
Write-Host "  A. 控制台给实例绑定一个按量付费的弹性公网 IP，并在安全组放行 8080"
Write-Host "  B. 用控制台「远程连接 -> Workbench」里的端口转发功能映射 8080"
Write-Host ""
Write-Host "查看日志：& `"$WB`" exec -i $IID -c `"journalctl -u jinglang -n 50 --no-pager`""