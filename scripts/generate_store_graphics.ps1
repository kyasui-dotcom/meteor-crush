Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

function New-PointF {
  param([float]$X, [float]$Y)
  return [System.Drawing.PointF]::new($X, $Y)
}

function New-RectF {
  param([float]$X, [float]$Y, [float]$Width, [float]$Height)
  return [System.Drawing.RectangleF]::new($X, $Y, $Width, $Height)
}

function Get-Color {
  param(
    [int]$A = 255,
    [int]$R,
    [int]$G,
    [int]$B
  )
  return [System.Drawing.Color]::FromArgb($A, $R, $G, $B)
}

function Fill-GradientBackground {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$Width,
    [float]$Height
  )

  $backgroundRect = New-RectF 0 0 $Width $Height
  $backgroundBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $backgroundRect,
    (Get-Color -R 6 -G 8 -B 20),
    (Get-Color -R 16 -G 10 -B 32),
    65
  )
  $Graphics.FillRectangle($backgroundBrush, $backgroundRect)
  $backgroundBrush.Dispose()

  $glowBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new([System.Drawing.PointF[]]@(
    (New-PointF ($Width * 0.15) ($Height * 0.08)),
    (New-PointF ($Width * 0.7) ($Height * 0.04)),
    (New-PointF ($Width * 0.88) ($Height * 0.36)),
    (New-PointF ($Width * 0.42) ($Height * 0.64)),
    (New-PointF ($Width * 0.04) ($Height * 0.34))
  ))
  $glowBrush.CenterPoint = New-PointF ($Width * 0.36) ($Height * 0.24)
  $glowBrush.CenterColor = Get-Color -A 165 -R 32 -G 70 -B 150
  $glowBrush.SurroundColors = [System.Drawing.Color[]]@((Get-Color -A 0 -R 32 -G 70 -B 150))
  $Graphics.FillRectangle($glowBrush, $backgroundRect)
  $glowBrush.Dispose()

  $emberBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new([System.Drawing.PointF[]]@(
    (New-PointF ($Width * 0.52) ($Height * 0.45)),
    (New-PointF ($Width * 0.98) ($Height * 0.42)),
    (New-PointF ($Width * 1.04) ($Height * 0.92)),
    (New-PointF ($Width * 0.54) ($Height * 0.94)),
    (New-PointF ($Width * 0.34) ($Height * 0.64))
  ))
  $emberBrush.CenterPoint = New-PointF ($Width * 0.78) ($Height * 0.64)
  $emberBrush.CenterColor = Get-Color -A 120 -R 255 -G 116 -B 34
  $emberBrush.SurroundColors = [System.Drawing.Color[]]@((Get-Color -A 0 -R 255 -G 116 -B 34))
  $Graphics.FillRectangle($emberBrush, $backgroundRect)
  $emberBrush.Dispose()
}

function Draw-Starfield {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Width,
    [int]$Height,
    [int]$Seed = 421
  )

  $random = [System.Random]::new($Seed)
  for ($i = 0; $i -lt 64; $i++) {
    $x = [float]($random.NextDouble() * $Width)
    $y = [float]($random.NextDouble() * $Height)
    $r = [float](1.3 + ($random.NextDouble() * 3.3))
    $alpha = [int](110 + ($random.NextDouble() * 110))
    $colorRoll = $random.NextDouble()
    if ($colorRoll -lt 0.2) {
      $color = Get-Color -A $alpha -R 126 -G 230 -B 255
    } elseif ($colorRoll -lt 0.36) {
      $color = Get-Color -A $alpha -R 255 -G 238 -B 172
    } else {
      $color = Get-Color -A $alpha -R 224 -G 235 -B 255
    }
    $brush = [System.Drawing.SolidBrush]::new($color)
    $Graphics.FillEllipse($brush, $x, $y, $r, $r)
    $brush.Dispose()
  }
}

