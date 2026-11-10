Add-Type -AssemblyName System.Speech
$outDir = Join-Path $PSScriptRoot 'build'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$scriptParts = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'narration.json') -Raw | ConvertFrom-Json
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice('Microsoft Zira Desktop')
$speaker.Rate = 1
try {
    for ($i = 0; $i -lt $scriptParts.Count; $i++) {
        $speaker.SetOutputToWaveFile((Join-Path $outDir "voice-$i.wav"))
        $speaker.Speak($scriptParts[$i].text)
        $speaker.SetOutputToNull()
    }
} finally { $speaker.Dispose() }
