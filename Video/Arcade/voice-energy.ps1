Add-Type -AssemblyName System.Speech
$outDir = Join-Path $PSScriptRoot 'build-energy'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$parts = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'narration-energy.json') -Raw | ConvertFrom-Json
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice('Microsoft Zira Desktop')
try {
    for ($i = 0; $i -lt $parts.Count; $i++) {
        $safeText = [System.Security.SecurityElement]::Escape($parts[$i].text)
        $safeText = $safeText.Replace('one million content views!', '<emphasis level="strong">one million content views!</emphasis>')
        $safeText = $safeText.Replace('Now we build!', '<emphasis level="strong">Now we build!</emphasis>')
        $safeText = $safeText.Replace('we&apos;re live!', '<emphasis level="strong">we&apos;re live!</emphasis>')
        $ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><prosody rate="+14%" pitch="+8%" volume="95">' + $safeText + '</prosody></speak>'
        $speaker.SetOutputToWaveFile((Join-Path $outDir "voice-$i.wav"))
        $speaker.SpeakSsml($ssml)
        $speaker.SetOutputToNull()
    }
} finally { $speaker.Dispose() }
