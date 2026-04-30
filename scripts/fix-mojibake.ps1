# fix-mojibake.ps1 — replace UTF-8-as-Latin1 garbled emoji with proper Unicode.
# Runs idempotently over the files listed in $files.
param(
    [string[]] $Files = @(
        "src/admin/components/LiveDashboard.jsx",
        "src/super-distributor/pages/AddMoney.jsx"
    )
)

$utf8NoBom = New-Object System.Text.UTF8Encoding $false

$map = [ordered]@{
    # Order matters: replace longer/three-char sequences first so two-char ones
    # don't nibble them in half.
    [char]0xF0 + [char]0x9F + [char]0x8F + [char]0xA6 = [char]0xF0 + [char]0x9F + [char]0x8F + [char]0xA6  # placeholder
}

# Build direct [latin1-as-utf8] -> [correct utf8] mapping via a dictionary of
# strings. We store the visible mojibake form and its correct emoji replacement.
$pairs = @(
    @("ðŸ“§", "📧"),
    @("ðŸš€", "🚀"),
    @("ðŸ”’", "🔒"),
    @("ðŸ¦", "🏦"),
    @("ðŸ’¸", "💸"),
    @("âš¡",   "⚡"),
    @("ðŸ“²", "📲"),
    @("ðŸ”—", "🔗"),
    @("ðŸ› ï¸", "🛠️"),
    @("âœ…",   "✅"),
    @("â³",   "⏳"),
    @("âŒ",   "❌"),
    @("ðŸ”„", "🔄"),
    @("ðŸ“Š", "📊"),
    @("ðŸ“­", "📭"),
    @("ðŸ›ï¸", "🛍️"),
    @("ðŸ‘¥", "👥"),
    @("ðŸªª", "🪪"),
    @("ðŸ’°", "💰"),
    @("ðŸ‘‘", "👑"),
    @("ðŸª",   "🏪"),
    @("ðŸ›’", "🛒"),
    @("ðŸ“¡", "📡"),
    @("ðŸŸ¢", "🟢"),
    @("ðŸ”´", "🔴")
)

foreach ($rel in $Files) {
    $path = Join-Path -Path (Get-Location) -ChildPath $rel
    if (-not (Test-Path $path)) { Write-Host "skip (missing): $rel"; continue }

    $bytes = [System.IO.File]::ReadAllBytes($path)
    # Interpret the current on-disk bytes as Latin-1 so the mojibake glyphs
    # round-trip through .NET strings without further corruption.
    $text = [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($bytes)

    foreach ($pair in $pairs) {
        $bad, $good = $pair
        if ($text.Contains($bad)) {
            $text = $text.Replace($bad, $good)
        }
    }

    # Write back as true UTF-8 (no BOM) so the browser / bundler renders it
    # correctly going forward.
    [System.IO.File]::WriteAllText($path, $text, $utf8NoBom)
    Write-Host "fixed: $rel"
}
