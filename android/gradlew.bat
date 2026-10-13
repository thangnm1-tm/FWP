@rem Gradle startup script for Windows
@echo off
set DIR=%~dp0
if not defined JAVA_HOME (
    if exist "%USERPROFILE%\.jdks\jbr-21.0.11\bin\java.exe" (
        set "JAVA_HOME=%USERPROFILE%\.jdks\jbr-21.0.11"
    ) else if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" (
        set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
    )
)
"%JAVA_HOME%\bin\java.exe" -classpath "%DIR%gradle\wrapper\gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain %*
