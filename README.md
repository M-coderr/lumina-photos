# Lumina Photos 🌟
> **A complete self-hosted Google Photos alternative with your PC as the private cloud server.**  
> 100% Zero-Knowledge Privacy • Plug & Play Remote & Local Sync • Commercial Licensing & Switch Controls

---

## 🚀 Key Features

* **Exact Google Photos User Experience:**
  * **Timeline Grid:** Date-grouped feed with sticky date headers ("Today", "Yesterday", "Nov 2024").
  * **Interactive Scrubber:** Fast jump scrubber on the right edge to navigate by year/month.
  * **Fullscreen Lightbox Viewer:** High-fidelity previews, keyboard arrows navigation, zoom, and slide-out EXIF inspector (Camera, Lens, ISO, Aperture, Exposure, GPS map link).
  * **Albums & Collections:** Create custom albums with cover photos.
  * **Favorites & Trash:** Star photos and soft-delete to Trash with permanent purge / restore options.
* **Auto-Detection & Multi-Folder Sync:**
  * **On PC:** Live file-system watcher (`watchdog`) monitors designated PC folders (e.g., `D:\Pictures`, `E:\FamilyPhotos`). Any new photo dropped in is auto-detected, indexed, and displayed in real-time.
  * **On Mobile:** Cross-platform mobile sync client monitors camera roll / phone albums (`Camera`, `WhatsApp`, `Screenshots`) and auto-uploads new media to the PC.
* **Multi-Tier High-Speed Pipeline:**
  * **Micro-thumbnails (240px WebP):** ~10–15KB for ultra-fast infinite scrolling.
  * **Preview-thumbnails (1600px WebP):** ~150KB for instant lightbox viewing without loading massive RAW files.
  * **Original media:** Kept pristine in year/month structured folders.
  * **SHA-256 Deduplication:** Prevents duplicate uploads from wasting disk space.
* **Live Real-time Synchronization (WebSockets):**
  * As soon as a photo is uploaded or detected in a watched folder, it dynamically appears on all connected desktop browsers and mobile screens without refreshing.
* **The Creator/Admin Switch & Monetization Engine:**
  * **Zero-Knowledge Architecture:** You (the app creator) **never** have access to users' personal photos, videos, or files.
  * **The Switch:** Remote license verification controller allows toggling server status between `ACTIVE`, `TRIAL`, `PAUSED`, and `EXPIRED`.
  * When paused or expired, uploads and auto-sync are paused while the existing library stays safely read-only for the user.

---

## 🛠️ Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────┐
│                   YOUR PC (HOME SERVER)                │
│  • FastAPI + Uvicorn Async Core                        │
│  • SQLite with WAL mode & automated schema             │
│  • Pillow EXIF & WebP thumbnail generation             │
│  • Real-time Watchdog folder observer                  │
│  • WebSocket live notification broadcaster             │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│     DESKTOP BROWSER     │     │     MOBILE CLIENT       │
│  • React 19 + Vite      │     │  • React Native (Expo)  │
│  • Tailwind CSS v4      │     │  • MediaLibrary auto-   │
│  • Scrubber & Lightbox  │     │    detection worker     │
│  • QR Pairing Modal     │     │  • QR Code pair scanner │
│  • Admin Switch Panel   │     │  • Offline / Wi-Fi sync │
└─────────────────────────┘     └─────────────────────────┘
```

---

## ⚡ Running the App on Your PC

### 1. One-Click Quick Start (Windows)
Double-click `start_lumina.bat` or run:
```powershell
.\start_lumina.bat
```
This automatically initializes the environment, starts the server engine, and launches `http://localhost:8000` in your browser.

### 2. Manual Terminal Launch
```powershell
# Activate venv & set python path
$env:PYTHONPATH = "."
.\.venv\Scripts\python.exe server\run_server.py
```
Open **`http://localhost:8000`** in your browser.

---

## 📱 Mobile App Setup & Pairing

1. Click **"Pair Mobile"** in the top navigation bar of the web app.
2. A unique pairing **QR Code** and connection URL (e.g. `http://192.168.1.X:8000`) will be displayed.
3. Open the mobile app in `mobile/`:
   ```bash
   cd mobile
   npx expo start
   ```
4. Point your phone camera at the QR code to pair instantly!
5. In the mobile app, tap **"⚡ Auto-Backup"** to automatically scan your phone's camera roll and upload all new photos to your PC.

---

## 💼 The Admin "Switch" & Monetization

Click the **Status Pill** in the top-right navbar (showing `Active`, `Trial`, or `Paused`) to open the **Server Switch & Monetization Controller**:

1. **Active (Pro Tier):** Full operational mode.
2. **Trial:** Roll-out free access for acquiring early users.
3. **Paused / Expired (The Switch):** Suspends uploads and remote sync while keeping the user's existing photo library intact.
4. **Subscription Tiers:**
   * **Free Tier:** Local Wi-Fi backup.
   * **Pro Monthly ($3.99/mo):** Zero-config remote tunnel + background cellular sync.
   * **Pro Yearly ($35/yr) / Lifetime ($89 once):** High-converting plans for self-hosters.
