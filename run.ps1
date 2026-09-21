$flask = Start-Process -FilePath ".\.venv\Scripts\python.exe" `
-ArgumentList ".\app.py" -NoNewWindow `
-PassThru

$vite = Start-Process -FilePath "npm.cmd" `
-ArgumentList "run", "dev" -NoNewWindow -PassThru

try {
    while (!$flask.HasExited -and !$vite.HasExited) {
        Start-Sleep -Milliseconds 500
    }
}
finally {
    Write-Host ""
    Write-Host "Stopping application..."

    if (!$flask.HasExited) {
        taskkill /PID $flask.Id /T /F 2>$null
    }

    if (!$vite.HasExited) {
        taskkill /PID $vite.Id /T /F 2>$null
    }

    Write-Host "Application stopped."

}