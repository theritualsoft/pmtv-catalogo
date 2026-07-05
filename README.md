# PMTV Catalogo

Catalogo publico y automatico de los videos gratuitos de PMTV publicados en
YouTube. Google Drive y cualquier URL premium quedan fuera de este repositorio.

Política de privacidad: `https://theritualsoft.github.io/pmtv-catalogo/privacy.html`.

## Sincronizacion

GitHub Actions ejecuta `scripts/sync-youtube.mjs` cada dos horas y tambien
permite una ejecucion manual desde **Actions > Sincronizar catalogo PMTV > Run
workflow**.

El resultado publico queda en:

```text
https://raw.githubusercontent.com/theritualsoft/pmtv-catalogo/main/public/catalog.json
```

## Configuracion inicial

No requiere credenciales: GitHub Actions instala `yt-dlp` y lee las playlists
publicas. Opcionalmente se puede crear el secret `YOUTUBE_API_KEY` para usar la
API oficial de YouTube en lugar del extractor.

Nunca guardar la API key dentro de archivos, commits, Flutter o el APK.

## Agregar programas

Editar `programs.json` y agregar el ID de la playlist. El sincronizador obtiene
todas sus paginas, consulta los videos en lotes y conserva solamente videos
publicos que YouTube permite reproducir embebidos.

## Desarrollo

```powershell
node --test scripts/sync-youtube.test.mjs
node scripts/sync-youtube.mjs
```
