$gnuBin = Join-Path $env:USERPROFILE '.rustup\toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\bin\self-contained'
$env:PATH = "$gnuBin;$env:PATH"
& cargo +stable-x86_64-pc-windows-gnu @args
exit $LASTEXITCODE