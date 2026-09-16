Add-Type -AssemblyName System.Drawing

$srcPath = "G:\Andaman Quiz App\assets\images\andaman_quiz_master.png"
$outDir = "G:\Andaman Quiz App\assets\images"
$resDir = "G:\Andaman Quiz App\android\app\src\main\res"

$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# 1. Symbol (Stylized A + lighthouse + island + waves)
# Precise cropping of the central A symbol without the corner badge
$symbolRect = New-Object System.Drawing.Rectangle(150, 85, 680, 525)
$symbolBmp = New-Object System.Drawing.Bitmap($symbolRect.Width, $symbolRect.Height)
$g = [System.Drawing.Graphics]::FromImage($symbolBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $symbolRect.Width, $symbolRect.Height)), $symbolRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$symbolBmp.Save("$outDir\andaman_symbol.png", [System.Drawing.Imaging.ImageFormat]::Png)
$symbolBmp.Dispose()

# 2. Wordmark (ANDAMAN QUIZ)
$wordmarkRect = New-Object System.Drawing.Rectangle(110, 610, 780, 210)
$wordmarkBmp = New-Object System.Drawing.Bitmap($wordmarkRect.Width, $wordmarkRect.Height)
$g = [System.Drawing.Graphics]::FromImage($wordmarkBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $wordmarkRect.Width, $wordmarkRect.Height)), $wordmarkRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$wordmarkBmp.Save("$outDir\andaman_wordmark.png", [System.Drawing.Imaging.ImageFormat]::Png)
$wordmarkBmp.Dispose()

# 3. Clean Brand (Symbol + ANDAMAN QUIZ + Tagline, no corner badge)
$brandRect = New-Object System.Drawing.Rectangle(105, 85, 790, 790)
$brandBmp = New-Object System.Drawing.Bitmap($brandRect.Width, $brandRect.Height)
$g = [System.Drawing.Graphics]::FromImage($brandBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.DrawImage($src, (New-Object System.Drawing.Rectangle(0, 0, $brandRect.Width, $brandRect.Height)), $brandRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$brandBmp.Save("$outDir\andaman_brand_clean.png", [System.Drawing.Imaging.ImageFormat]::Png)
$brandBmp.Dispose()

# 4. Adaptive Icon Foreground (512x512 with safe padding: symbol centered in 66% zone)
$fgBmp = New-Object System.Drawing.Bitmap(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($fgBmp)
$g.Clear([System.Drawing.Color]::Transparent)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$targetW = 320
$targetH = [int]($symbolRect.Height * (320.0 / $symbolRect.Width))
$targetX = [int]((512 - $targetW) / 2)
$targetY = [int]((512 - $targetH) / 2)
$g.DrawImage($src, (New-Object System.Drawing.Rectangle($targetX, $targetY, $targetW, $targetH)), $symbolRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$fgBmp.Save("$outDir\ic_launcher_foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Save into Android res/drawable
New-Item -ItemType Directory -Force -Path "$resDir\drawable" | Out-Null
$fgBmp.Save("$resDir\drawable\ic_launcher_foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)
$fgBmp.Dispose()

# 5. Standard Full Launcher Icons for Mipmaps (48, 72, 96, 144, 192) with #FFF9EE background
$creamColor = [System.Drawing.ColorTranslator]::FromHtml("#FFF9EE")
$sizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($folder in $sizes.Keys) {
    $sz = $sizes[$folder]
    $dir = "$resDir\$folder"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    
    $iconBmp = New-Object System.Drawing.Bitmap($sz, $sz)
    $g = [System.Drawing.Graphics]::FromImage($iconBmp)
    $g.Clear($creamColor)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    
    $w = [int]($sz * 0.76)
    $h = [int]($symbolRect.Height * ($w / [double]$symbolRect.Width))
    $x = [int](($sz - $w) / 2)
    $y = [int](($sz - $h) / 2)
    
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle($x, $y, $w, $h)), $symbolRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    
    $iconBmp.Save("$dir\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $iconBmp.Dispose()
}

$src.Dispose()
Write-Host "All assets and Android launcher icons successfully created!"
