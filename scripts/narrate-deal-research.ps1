$ErrorActionPreference='Stop'
$researchOutput=Join-Path (Get-Location) 'artifacts/deal-escrow/research'
$showcase=Get-Content -LiteralPath (Join-Path $researchOutput 'latest-showcase.json') -Raw -Encoding utf8 | ConvertFrom-Json
$audioDirectory=Join-Path $researchOutput 'narration'
New-Item -ItemType Directory -Force -Path $audioDirectory | Out-Null
Add-Type -AssemblyName System.Speech
$narrator=New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $narrator.SelectVoice('Microsoft Heami Desktop')
  $narrator.Rate=1
  for($i=0;$i -lt $showcase.steps.Count;$i++) {
    $wav=Join-Path $audioDirectory ("step-{0}.wav" -f $i)
    $narrator.SetOutputToWaveFile($wav)
    $narrator.Speak($showcase.steps[$i].narration)
    $narrator.SetOutputToNull()
    Write-Output ("Narrated scene {0}/{1}" -f ($i+1),$showcase.steps.Count)
  }
} finally { $narrator.Dispose() }
