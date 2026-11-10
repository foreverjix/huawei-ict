@echo off
cd /d "%~dp0"
set "NODE=C:\Users\yuyuy\.codearts\runtimes\node\node.exe"
if not exist "%NODE%" set "NODE=node"
start "" "http://127.0.0.1:8141/"
"%NODE%" ".arts\dev-server.mjs"