function Draw-GlowEllipse {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$CenterX,
    [float]$CenterY,
    [float]$Width,
    [float]$Height,
    [System.Drawing.Color]$Color,
    [float]$Angle
  )

  $state = $Graphics.Save()
  $Graphics.TranslateTransform($CenterX, $CenterY)
  $Graphics.RotateTransform($Angle)
  $Graphics.TranslateTransform(-($Width / 2), -($Height / 2))
  $brush = [System.Drawing.Drawing2D.PathGradientBrush]::new([System.Drawing.PointF[]]@(
    (New-PointF 0 ($Height / 2)),
    (New-PointF ($Width / 3) 0),
    (New-PointF $Width ($Height / 2)),
    (New-PointF ($Width / 3) $Height)
  ))
  $brush.CenterPoint = New-PointF ($Width * 0.18) ($Height / 2)
  $brush.CenterColor = $Color
  $brush.SurroundColors = [System.Drawing.Color[]]@((Get-Color -A 0 -R $Color.R -G $Color.G -B $Color.B))
  $Graphics.FillEllipse($brush, 0, 0, $Width, $Height)
  $brush.Dispose()
  $Graphics.Restore($state)
}

function Draw-Meteor {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$CenterX,
    [float]$CenterY,
    [float]$Scale = 1.0,
    [float]$Angle = -22
  )

  Draw-GlowEllipse -Graphics $Graphics -CenterX ($CenterX - 110 * $Scale) -CenterY ($CenterY + 24 * $Scale) -Width (360 * $Scale) -Height (96 * $Scale) -Color (Get-Color -A 95 -R 255 -G 200 -B 115) -Angle $Angle
  Draw-GlowEllipse -Graphics $Graphics -CenterX ($CenterX - 180 * $Scale) -CenterY ($CenterY + 34 * $Scale) -Width (420 * $Scale) -Height (58 * $Scale) -Color (Get-Color -A 72 -R 255 -G 132 -B 30) -Angle ($Angle + 2)
  Draw-GlowEllipse -Graphics $Graphics -CenterX ($CenterX - 200 * $Scale) -CenterY ($CenterY + 44 * $Scale) -Width (520 * $Scale) -Height (28 * $Scale) -Color (Get-Color -A 42 -R 255 -G 240 -B 205) -Angle ($Angle + 3)

  $state = $Graphics.Save()
  $Graphics.TranslateTransform($CenterX, $CenterY)
  $Graphics.RotateTransform($Angle)

  $meteorRect = New-RectF (-72 * $Scale) (-54 * $Scale) (164 * $Scale) (124 * $Scale)
  $meteorBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new([System.Drawing.PointF[]]@(
    (New-PointF $meteorRect.Left ($meteorRect.Top + $meteorRect.Height * 0.35)),
    (New-PointF ($meteorRect.Left + $meteorRect.Width * 0.38) $meteorRect.Top),
    (New-PointF ($meteorRect.Right) ($meteorRect.Top + $meteorRect.Height * 0.28)),
    (New-PointF ($meteorRect.Left + $meteorRect.Width * 0.9) ($meteorRect.Bottom)),
    (New-PointF ($meteorRect.Left + $meteorRect.Width * 0.1) ($meteorRect.Bottom))
  ))
  $meteorBrush.CenterPoint = New-PointF ($meteorRect.Left + $meteorRect.Width * 0.34) ($meteorRect.Top + $meteorRect.Height * 0.28)
  $meteorBrush.CenterColor = Get-Color -R 255 -G 222 -B 146
  $meteorBrush.SurroundColors = [System.Drawing.Color[]]@((Get-Color -R 195 -G 41 -B 44))
  $Graphics.FillEllipse($meteorBrush, $meteorRect)
  $meteorBrush.Dispose()

  $highlightBrush = [System.Drawing.SolidBrush]::new((Get-Color -A 210 -R 255 -G 239 -B 188))
  $Graphics.FillEllipse($highlightBrush, -8 * $Scale, -40 * $Scale, 54 * $Scale, 34 * $Scale)
  $highlightBrush.Dispose()

  foreach ($crater in @(
    @{X = -24; Y = 10; Size = 26; Alpha = 90},
    @{X = 22; Y = 28; Size = 18; Alpha = 68},
    @{X = 38; Y = -4; Size = 12; Alpha = 58}
  )) {
    $craterBrush = [System.Drawing.SolidBrush]::new((Get-Color -A $crater.Alpha -R 88 -G 18 -B 14))
    $Graphics.FillEllipse($craterBrush, $crater.X * $Scale, $crater.Y * $Scale, $crater.Size * $Scale, $crater.Size * $Scale)
    $craterBrush.Dispose()
  }

  $Graphics.Restore($state)
}

