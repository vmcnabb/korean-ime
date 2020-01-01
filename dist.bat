rmdir /s /q dist

call webpack src/content.js --output dist/content.js
call webpack src/background.js --output dist/background.js
call webpack src/popup-converter/popup-converter.js --output dist/popup-converter/popup-converter.js

xcopy /s src\images dist\images\
xcopy /s src\_locales dist\_locales\
copy src\popup-converter\popup-converter.html dist\popup-converter\
copy src\popup-converter\popup-converter.css dist\popup-converter\

copy src\manifest.json dist\

cd dist
7z a dist.zip *
cd ..
