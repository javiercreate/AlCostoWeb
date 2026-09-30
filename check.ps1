$raw = Get-Content 'js\app.js' -Raw
$openBraces = [regex]::Matches($raw, '\{').Count
$closeBraces = [regex]::Matches($raw, '\}').Count
$openParens = [regex]::Matches($raw, '\(').Count
$closeParens = [regex]::Matches($raw, '\)').Count
Write-Host "Braces: open=$openBraces, close=$closeBraces"
Write-Host "Parens: open=$openParens, close=$closeParens"