function Draw-Block {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Size,
    [System.Drawing.Color]$BaseColor
  )

  $shadowBrush = [System.Drawing.SolidBrush]::new((Get-Color -A 72 -R 0 -G 0 -B 0))
  $Graphics.FillRectangle($shadowBrush, $X + ($Size * 0.06), $Y + ($Size * 0.08), $Size, $Size)
  $shadowBrush.Dispose()

  $rect = New-RectF $X $Y $Size $Size
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    (Get-Color -R ([Math]::Min($BaseColor.R + 60, 255)) -G ([Math]::Min($BaseColor.G + 60, 255)) -B ([Math]::Min($BaseColor.B + 60, 255))),
    (Get-Color -R ([Math]::Max($BaseColor.R - 35, 0)) -G ([Math]::Max($BaseColor.G - 35, 0)) -B ([Math]::Max($BaseColor.B - 35, 0))),
    55
  )
  $Graphics.FillRectangle($brush, $rect)
  $brush.Dispose()

  $highlightPen = [System.Drawing.Pen]::new((Get-Color -A 180 -R 255 -G 255 -B 255), [Math]::Max(2, $Size * 0.05))
  $edgePen = [System.Drawing.Pen]::new((Get-Color -A 150 -R 12 -G 18 -B 32), [Math]::Max(2, $Size * 0.055))
  $Graphics.DrawRectangle($edgePen, $X, $Y, $Size, $Size)
  $Graphics.DrawLine($highlightPen, $X + ($Size * 0.1), $Y + ($Size * 0.16), $X + ($Size * 0.7), $Y + ($Size * 0.16))
  $Graphics.DrawLine($highlightPen, $X + ($Size * 0.12), $Y + ($Size * 0.2), $X + ($Size * 0.12), $Y + ($Size * 0.7))
  $edgePen.Dispose()
  $highlightPen.Dispose()
}

