$ErrorActionPreference = 'Stop'
$researchRoot = Split-Path $PSScriptRoot -Parent
$archiveRoot = Join-Path $researchRoot 'archive'
New-Item -ItemType Directory -Force -Path $archiveRoot | Out-Null
$sources = @(
    @{ id='D02'; name='kiln-models.md'; url='https://kiln.bricksum.com/docs/en/md/models.md' },
    @{ id='D03'; name='kiln-chat-completions.md'; url='https://kiln.bricksum.com/docs/en/md/api-reference/chat-completions.md' },
    @{ id='D05'; name='kiln-usage-billing.md'; url='https://kiln.bricksum.com/docs/en/md/usage-billing.md' },
    @{ id='P01'; name='agentdojo-2024.pdf'; url='https://arxiv.org/pdf/2406.13352v3' },
    @{ id='P02'; name='camel-2025.pdf'; url='https://arxiv.org/pdf/2503.18813v2' },
    @{ id='P03'; name='energy-considerations-acl-2025.pdf'; url='https://aclanthology.org/2025.acl-long.1563.pdf' },
    @{ id='P04'; name='pagedattention-2023.pdf'; url='https://arxiv.org/pdf/2309.06180v1' },
    @{ id='P05'; name='blockaudit-2019.pdf'; url='https://arxiv.org/pdf/1907.10484' }
)
$records = foreach ($source in $sources) {
    $target = Join-Path $archiveRoot $source.name
    try {
        if (Test-Path -LiteralPath $target) { throw "Target already exists; preserve existing archive: $($source.name)" }
        Invoke-WebRequest -Uri $source.url -OutFile $target -TimeoutSec 45
        $bytes = [System.IO.File]::ReadAllBytes($target)
        if ($source.name.EndsWith('.pdf') -and [System.Text.Encoding]::ASCII.GetString($bytes,0,[Math]::Min(5,$bytes.Length)) -ne '%PDF-') {
            throw 'Downloaded content is not a PDF'
        }
        [ordered]@{ id=$source.id; url=$source.url; file=('archive/'+$source.name); retrieved_at_utc=[DateTime]::UtcNow.ToString('o'); status='saved'; bytes=$bytes.Length; sha256=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() }
    } catch {
        [ordered]@{ id=$source.id; url=$source.url; file=('archive/'+$source.name); retrieved_at_utc=[DateTime]::UtcNow.ToString('o'); status='failed'; error=$_.Exception.Message }
    }
}
$manifest = Join-Path $researchRoot 'archive-manifest.json'
if (Test-Path -LiteralPath $manifest) { $manifest = Join-Path $researchRoot ('archive-manifest-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'.json') }
ConvertTo-Json -InputObject @($records) -Depth 6 | Set-Content -LiteralPath $manifest -Encoding utf8
$records | ForEach-Object { [pscustomobject]$_ } | Select-Object id,status,bytes,file | Format-Table -AutoSize
