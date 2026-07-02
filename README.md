# PMTV Catalogo

Catalogo publico y automatico de los videos gratuitos de PMTV publicados en
YouTube. Google Drive y cualquier URL premium quedan fuera de este repositorio.

## Sincronizacion

GitHub Actions ejecuta `scripts/sync-youtube.mjs` cada dos horas y tambien
permite una ejecucion manual desde **Actions > Sincronizar catalogo PMTV > Run
workflow**.

El resultado publico queda en:

```text
https://raw.githubusercontent.com/theritualsoft/pmtv-catalogo/main/public/catalog.json
```

## Configuracion inicial

1. Activar YouTube Data API v3 en Google Cloud.
2. Crear una API key restringida solamente a YouTube Data API v3.
3. En GitHub abrir **Settings > Secrets and variables > Actions**.
4. Crear el secret `YOUTUBE_API_KEY`.
5. Ejecutar manualmente el workflow una vez.

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