function Draw-MeteorBlock {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Size,
    [System.Drawing.Color]$AccentColor
  )

  $shadowBrush = [System.Drawing.SolidBrush]::new((Get-Color -A 76 -R 0 -G 0 -B 0))
  $Graphics.FillRectangle($shadowBrush, $X + ($Size * 0.07), $Y + ($Size * 0.08), $Size, $Size)
  $shadowBrush.Dispose()

  $rect = New-RectF $X $Y $Size $Size
  $baseBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    (Get-Color -R 114 -G 83 -B 62),
    (Get-Color -R 41 -G 31 -B 28),
    55
  )
  $Graphics.FillRectangle($baseBrush, $rect)
  $baseBrush.Dispose()

  $heatBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new([System.Drawing.PointF[]]@(
    (New-PointF ($X + $Size * 0.1) ($Y + $Size * 0.72)),
    (New-PointF ($X + $Size * 0.42) ($Y + $Size * 0.08)),
    (New-PointF ($X + $Size * 0.92) ($Y + $Size * 0.24)),
    (New-PointF ($X + $Size * 0.78) ($Y + $Size * 0.94)),
    (New-PointF ($X + $Size * 0.22) ($Y + $Size * 0.92))
  ))
  $heatBrush.CenterPoint = New-PointF ($X + $Size * 0.54) ($Y + $Size * 0.46)
  $heatBrush.CenterColor = Get-Color -A 70 -R $AccentColor.R -G $AccentColor.G -B $AccentColor.B
  $heatBrush.SurroundColors = [System.Drawing.Color[]]@((Get-Color -A 0 -R $AccentColor.R -G $AccentColor.G -B $AccentColor.B))
  $Graphics.FillRectangle($heatBrush, $rect)
  $heatBrush.Dispose()

  $edgePen = [System.Drawing.Pen]::new((Get-Color -A 190 -R 18 -G 22 -B 36), [Math]::Max(2, $Size * 0.05))
  $highlightPen = [System.Drawing.Pen]::new((Get-Color -A 120 -R 255 -G 221 -B 192), [Math]::Max(2, $Size * 0.03))
  $crackPen = [System.Drawing.Pen]::new((Get-Color -A 160 -R $AccentColor.R -G $AccentColor.G -B $AccentColor.B), [Math]::Max(2, $Size * 0.04))
  $crackPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $crackPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $Graphics.DrawRectangle($edgePen, $X, $Y, $Size, $Size)
  $Graphics.DrawLine($highlightPen, $X + ($Size * 0.12), $Y + ($Size * 0.14), $X + ($Size * 0.72), $Y + ($Size * 0.14))
  $Graphics.DrawLine($highlightPen, $X + ($Size * 0.14), $Y + ($Size * 0.16), $X + ($Size * 0.14), $Y + ($Size * 0.66))

  foreach ($crater in @(
    @{X = 0.18; Y = 0.24; W = 0.18; H = 0.12; Alpha = 90},
    @{X = 0.58; Y = 0.18; W = 0.14; H = 0.1; Alpha = 72},
    @{X = 0.52; Y = 0.56; W = 0.2; H = 0.16; Alpha = 84}
  )) {
    $craterBrush = [System.Drawing.SolidBrush]::new((Get-Color -A $crater.Alpha -R 28 -G 18 -B 18))
    $Graphics.FillEllipse($craterBrush, $X + ($Size * $crater.X), $Y + ($Size * $crater.Y), $Size * $crater.W, $Size * $crater.H)
    $craterBrush.Dispose()
  }

  $Graphics.DrawLine($crackPen, $X + ($Size * 0.16), $Y + ($Size * 0.72), $X + ($Size * 0.42), $Y + ($Size * 0.48))
  $Graphics.DrawLine($crackPen, $X + ($Size * 0.42), $Y + ($Size * 0.48), $X + ($Size * 0.74), $Y + ($Size * 0.34))
  $Graphics.DrawLine($crackPen, $X + ($Size * 0.42), $Y + ($Size * 0.48), $X + ($Size * 0.62), $Y + ($Size * 0.74))

  $edgePen.Dispose()
  $highlightPen.Dispose()
  $crackPen.Dispose()
}

function Draw-Shards {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$CenterX,
    [float]$CenterY,
    [float]$Scale = 1.0
  )

  foreach ($shard in @(
    @{Dx = -94; Dy = -18; Size = 18; Color = (Get-Color -R 255 -G 176 -B 71)},
    @{Dx = -64; Dy = 62; Size = 14; Color = (Get-Color -R 79 -G 216 -B 255)},
    @{Dx = 52; Dy = -54; Size = 16; Color = (Get-Color -R 255 -G 120 -B 54)},
    @{Dx = 82; Dy = 28; Size = 20; Color = (Get-Color -R 132 -G 214 -B 59)},
    @{Dx = 18; Dy = 74; Size = 12; Color = (Get-Color -R 255 -G 231 -B 176)}
  )) {
    $brush = [System.Drawing.SolidBrush]::new((Get-Color -A 210 -R $shard.Color.R -G $shard.Color.G -B $shard.Color.B))
    $points = [System.Drawing.PointF[]]@(
      (New-PointF ($CenterX + $shard.Dx * $Scale) ($CenterY + $shard.Dy * $Scale)),
      (New-PointF ($CenterX + ($shard.Dx + $shard.Size * 0.9) * $Scale) ($CenterY + ($shard.Dy + $shard.Size * 0.2) * $Scale)),
      (New-PointF ($CenterX + ($shard.Dx + $shard.Size * 0.25) * $Scale) ($CenterY + ($shard.Dy + $shard.Size) * $Scale))
    )
    $Graphics.FillPolygon($brush, $points)
    $brush.Dispose()
  }
}

