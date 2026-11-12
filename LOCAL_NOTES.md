# Local Environment Notes

## OS Environment
- **Operating System:** Windows (Windows 11 / Windows PowerShell & cmd)
- **Python Version:** 3.13.3 (C:\Python313\python.exe)
- **Node Version:** v25.0.0 (C:\Program Files\nodejs\node.exe)
- **npm Version:** 11.6.2 (C:\Program Files\nodejs\npm.ps1)
- **Git Version:** 2.51.0.windows.2 (C:\Program Files\Git\cmd\git.exe)

---

## Virtual Environment Activation
To activate the virtual environment created at `backend/.venv` on Windows:

### PowerShell
```powershell
.\backend\.venv\Scripts\Activate.ps1
```
*(If PowerShell script execution is restricted, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` or use cmd)*

### Command Prompt (cmd)
```cmd
backend\.venv\Scripts\activate.bat
```

### Git Bash
```bash
source backend/.venv/Scripts/activate
```

---

## Finding and Hard-Killing Processes on Windows

### 1. Find process by port (e.g. port 8000)
```powershell
netstat -ano | findstr :8000
```
or in PowerShell directly:
```powershell
Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess
```

### 2. Hard-kill a process (equivalent of `kill -9 <pid>`)
```cmd
taskkill /F /PID <pid>
```
or in PowerShell:
```powershell
Stop-Process -Id <pid> -Force
```
*(Example: if `netstat -ano | findstr :8000` shows PID 12345, run `taskkill /F /PID 12345`)*
