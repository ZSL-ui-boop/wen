function Stop-ListenerOnPort {
  param([int]$Port, [string]$Label)
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $conn) {
    Write-Host "Port $Port ($Label) is free."
    return $true
  }
  $procId = $conn.OwningProcess
  try {
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Write-Host "Stopped PID $procId on port $Port ($Label)."
    return $true
  } catch {
    Write-Host "Could not stop PID $procId on port $Port ($Label): $_"
    Write-Host "Try: right-click PowerShell -> Run as administrator, then run this script again."
    Write-Host "Or use Task Manager to end the process manually."
    return $false
  }
}

$ok8080 = Stop-ListenerOnPort -Port 8080 -Label "Spring Boot"
# JOD / LibreOffice listens here; a leftover soffice.bin blocks the next backend start.
$ok2002 = Stop-ListenerOnPort -Port 2002 -Label "LibreOffice (JOD preview)"

if ($ok8080 -and $ok2002) {
  exit 0
}
exit 1
