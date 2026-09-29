$ErrorActionPreference = 'Stop'
$trackScenes = Get-Content -LiteralPath 'docs/track-b-narration.ko.json' -Raw -Encoding utf8 | ConvertFrom-Json
$trackAudio = Join-Path (Get-Location) 'artifacts/accord-lock/submission/narration'
New-Item -ItemType Directory -Force -Path $trackAudio | Out-Null
Add-Type -AssemblyName System.Speech
$trackVoice = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $trackVoice.SelectVoice('Microsoft Heami Desktop')
  $trackVoice.Rate = 1
  for ($trackIndex = 0; $trackIndex -lt $trackScenes.Count; $trackIndex++) {
    $trackVoice.SetOutputToWaveFile((Join-Path $trackAudio ("scene-{0}.wav" -f $trackIndex)))
    $trackVoice.Speak($trackScenes[$trackIndex].text)
    $trackVoice.SetOutputToNull()
    Write-Output ("Narrated scene {0}" -f ($trackIndex + 1))
  }
} finally { $trackVoice.Dispose() }
