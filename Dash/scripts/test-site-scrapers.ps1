# Test all 5 board edge functions (ScrapingBee -> scraped_jobs)
# Requires service_role JWT. NOT sb_publishable_* keys.
#
#   $env:SUPABASE_URL = "https://eqkctzjyqmafpytvdepf.supabase.co"
#   $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ...service_role..."
#   .\scripts\test-site-scrapers.ps1 -Site all -Limit 2
#
# One board only:
#   .\scripts\test-site-scrapers.ps1 -Site fuzu -Limit 2

param(
  [ValidateSet("all", "fuzu", "brightermonday", "myjobmag", "myjobsinkenya", "linkedin")]
  [string[]]$Site = @("all"),
  [int]$Limit = 2,
  [string]$ProjectUrl = $env:SUPABASE_URL,
  [string]$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY
)

$ErrorActionPreference = "Continue"

$AllBoards = @("fuzu", "brightermonday", "myjobmag", "myjobsinkenya", "linkedin")

$FunctionMap = @{
  fuzu           = "scrape-fuzu"
  brightermonday = "scrape-brightermonday"
  myjobmag       = "scrape-myjobmag"
  myjobsinkenya  = "scrape-myjobsinkenya"
  linkedin       = "scrape-linkedin"
}

if (-not $ProjectUrl) {
  $ProjectUrl = "https://eqkctzjyqmafpytvdepf.supabase.co"
}
$ProjectUrl = $ProjectUrl.TrimEnd("/")

if (-not $ServiceRoleKey) {
  Write-Host "Missing SUPABASE_SERVICE_ROLE_KEY. Dashboard -> Settings -> API -> service_role" -ForegroundColor Yellow
  exit 1
}

if ($ServiceRoleKey -match "^sb_publishable") {
  Write-Error "Use service_role (eyJ...), not sb_publishable_* keys."
}

# Edge functions cap at 5 jobs/run by default (SCRAPER_MAX_JOBS_PER_RUN) to avoid timeout.
$requestedLimit = $Limit
$Limit = [Math]::Max(1, [Math]::Min(5, $Limit))
if ($requestedLimit -gt 5) {
  Write-Host "Note: limit $requestedLimit capped to 5 per board (edge timeout). Cron uses 5-12 via SCRAPER_MAX_JOBS_PER_RUN." -ForegroundColor Yellow
}
$resultsDir = Join-Path $PSScriptRoot "scraper-test-results"
New-Item -ItemType Directory -Force -Path $resultsDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

function Invoke-Scraper {
  param([string]$FunctionName)

  $url = "$ProjectUrl/functions/v1/${FunctionName}?limit=$Limit"
  $headers = @{
    Authorization  = "Bearer $ServiceRoleKey"
    apikey         = $ServiceRoleKey
    "Content-Type" = "application/json"
  }

  Write-Host ""
  Write-Host "POST $url" -ForegroundColor Cyan
  $start = Get-Date
  $httpCode = 0
  $jsonText = ""

  try {
    $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body "{}" -UseBasicParsing -TimeoutSec 600
    $httpCode = [int]$response.StatusCode
    $jsonText = $response.Content
  } catch {
    if ($_.Exception.Response) {
      $httpCode = [int]$_.Exception.Response.StatusCode.value__
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $jsonText = $reader.ReadToEnd()
      $reader.Close()
    } else {
      Write-Host $_.Exception.Message -ForegroundColor Red
      return 0
    }
  }

  $outFile = Join-Path $resultsDir "$stamp-$FunctionName.json"
  if ($jsonText) {
    try {
      ($jsonText | ConvertFrom-Json) | ConvertTo-Json -Depth 12 | Set-Content -Path $outFile -Encoding utf8
    } catch {
      Set-Content -Path $outFile -Value $jsonText -Encoding utf8
    }
  }

  $elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds, 1)
  $color = if ($httpCode -eq 200) { "Green" } elseif ($httpCode -eq 401) { "Yellow" } else { "Red" }
  Write-Host "HTTP $httpCode (${elapsed}s) saved: $outFile" -ForegroundColor $color
  if ($jsonText) { Write-Host $jsonText }
  return $httpCode
}

Write-Host "Site scraper test, limit $Limit per board" -ForegroundColor White
Write-Host "Project: $ProjectUrl"

$runSites = if ($Site -contains "all") { $AllBoards } else { $Site }
Write-Host "Functions: $($runSites -join ', ')" -ForegroundColor White

$failed = 0
foreach ($s in $runSites) {
  if (-not $FunctionMap.ContainsKey($s)) {
    Write-Warning "Unknown site: $s"
    continue
  }
  if ((Invoke-Scraper $FunctionMap[$s]) -ne 200) { $failed++ }
}

Write-Host ""
if ($failed -eq 0) {
  Write-Host "Done. Check scraped_jobs in Supabase Table Editor." -ForegroundColor Green
} else {
  Write-Host "$failed request(s) failed. Redeploy scrapers after auth fix, or refresh service_role key." -ForegroundColor Yellow
}
exit $failed