function Draw-Core {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$CenterX,
    [float]$CenterY,
    [float]$Radius
  )

  $glowBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new([System.Drawing.PointF[]]@(
    (New-PointF ($CenterX - $Radius * 1.8) $CenterY),
    (New-PointF $CenterX ($CenterY - $Radius * 1.8)),
    (New-PointF ($CenterX + $Radius * 1.8) $CenterY),
    (New-PointF $CenterX ($CenterY + $Radius * 1.8))
  ))
  $glowBrush.CenterPoint = New-PointF $CenterX $CenterY
  $glowBrush.CenterColor = Get-Color -A 170 -R 100 -G 244 -B 255
  $glowBrush.SurroundColors = [System.Drawing.Color[]]@((Get-Color -A 0 -R 100 -G 244 -B 255))
  $Graphics.FillEllipse($glowBrush, $CenterX - $Radius * 1.8, $CenterY - $Radius * 1.8, $Radius * 3.6, $Radius * 3.6)
  $glowBrush.Dispose()

  $coreBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new([System.Drawing.PointF[]]@(
    (New-PointF ($CenterX - $Radius) $CenterY),
    (New-PointF $CenterX ($CenterY - $Radius)),
    (New-PointF ($CenterX + $Radius) $CenterY),
    (New-PointF $CenterX ($CenterY + $Radius))
  ))
  $coreBrush.CenterPoint = New-PointF $CenterX $CenterY
  $coreBrush.CenterColor = Get-Color -R 212 -G 255 -B 255
  $coreBrush.SurroundColors = [System.Drawing.Color[]]@((Get-Color -R 34 -G 160 -B 212))
  $Graphics.FillEllipse($coreBrush, $CenterX - $Radius, $CenterY - $Radius, $Radius * 2, $Radius * 2)
  $coreBrush.Dispose()
}

function New-Graphics {
  param(
    [int]$Width,
    [int]$Height
  )

  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  return @{
    Bitmap = $bitmap
    Graphics = $graphics
  }
}

