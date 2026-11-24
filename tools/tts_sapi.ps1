# tts_sapi.ps1: synthesize SSML jobs with Windows built-in SAPI voices (placeholder audio only).
# Usage: powershell -ExecutionPolicy Bypass -File tools/tts_sapi.ps1 -Jobs jobs.json
# jobs.json: [ { "out": "path.wav", "voice": "Microsoft Zira Desktop", "ssml": "<speak ...>...</speak>" }, ... ]
param([Parameter(Mandatory = $true)][string]$Jobs)
Add-Type -AssemblyName System.Speech
$list = Get-Content -Raw -Encoding UTF8 $Jobs | ConvertFrom-Json
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
foreach ($j in $list) {
  $s.SelectVoice($j.voice)
  $s.SetOutputToWaveFile($j.out, $fmt)
  $s.SpeakSsml($j.ssml)
  $s.SetOutputToNull()
  Write-Output ("ok " + $j.out)
}
$s.Dispose()
