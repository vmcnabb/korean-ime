rmdir /s /q dist
xcopy /s src\* dist\
cd dist
7z a dist.zip *
cd ..
