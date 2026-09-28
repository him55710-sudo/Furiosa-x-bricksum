$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$archiveRoot = Join-Path $projectRoot 'research/archive/learning'
New-Item -ItemType Directory -Force -Path $archiveRoot | Out-Null
$aprel = '13a1e7f7d93899682a414ce7812f4749dfcbf317'
$choix = '491d8ed9d59035f31049b047ff0d7b820f1c5b59'
$sources = @(
  @{id='L01';name='aprel-2108.07259v2.pdf';url='https://arxiv.org/pdf/2108.07259v2'},
  @{id='L02';name='astudillo-aistats-2020.pdf';url='https://proceedings.mlr.press/v108/astudillo20a/astudillo20a.pdf'},
  @{id='L03';name='bald-1112.5745v1.pdf';url='https://arxiv.org/pdf/1112.5745v1'},
  @{id='L04';name='causal-confusion-2204.06601v4.pdf';url='https://arxiv.org/pdf/2204.06601v4'},
  @{id='O01-user';name='aprel-user_models.py';url="https://raw.githubusercontent.com/Stanford-ILIAD/APReL/$aprel/aprel/learning/user_models.py"},
  @{id='O01-belief';name='aprel-belief_models.py';url="https://raw.githubusercontent.com/Stanford-ILIAD/APReL/$aprel/aprel/learning/belief_models.py"},
  @{id='O01-query';name='aprel-acquisition_functions.py';url="https://raw.githubusercontent.com/Stanford-ILIAD/APReL/$aprel/aprel/querying/acquisition_functions.py"},
  @{id='O01-license';name='aprel-LICENSE.txt';url="https://raw.githubusercontent.com/Stanford-ILIAD/APReL/$aprel/LICENSE"},
  @{id='O02-opt';name='choix-opt.py';url="https://raw.githubusercontent.com/lucasmaystre/choix/$choix/choix/opt.py"},
  @{id='O02-license';name='choix-LICENSE.txt';url="https://raw.githubusercontent.com/lucasmaystre/choix/$choix/LICENSE"}
)
$records = foreach ($source in $sources) {
  $target = Join-Path $archiveRoot $source.name
  try {
    if (Test-Path -LiteralPath $target) { throw "Existing file preserved: $($source.name)" }
    Invoke-WebRequest -Uri $source.url -OutFile $target -TimeoutSec 30
    $bytes = [System.IO.File]::ReadAllBytes($target)
    if ($source.name.EndsWith('.pdf') -and [System.Text.Encoding]::ASCII.GetString($bytes,0,[Math]::Min(5,$bytes.Length)) -ne '%PDF-') { throw 'Not a PDF' }
    [ordered]@{id=$source.id;url=$source.url;file=('../research/archive/learning/'+$source.name);status='saved';bytes=$bytes.Length;sha256=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant();retrievedAtUtc=[DateTime]::UtcNow.ToString('o')}
  } catch {
    [ordered]@{id=$source.id;url=$source.url;file=('../research/archive/learning/'+$source.name);status='failed';error=$_.Exception.Message}
  }
}
$manifest = Join-Path $PSScriptRoot 'source-manifest.json'
if (Test-Path -LiteralPath $manifest) { $manifest = Join-Path $PSScriptRoot ('source-manifest-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'.json') }
ConvertTo-Json -InputObject @($records) -Depth 5 | Set-Content -LiteralPath $manifest -Encoding utf8
$records | ForEach-Object { [pscustomobject]$_ } | Select-Object id,status,bytes | Format-Table -AutoSize