function Save-Png {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path
  )

  $directory = Split-Path -Parent $Path
  if ($directory -and -not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
  }
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function New-StoreIcon {
  param([string]$OutputPath)

  $canvas = New-Graphics -Width 512 -Height 512
  $bitmap = $canvas.Bitmap
  $graphics = $canvas.Graphics

  Fill-GradientBackground -Graphics $graphics -Width 512 -Height 512
  Draw-Starfield -Graphics $graphics -Width 512 -Height 512 -Seed 91

  $auraBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new([System.Drawing.PointF[]]@(
    (New-PointF 84 324),
    (New-PointF 226 208),
    (New-PointF 392 246),
    (New-PointF 420 418),
    (New-PointF 188 454)
  ))
  $auraBrush.CenterPoint = New-PointF 236 322
  $auraBrush.CenterColor = Get-Color -A 120 -R 25 -G 122 -B 212
  $auraBrush.SurroundColors = [System.Drawing.Color[]]@((Get-Color -A 0 -R 25 -G 122 -B 212))
  $graphics.FillEllipse($auraBrush, 78, 198, 356, 278)
  $auraBrush.Dispose()

  Draw-Meteor -Graphics $graphics -CenterX 334 -CenterY 194 -Scale 0.9 -Angle -28

  Draw-MeteorBlock -Graphics $graphics -X 120 -Y 250 -Size 96 -AccentColor (Get-Color -R 255 -G 176 -B 71)
  Draw-MeteorBlock -Graphics $graphics -X 220 -Y 250 -Size 96 -AccentColor (Get-Color -R 79 -G 216 -B 255)
  Draw-MeteorBlock -Graphics $graphics -X 170 -Y 350 -Size 96 -AccentColor (Get-Color -R 255 -G 120 -B 54)
  Draw-MeteorBlock -Graphics $graphics -X 270 -Y 350 -Size 96 -AccentColor (Get-Color -R 132 -G 214 -B 59)
  Draw-Core -Graphics $graphics -CenterX 248 -CenterY 330 -Radius 28
  Draw-Shards -Graphics $graphics -CenterX 248 -CenterY 330 -Scale 1.0

  $ringPen = [System.Drawing.Pen]::new((Get-Color -A 118 -R 255 -G 213 -B 108), 7)
  $graphics.DrawArc($ringPen, 86, 214, 326, 250, 212, 128)
  $ringPen.Dispose()

  Save-Png -Bitmap $bitmap -Path $OutputPath
  $graphics.Dispose()
  $bitmap.Dispose()
}

