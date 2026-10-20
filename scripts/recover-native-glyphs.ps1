param([switch]$AddMissingSourceFonts)
$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
$target = Join-Path $workspace 'analysis/original/media/native-fonts'
New-Item -ItemType Directory -Path $target -Force | Out-Null
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Collections.Generic;
public static class NativeGlyphRecovery {
 [DllImport("gdi32.dll", CharSet=CharSet.Unicode)] static extern IntPtr CreateFontW(int h,int w,int esc,int ori,int weight,uint italic,uint underline,uint strike,uint charset,uint outPrecision,uint clipPrecision,uint quality,uint pitch,string name);
 [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc,IntPtr obj);
 [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr obj);
 [DllImport("gdi32.dll")] static extern int SetBkMode(IntPtr dc,int mode);
 [DllImport("gdi32.dll")] static extern uint SetTextColor(IntPtr dc,uint color);
 [DllImport("gdi32.dll", CharSet=CharSet.Unicode)] static extern bool TextOutW(IntPtr dc,int x,int y,string text,int count);
 [DllImport("gdi32.dll", CharSet=CharSet.Unicode)] static extern bool GetTextExtentPoint32W(IntPtr dc,string text,int count,out SIZE size);
 [DllImport("gdi32.dll", CharSet=CharSet.Unicode)] static extern bool GetTextMetricsW(IntPtr dc,out METRIC metric);
 [DllImport("gdi32.dll", CharSet=CharSet.Unicode)] static extern uint GetKerningPairsW(IntPtr dc,uint count,[Out] KERN[] pairs);
 [DllImport("gdi32.dll", CharSet=CharSet.Unicode)] static extern uint GetGlyphOutlineW(IntPtr dc,uint ch,uint format,out GLYPHMETRIC metrics,uint bytes,[Out] byte[] buffer,ref MATRIX matrix);
 [StructLayout(LayoutKind.Sequential)] public struct SIZE {public int width,height;}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct METRIC {
  public int height,ascent,descent,internalLeading,externalLeading,averageWidth,maximumWidth,weight,overhang,digitizedAspectX,digitizedAspectY;
  public char firstChar,lastChar,defaultChar,breakChar;public byte italic,underlined,struckOut,pitchAndFamily,charSet;
 }
 [StructLayout(LayoutKind.Sequential)] public struct KERN {public ushort first,second;public int amount;}
 [StructLayout(LayoutKind.Sequential)] public struct POINT {public int x,y;}
 [StructLayout(LayoutKind.Sequential)] public struct GLYPHMETRIC {public uint width,height;public POINT origin;public short advanceX,advanceY;}
 [StructLayout(LayoutKind.Sequential)] public struct FIXED {public ushort fraction;public short value;}
 [StructLayout(LayoutKind.Sequential)] public struct MATRIX {public FIXED a,b,c,d;}
 public class GRAY {public int x,y,width,height,stride;public byte[] data;}
 public class GLYPH {public int code,x,y,width,height,advance,offsetX,offsetY;}
 public class RESULT {public string family,id,path;public bool antialias;public int size,weight,ascent,descent,lineHeight,internalLeading,externalLeading;public GLYPH[] glyphs;public KERN[] kerning;}
 public static RESULT Recover(string family,int size,bool bold,bool antialias,string directory) {
  var codes=new List<int>();for(int n=32;n<256;n++)codes.Add(n);
  codes.AddRange(new int[]{0x2013,0x2014,0x2018,0x2019,0x201c,0x201d,0x2022,0x20ac,0x2122,0x2026});
  const int cell=48,padding=4,columns=16;
  var bitmap=new Bitmap(columns*cell,((codes.Count+columns-1)/columns)*cell,PixelFormat.Format32bppArgb);
  METRIC metric;KERN[] kern;var glyphs=new List<GLYPH>();var gray=new List<GRAY>();
  using(var graphics=Graphics.FromImage(bitmap)) {
   graphics.Clear(Color.White);var dc=graphics.GetHdc();
   var font=CreateFontW(-size,0,0,0,bold?700:400,0,0,0,1,0,0,antialias?(uint)4:(uint)3,0,family);
   if(font==IntPtr.Zero)throw new Exception("CreateFont failed");
   var old=SelectObject(dc,font);SetBkMode(dc,1);SetTextColor(dc,0);
   GetTextMetricsW(dc,out metric);uint count=GetKerningPairsW(dc,0,null);kern=new KERN[count];GetKerningPairsW(dc,count,kern);
   for(int i=0;i<codes.Count;i++) {
    int x=(i%columns)*cell,y=(i/columns)*cell;string ch=char.ConvertFromUtf32(codes[i]);SIZE advance;
    GetTextExtentPoint32W(dc,ch,ch.Length,out advance);TextOutW(dc,x+padding,y+padding,ch,ch.Length);
    if(antialias) {
     var matrix=new MATRIX{a=new FIXED{value=1},d=new FIXED{value=1}};GLYPHMETRIC gm;
     uint length=GetGlyphOutlineW(dc,(uint)codes[i],6,out gm,0,null,ref matrix);
     if(length!=0&&length!=UInt32.MaxValue) {
      byte[] coverage=new byte[length];GetGlyphOutlineW(dc,(uint)codes[i],6,out gm,length,coverage,ref matrix);
      gray.Add(new GRAY{x=x+padding+gm.origin.x,y=y+padding+metric.ascent-gm.origin.y,width=(int)gm.width,height=(int)gm.height,stride=((int)gm.width+3)&~3,data=coverage});
     }
    }
    glyphs.Add(new GLYPH{code=codes[i],x=x,y=y,width=cell,height=metric.height+padding*2,advance=advance.width,offsetX=-padding,offsetY=-padding});
   }
   SelectObject(dc,old);DeleteObject(font);graphics.ReleaseHdc(dc);
  }
  var rect=new Rectangle(0,0,bitmap.Width,bitmap.Height);var data=bitmap.LockBits(rect,ImageLockMode.ReadWrite,PixelFormat.Format32bppArgb);
  byte[] pixels=new byte[data.Stride*data.Height];Marshal.Copy(data.Scan0,pixels,0,pixels.Length);
  if(antialias) {
   for(int i=0;i<pixels.Length;i++)pixels[i]=255;
   foreach(var glyph in gray)for(int y=0;y<glyph.height;y++)for(int x=0;x<glyph.width;x++) {
    int dx=glyph.x+x,dy=glyph.y+y;if(dx<0||dy<0||dx>=bitmap.Width||dy>=bitmap.Height)continue;
    int offset=dy*data.Stride+dx*4;byte value=(byte)(255-Math.Min(255,(glyph.data[y*glyph.stride+x]*255+32)/64));
    pixels[offset]=pixels[offset+1]=pixels[offset+2]=value;
   }
  }
  for(int i=0;i<pixels.Length;i+=4){pixels[i+3]=(byte)(255-pixels[i]);pixels[i]=pixels[i+1]=pixels[i+2]=255;}
  Marshal.Copy(pixels,0,data.Scan0,pixels.Length);bitmap.UnlockBits(data);
  string id=family.Replace(" ","-").ToLowerInvariant()+"-"+size+"-"+(bold?"bold":"regular")+(antialias?"-aa":""),file="native-font-"+id+".png";
  bitmap.Save(System.IO.Path.Combine(directory,file),ImageFormat.Png);bitmap.Dispose();
  var neededKern=new List<KERN>();foreach(var pair in kern)if(pair.amount!=0&&codes.Contains(pair.first)&&codes.Contains(pair.second))neededKern.Add(pair);
  return new RESULT{family=family,size=size,weight=bold?700:400,antialias=antialias,id=id,path="media/native-fonts/"+file,ascent=metric.ascent,descent=metric.descent,lineHeight=metric.height,internalLeading=metric.internalLeading,externalLeading=metric.externalLeading,glyphs=glyphs.ToArray(),kerning=neededKern.ToArray()};
 }
}
'@
$atlases = @()
$profiles = if ($AddMissingSourceFonts) { @(@{family='Verdana';sizes=@(9,11)},@{family='Times New Roman';sizes=@(18)},@{family='Courier New';sizes=@(14)}) } else { @('Arial','Verdana','Courier New') | ForEach-Object { @{family=$_;sizes=@(10,11,12,13,14,15,16,18,20,22,24)} } }
foreach ($profile in $profiles) {
    $family = $profile.family
    foreach ($size in $profile.sizes) {
        foreach ($bold in @($false, $true)) {
          foreach ($antialias in @($false, $true)) {
            $result = [NativeGlyphRecovery]::Recover($family, $size, $bold, $antialias, $target)
            $record = $result | ConvertTo-Json -Depth 8 | ConvertFrom-Json
            $png = Join-Path $workspace ('analysis/original/' + $record.path)
            $record | Add-Member -NotePropertyName sha256 -NotePropertyValue ((Get-FileHash -LiteralPath $png -Algorithm SHA256).Hash.ToLowerInvariant())
            $atlases += $record
          }
        }
    }
}
$fontFiles = if ($AddMissingSourceFonts) { @('verdana.ttf','verdanab.ttf','times.ttf','timesbd.ttf') } else { @('arial.ttf','arialbd.ttf','verdana.ttf','verdanab.ttf','cour.ttf','courbd.ttf') }
$fontSources = $fontFiles | ForEach-Object {
    $path = Join-Path $env:WINDIR ('Fonts/' + $_)
    [ordered]@{path=$path;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$evidence = [ordered]@{
    schemaVersion=1; method='Windows GDI CreateFontW negative pixel height, weight400/700; monochrome TextOutW NONANTIALIASED_QUALITY, antialias GetGlyphOutlineW GGO_GRAY8_BITMAP (65coverage levels, not ClearType); GetTextMetricsW, GetTextExtentPoint32W and GetKerningPairsW. Generated in memory, no original game files modified';
    limitation='Current installed Windows font revisions, not verified 2001 font binaries. Source Director headings Verdana11bold and controls CourierNew14bold are established; rich-text active runs remain partly undecoded. Monochrome masks and metrics require native screenshot comparison before exactness claims.';
    sourceFonts=$fontSources; atlases=$atlases
}
$outputPath = Join-Path $workspace 'analysis/original/native-font-evidence.json'
if ($AddMissingSourceFonts) {
    $priorEvidence = Get-Content -LiteralPath $outputPath -Raw | ConvertFrom-Json
    $newIds = @($atlases | ForEach-Object { $_.id })
    $priorEvidence.atlases = @($priorEvidence.atlases | Where-Object { $_.id -notin $newIds }) + $atlases
    $priorEvidence.sourceFonts = @($priorEvidence.sourceFonts) + @($fontSources | Where-Object { $_.path -notin @($priorEvidence.sourceFonts.path) })
    $evidence = $priorEvidence
}
[System.IO.File]::WriteAllText($outputPath, ($evidence | ConvertTo-Json -Depth 12 -Compress), (New-Object System.Text.UTF8Encoding($false)))
Write-Output ('Recovered ' + $atlases.Count + ' GDI font atlases.')
