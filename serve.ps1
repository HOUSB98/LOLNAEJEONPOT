# 설치 없이 로컬에서 미리보기: 이 파일을 우클릭 > "PowerShell에서 실행" 후 http://localhost:5173 접속
param([int]$Port = 5173)
$root = $PSScriptRoot
$mime = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.png' = 'image/png'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon' }
$l = [System.Net.HttpListener]::new()
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "http://localhost:$Port  (Ctrl+C 로 종료)"
while ($l.IsListening) {
  $c = $l.GetContext()
  try {
    $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath)
    if ($p -eq '/') { $p = '/index.html' }
    $f = [IO.Path]::GetFullPath((Join-Path $root $p.TrimStart('/')))
    if ($f.StartsWith($root) -and (Test-Path $f -PathType Leaf)) {
      $b = [IO.File]::ReadAllBytes($f)
      $t = $mime[[IO.Path]::GetExtension($f).ToLower()]
      if ($t) { $c.Response.ContentType = $t }
      $c.Response.Headers['Cache-Control'] = 'no-store'
      $c.Response.OutputStream.Write($b, 0, $b.Length)
    } else { $c.Response.StatusCode = 404 }
  } catch { $c.Response.StatusCode = 500 }
  $c.Response.Close()
}
