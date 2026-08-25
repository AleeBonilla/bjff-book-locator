[CmdletBinding()]
param()

# Resuelve todas las rutas desde la raíz y detiene el script ante errores inesperados.
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path

# Estos archivos forman los puntos mínimos de entrada a la documentación.
$requiredDocuments = @(
    'README.md',
    'AGENTS.md',
    'docs/README.md'
)
$errors = [System.Collections.Generic.List[string]]::new()

# Comprueba que cada punto de entrada exista y tenga contenido.
foreach ($relativePath in $requiredDocuments) {
    $absolutePath = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
        $errors.Add("Falta el documento requerido: $relativePath")
        continue
    }

    if ([string]::IsNullOrWhiteSpace((Get-Content -Raw -LiteralPath $absolutePath))) {
        $errors.Add("El documento requerido está vacío: $relativePath")
    }
}

# Revisa todos los documentos, excepto cualquier copia dentro de .git.
$markdownFiles = Get-ChildItem -LiteralPath $repoRoot -Filter '*.md' -File -Recurse |
    Where-Object { $_.FullName -notmatch '[\\/]\.git[\\/]' }

# Captura enlaces Markdown de texto; las imágenes no forman parte de esta comprobación.
$linkPattern = '(?<!\!)\[[^\]]+\]\((?<target>[^)]+)\)'
$forbiddenArrow = [char]0x2192

foreach ($document in $markdownFiles) {
    $content = Get-Content -Raw -LiteralPath $document.FullName

    # El estilo del proyecto prohíbe este glifo en la documentación.
    if ($content.Contains($forbiddenArrow)) {
        $source = [System.IO.Path]::GetRelativePath($repoRoot, $document.FullName)
        $errors.Add("Glifo no permitido en ${source}: U+2192")
    }

    foreach ($match in [regex]::Matches($content, $linkPattern)) {
        $target = $match.Groups['target'].Value.Trim().Trim('<', '>')

        # Los enlaces web y las anclas internas no requieren una ruta local.
        if ($target -match '^(?:https?://|mailto:)' -or $target.StartsWith('#')) {
            continue
        }

        $pathPart = ($target -split '#', 2)[0]
        if ([string]::IsNullOrWhiteSpace($pathPart)) {
            continue
        }

        # Decodifica rutas con escapes URL antes de resolverlas desde el documento de origen.
        $decodedPath = [System.Uri]::UnescapeDataString($pathPart)
        $resolvedTarget = Join-Path $document.DirectoryName $decodedPath
        if (-not (Test-Path -LiteralPath $resolvedTarget)) {
            $source = [System.IO.Path]::GetRelativePath($repoRoot, $document.FullName)
            $errors.Add("Enlace local roto en ${source}: $target")
        }
    }
}

# Informa todos los problemas encontrados en una sola ejecución.
if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output "OK: $($markdownFiles.Count) archivos Markdown y sus enlaces locales fueron verificados."
