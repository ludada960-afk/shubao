#!/usr/bin/env pwsh
# 4c183cd4 续命: DSH 客户端 build + 图片批注注入 + 重启
# 主线程做完, 您跑这个

Write-Host "=== 4c183cd4 续命: 孪生体生效 (modlens + 图片批注) ==="
Write-Host ""

# 1. DSH 客户端 build
Write-Host "[1/3] DSH 客户端 build..."
Set-Location C:\\Users\\SHEJI\\.dsh
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "build failed"; exit 1 }

# 2. 图片批注注入
Write-Host "[2/3] 图片批注注入 (anno_source.js.txt)..."
Set-Location C:\\Users\\SHEJI\\.dsh\\annotation-patch
node rebuild.cjs
if ($LASTEXITCODE -ne 0) { Write-Error "inject failed"; exit 1 }

# 3. 重启 DSH (主线程不替您做, 给提示)
Write-Host "[3/3] 请手动重启 DSH:"
Write-Host "  - 关闭当前 dsh web 的父 PowerShell (Ctrl+C)"
Write-Host "  - 在新 PowerShell 跑: dsh web"
Write-Host "  - 或: C:\\Users\\SHEJI\\AppData\\Roaming\\npm\\node_modules\\@deepseek-ai\\dsh\\lib\\bin.js web"
Write-Host ""
Write-Host "重启后, MiniMax-M3 切 (modlens vision) 孪生项, 粘图 -> 暗色灯箱 -> 标注 -> 写回"
