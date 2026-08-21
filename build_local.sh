#!/usr/bin/env bash
# ==============================================================================
# Script Build Executable BagiPDF (Tauri Portable / Desktop Binary)
# ==============================================================================
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WEBAPP_DIR="$SCRIPT_DIR/webapp"

echo "=========================================="
echo "  BagiPDF - Local Desktop Executable Build"
echo "=========================================="

if [ ! -d "$WEBAPP_DIR" ]; then
  echo "Error: Directory webapp tidak ditemukan di $WEBAPP_DIR"
  exit 1
fi

cd "$WEBAPP_DIR"

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  echo "[0/3] Memeriksa & Menginstall Dependency System Linux..."
  DEPENDENCIES=(libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf libwayland-dev libsoup-3.0-dev squashfs-tools libfuse2)
  
  MISSING=()
  for pkg in "${DEPENDENCIES[@]}"; do
    if ! dpkg -s "$pkg" >/dev/null 2>&1; then
      MISSING+=("$pkg")
    fi
  done

  if [ ${#MISSING[@]} -gt 0 ]; then
    echo "[!] Menginstall dependency Linux yang belum terpasang: ${MISSING[*]}"
    sudo apt-get update && sudo apt-get install -y "${MISSING[@]}" || sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf libwayland-dev libsoup-3.0-dev squashfs-tools fuse3
  else
    echo "[✓] Semua dependency system Linux sudah lengkap."
  fi
fi

echo "[1/3] Memeriksa & Menginstall NPM Dependencies..."
npm install

echo "[2/3] Membangun Frontend Web Assets (Vite)..."
npm run build

echo "[3/3] Membangun Executable File dengan Tauri..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
  echo "Target: Windows Executable (.exe)"
  npm run tauri:build
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  echo "Target: Linux Binary Executable & Deb Package"
  npx tauri build

  # ============================================================
  #  Post-process: Inject postrm cleanup script into .deb
  # ============================================================
  DEB_DIR="src-tauri/target/release/bundle/deb"
  POSTRM_SRC="src-tauri/scripts/postrm"
  DEB_FILE=$(find "$DEB_DIR" -name "*.deb" | head -1)

  if [ -n "$DEB_FILE" ] && [ -f "$POSTRM_SRC" ]; then
    echo ""
    echo "[+] Menyuntikkan postrm cleanup script ke $DEB_FILE ..."
    TMPDIR=$(mktemp -d)
    # Extract existing .deb
    dpkg-deb --raw-extract "$DEB_FILE" "$TMPDIR/pkg"
    # Copy postrm script to control directory
    cp "$POSTRM_SRC" "$TMPDIR/pkg/DEBIAN/postrm"
    chmod 0755 "$TMPDIR/pkg/DEBIAN/postrm"
    # Repackage the .deb
    dpkg-deb --build "$TMPDIR/pkg" "$DEB_FILE"
    rm -rf "$TMPDIR"
    echo "[✓] postrm script berhasil disuntikkan ke paket .deb!"
  else
    echo "[!] Warning: File .deb atau script postrm tidak ditemukan, skip injeksi."
  fi

elif [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Target: macOS App Bundle"
  npx tauri build
else
  echo "OS tidak dikenali ($OSTYPE), mencoba default build..."
  npx tauri build
fi

echo "=========================================="
echo "  BUILD SUKSES!"
echo "=========================================="
echo "Lokasi hasil executable:"
echo " - Binary/Exe : webapp/src-tauri/target/release/"
echo " - Bundle/Pkg : webapp/src-tauri/target/release/bundle/"
echo "=========================================="
