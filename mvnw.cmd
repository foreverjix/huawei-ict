@echo off
setlocal enabledelayedexpansion

set "MVN_VERSION=3.9.9"
set "WRAPPER_HOME=%USERPROFILE%\.m2\wrapper\dists\apache-maven-%MVN_VERSION%"
set "MVN_HOME=%WRAPPER_HOME%\apache-maven-%MVN_VERSION%"

if not exist "%MVN_HOME%\bin\mvn.cmd" (
  echo Downloading Apache Maven %MVN_VERSION% ...
  if not exist "%WRAPPER_HOME%" mkdir "%WRAPPER_HOME%"
  powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MVN_VERSION%/apache-maven-%MVN_VERSION%-bin.zip' -OutFile '%WRAPPER_HOME%\maven.zip'; Expand-Archive -Path '%WRAPPER_HOME%\maven.zip' -DestinationPath '%WRAPPER_HOME%' -Force"
  if not exist "%MVN_HOME%\bin\mvn.cmd" (
    echo Failed to download Maven. Install Maven manually and run: mvn spring-boot:run
    exit /b 1
  )
)

call "%MVN_HOME%\bin\mvn.cmd" %*