function New-FeatureGraphic {
  param([string]$OutputPath)

  $width = 1024
  $height = 500
  $canvas = New-Graphics -Width $width -Height $height
  $bitmap = $canvas.Bitmap
  $graphics = $canvas.Graphics

  Fill-GradientBackground -Graphics $graphics -Width $width -Height $height
  Draw-Starfield -Graphics $graphics -Width $width -Height $height -Seed 314

  $nebulaBrush = [System.Drawing.Drawing2D.PathGradientBrush]::new([System.Drawing.PointF[]]@(
    (New-PointF 460 108),
    (New-PointF 960 88),
    (New-PointF 1080 360),
    (New-PointF 698 520),
    (New-PointF 412 312)
  ))
  $nebulaBrush.CenterPoint = New-PointF 798 236
  $nebulaBrush.CenterColor = Get-Color -A 110 -R 52 -G 98 -B 202
  $nebulaBrush.SurroundColors = [System.Drawing.Color[]]@((Get-Color -A 0 -R 52 -G 98 -B 202))
  $graphics.FillRectangle($nebulaBrush, 370, 32, 700, 460)
  $nebulaBrush.Dispose()

  Draw-Meteor -Graphics $graphics -CenterX 758 -CenterY 172 -Scale 1.38 -Angle -18

  $panelBrush = [System.Drawing.SolidBrush]::new((Get-Color -A 128 -R 6 -G 10 -B 22))
  $graphics.FillRectangle($panelBrush, 582, 92, 344, 266)
  $panelBrush.Dispose()

  $colors = @(
    (Get-Color -R 79 -G 216 -B 255),
    (Get-Color -R 255 -G 176 -B 71),
    (Get-Color -R 255 -G 96 -B 59),
    (Get-Color -R 132 -G 214 -B 59)
  )

  $startX = 612
  $startY = 118
  $size = 62
  $gap = 12
  for ($row = 0; $row -lt 3; $row++) {
    for ($col = 0; $col -lt 4; $col++) {
      $color = $colors[($row + $col) % $colors.Count]
      Draw-MeteorBlock -Graphics $graphics -X ($startX + $col * ($size + $gap)) -Y ($startY + $row * ($size + $gap)) -Size $size -AccentColor $color
    }
  }

  Draw-Core -Graphics $graphics -CenterX 736 -CenterY 228 -Radius 30
  Draw-Core -Graphics $graphics -CenterX 850 -CenterY 168 -Radius 18
  Draw-Shards -Graphics $graphics -CenterX 736 -CenterY 228 -Scale 1.25
  Draw-Shards -Graphics $graphics -CenterX 850 -CenterY 168 -Scale 0.78

  $titleFont = [System.Drawing.Font]::new('Bahnschrift', 74, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $subtitleFont = [System.Drawing.Font]::new('Consolas', 25, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $bodyFont = [System.Drawing.Font]::new('Consolas', 20, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

  $accentBrush = [System.Drawing.SolidBrush]::new((Get-Color -R 255 -G 191 -B 92))
  $whiteBrush = [System.Drawing.SolidBrush]::new((Get-Color -R 245 -G 248 -B 255))
  $mutedBrush = [System.Drawing.SolidBrush]::new((Get-Color -R 182 -G 197 -B 228))
  $chipBrush = [System.Drawing.SolidBrush]::new((Get-Color -A 54 -R 94 -G 196 -B 196))
  $chipTextBrush = [System.Drawing.SolidBrush]::new((Get-Color -R 132 -G 236 -B 236))

  $graphics.DrawString('SMASH', $titleFont, $whiteBrush, 74, 116)
  $graphics.DrawString('METEOR BLOCKS', $titleFont, $accentBrush, 74, 190)
  $graphics.DrawString('CLASSIC STACKING • BOMB CHAINS • PURIFY THE CORES', $subtitleFont, $mutedBrush, 78, 286)
  $graphics.DrawString('Break falling meteor blocks, trigger big demolition, and chase the next huge chain.', $bodyFont, $whiteBrush, 80, 338)

  foreach ($chip in @(
    @{Label = 'FAST SCORE ATTACK'; X = 82; Y = 390; Width = 214},
    @{Label = 'CHAIN REACTIONS'; X = 310; Y = 390; Width = 208},
    @{Label = 'SMASHING METEOR BLOCKS'; X = 82; Y = 434; Width = 320}
  )) {
    $graphics.FillRectangle($chipBrush, $chip.X, $chip.Y, $chip.Width, 34)
    $graphics.DrawString($chip.Label, $bodyFont, $chipTextBrush, $chip.X + 12, $chip.Y + 6)
  }

  $outlinePen = [System.Drawing.Pen]::new((Get-Color -A 95 -R 255 -G 215 -B 112), 3)
  $graphics.DrawRectangle($outlinePen, 32, 32, 960, 436)
  $outlinePen.Dispose()

  $titleFont.Dispose()
  $subtitleFont.Dispose()
  $bodyFont.Dispose()
  $accentBrush.Dispose()
  $whiteBrush.Dispose()
  $mutedBrush.Dispose()
  $chipBrush.Dispose()
  $chipTextBrush.Dispose()

  Save-Png -Bitmap $bitmap -Path $OutputPath
  $graphics.Dispose()
  $bitmap.Dispose()
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$storeAssetsDir = Join-Path $repoRoot 'public\store-assets'
$downloadsDir = Join-Path $env:USERPROFILE 'Downloads'

$iconPath = Join-Path $storeAssetsDir 'meteor-crush-play-icon-512.png'
$featurePath = Join-Path $storeAssetsDir 'meteor-crush-feature-graphic-1024x500.png'
$downloadIconPath = Join-Path $downloadsDir 'meteor-crush-play-icon-512.png'
$downloadFeaturePath = Join-Path $downloadsDir 'meteor-crush-feature-graphic-1024x500.png'

New-StoreIcon -OutputPath $iconPath
New-FeatureGraphic -OutputPath $featurePath

Copy-Item -Path $iconPath -Destination $downloadIconPath -Force
Copy-Item -Path $featurePath -Destination $downloadFeaturePath -Force

Write-Output "Generated:"
Write-Output $iconPath
Write-Output $featurePath
Write-Output $downloadIconPath
Write-Output $downloadFeaturePath
