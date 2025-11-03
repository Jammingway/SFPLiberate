# SFPLiberate

**A community-driven web tool to unlock the full potential of the Unifi SFP Wizard.**

`SFPLiberate` is a companion web application for the **Ubiquiti SFP Wizard (UACC‑SFP‑Wizard)**, a portable, ESP32‑class SFP/SFP+ module programmer. ### Device Pr-### Device Pr### Configur##-   The backend API docs are available at `http://localhost:8080/api/docs` when running.

## Documentationcumentationmentation Device Profile (Service/Characteristic UUIDs)

- UUIDs are device-specific and are discovered automatically via the BLE Proxy inspect flow when enabled.
- The profile (service UUID, write characteristic UUID, notify characteristic UUID) is saved to LocalStorage and used for subsequent connections.
- You can persist a discovered profile into `.env` using the "Save as Deployment Defaults (requires docker restart)" action. This pre-seeds the profile on startup. Env keys: `SFP_SERVICE_UUID`, `SFP_WRITE_CHAR_UUID`, `SFP_NOTIFY_CHAR_UUID`.
- For iOS/Safari users without BLE Proxy enabled, use a desktop browser or Bluefy (iOS) for direct Web Bluetooth access.

For full API documentation, see `docs/BLE_API_SPECIFICATION.md`.

### Deployment

For Docker deployment with BLE Proxy enabled, see `docs/DOCKER_DEPLOYMENT.md` for DBus mounts, USB passthrough, and environment configuration. To run without the BLE Proxy service, set `BLE_PROXY_ENABLED=false` in your `.env` file. Debuggingce/Characteristic UUIDs)

- UUIDs are device-specific and are discovered automatically via the BLE Proxy inspect flow when enabled.
- The profile (service UUID, write characteristic UUID, notify characteristic UUID) is saved to LocalStorage and used for subsequent connections.
- You can persist a discovered profile into `.env` using the "Save as Deployment Defaults (requires docker restart)" action. This pre-seeds the profile on startup. Env keys: `SFP_SERVICE_UUID`, `SFP_WRITE_CHAR_UUID`, `SFP_NOTIFY_CHAR_UUID`.
- For iOS/Safari users without BLE Proxy enabled, use a desktop browser or Bluefy (iOS) for direct Web Bluetooth access.

For full API documentation, see `docs/BLE_API_SPECIFICATION.md`.

### Deployment

For Docker deployment with BLE Proxy enabled, see `docs/DOCKER_DEPLOYMENT.md` for DBus mounts, USB passthrough, and environment configuration. To run without the BLE Proxy service, set `BLE_PROXY_ENABLED=false` in your `.env` file.

### Artifacts & Debuggingare device-specific and are discovered automatically via the BLE Proxy inspect flow when enabled.
- The profile (service UUID, write characteristic UUID, notify characteristic UUID) is saved to LocalStorage and used for subsequent connections.
- You can persist a discovered profile into `.env` using the "Save as Deployment Defaults (requires docker restart)" action. This pre-seeds the profile on startup. Env keys: `SFP_SERVICE_UUID`, `SFP_WRITE_CHAR_UUID`, `SFP_NOTIFY_CHAR_UUID`.
- For iOS/Safari users without BLE Proxy enabled, use a desktop browser or Bluefy (iOS) for direct Web Bluetooth access.le (Service/Characteristic UUIDs)

- UUIDs are device-specific and are discovered automatically via the BLE Proxy inspect flow when enabled.
- The profile (service UUID, write characteristic UUID, notify characteristic UUID) is saved to LocalStorage and used for subsequent connections.
- You can persist a discovered profile into `.env` using the "Save as Deployment Defaults (requires docker restart)" action. This pre-seeds the profile on startup. Env keys: `SFP_SERVICE_UUID`, `SFP_WRITE_CHAR_UUID`, `SFP_NOTIFY_CHAR_UUID`.
- For iOS/Safari users without BLE Proxy, use a desktop browser or Bluefy (iOS) for direct Web Bluetooth access.

For full API documentation, see `docs/BLE_API_SPECIFICATION.md`.

### Deployment

For Docker deployment with BLE Proxy enabled, see `docs/DOCKER_DEPLOYMENT.md` for DBus mounts, USB passthrough, and environment configuration. To run without the BLE Proxy service, set `BLE_PROXY_ENABLED=false` in your `.env` file.ard performs reading/writing on‑device while broadcasting diagnostic logs and data over BLE. This app connects over Web Bluetooth to capture those broadcasts, parse module details, and save profiles to a local library you control.

This project is built on a modern web stack, using your browser's **Web Bluetooth API** to subscribe to the SFP Wizard's BLE logs/data and a **Dockerized Python backend (SQLite)** to manage your module library. The frontend is a **Next.js 16** app (with shadcn/ui) that proxies API calls at `/api` to the backend for a single‑origin experience.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/josiah-nelson/SFPLiberate.git
cd SFPLiberate

# Start the application
docker-compose up --build

# Access at http://localhost:8080
```

That's it! The app runs entirely on your machine with a local SQLite database. No cloud services or authentication required.

## BLE Connection Modes

- **Direct (Web Bluetooth in Browser)** — Default. Your browser connects directly to the SFP Wizard via the Web Bluetooth API (Chrome/Edge/Opera, Bluefy on iOS). No special backend access to Bluetooth required.
- **BLE Proxy (via Backend)** — Optional. For environments where Web Bluetooth is not available (e.g., Safari/iOS), the backend acts as a BLE proxy over WebSocket. Enable with `BLE_PROXY_ENABLED=true` in docker-compose.yml.
- **Standalone BLE Proxy** — Lightweight Docker container (~345MB) for iOS/Safari users. See [ble-proxy-service/README.md](./ble-proxy-service/README.md) for details.

## The Goal

The Ubiquiti SFP Wizard is a powerful standalone device designed to reprogram, test, and unlock compatibility for optical modules. Two practical limitations for power users today:

- It cannot store more than one module profile at a time for writing.
- There’s no way to "copy" a module unless you already have one inserted.

The goal of `SFPLiberate` is to complement the device with a "pro" workflow for network engineers and hobbyists to:

-   **Read & Archive:** Read the full EEPROM from any SFP module and save it to a persistent, searchable library.
    
-   **Document:** Store diagnostic metrics and historical data for documentation and review.
    
-   **Clone & Reprogram:** Write EEPROM data from your library (e.g., a "known-good" Cisco config) onto a new or rewritable module. If BLE write is not supported, use the device’s on‑device push while the app provides your saved profiles.
    
-   **Liberate:** Free your modules from vendor lock‑ins by creating and sharing your own library of configurations, plus compatibility notes and statistics.
    

## How It Works (The Method)

This tool is the result of reverse‑engineering the SFP Wizard's Bluetooth LE (BLE) behavior.

1.  **Discovery:** By analyzing `syslog` output and sniffing BLE with nRF Connect, we observed that the device broadcasts human‑readable logs and data frames over a BLE characteristic. Core read/write actions occur on‑device; BLE primarily mirrors state and data.
    
2.  **BLE Interface:** Status updates like `sysmon: ... sfp:[x]` indicate module presence. Some command strings may exist (e.g., text that looks like `[POST] ...`) but their availability and behavior are not guaranteed. Reading/writing is known to be performed on‑device; triggering such actions via BLE requires further discovery.
    
3.  **Architecture:** This app is split into two parts:
    
    -   **Frontend (Browser):** A Next.js 16 app (TypeScript + shadcn/ui) that uses the **Web Bluetooth API** (`navigator.bluetooth`) to connect directly to the SFP Wizard and capture logs/data (including EEPROM dumps) for parsing and saving.
        
    -   **Backend (Docker):** A lightweight **Python (FastAPI)** server that runs in a Docker container. Provides REST API for module library with automatic database selection (SQLite for standalone, Appwrite for cloud).
        

This architecture means the complex BLE communication happens securely in your browser, while your module library is safely managed and stored by a robust backend. When Proxy mode is enabled, the backend exposes a WebSocket for BLE operations on a local adapter.

### Deployment

**Self-Hosted (Recommended):** Run the full stack locally with Docker Compose. This includes the UI, FastAPI backend with SQLite database, and optional BLE Proxy service for Safari/iOS support. Fully air-gapped capable—no internet or authentication required. Perfect for trusted LANs or personal use. See [Quick Start](#quick-start) below.

**Public Instance:** The maintainer also hosts a public instance at [sfpliberate.com](https://sfpliberate.com) using Appwrite Cloud with invite-only access. For details about this deployment, see [docs/PUBLIC_DEPLOYMENT.md](./docs/PUBLIC_DEPLOYMENT.md).

### Security & Privacy

- The app handles non‑sensitive, generic device data (SFP vendor/model/serial and binary EEPROM contents). Security is low‑priority by design.
- The **standalone BLE Proxy** runs on your local machine only (localhost binding). No internet exposure, no authentication needed. See [ble-proxy-service/README.md](./ble-proxy-service/README.md).
- **Self‑hosted** deployments are intended for trusted LANs. If you expose the stack publicly, add reverse proxy auth, rate limiting, and TLS as needed.
- For information about the maintainer's public hosted instance (which uses Appwrite authentication), see [docs/PUBLIC_DEPLOYMENT.md](./docs/PUBLIC_DEPLOYMENT.md).

## Current Features & Functionality

-   **Connect to Device:** Scan for and connect to the SFP Wizard via Web Bluetooth.
    
-   **Live Status:** Real-time status detection for BLE connection and SFP module presence.
    
-   **Capture SFP EEPROM:** Capture EEPROM data (e.g., 256+ bytes) broadcast by the device when a read is performed on‑device. If a BLE trigger command exists, it will be integrated once discovered.
    
-   **Parse SFP Data:** On‑the‑fly parsing of SFP EEPROM data (based on SFF‑8472 spec) to display Vendor, Model, and Serial Number.
    
-   **Module Library (Backend):**
    
    -   `GET /api/modules`: Load all saved modules.
        
    -   `POST /api/modules`: Save a newly read module to the database.
        
    -   `DELETE /api/modules/{id}`: Delete a module from the library.
        
    -   `GET /api/modules/{id}/eeprom`: Get the raw binary EEPROM data for a specific module, ready for writing.
        
-   **Save to Library:** Save a newly captured module with a friendly name to your library. Duplicate detection by checksum is implemented.
    
-   **Load from Library:** View your entire library of saved modules in the UI.
    

### BLE Proxy (Safari/iOS Workaround)

- Optional WebSocket endpoint at `/api/v1/ble/ws` (enable with `BLE_PROXY_ENABLED=true`).
- Frontend auto‑detects when Web Bluetooth isn’t available and falls back to Proxy (or you can select "BLE Proxy").
- Adapter selection (e.g., `hci0`) supported via a dropdown; adapters are enumerated by the backend (BlueZ/DBus).
- Environment keys: `BLE_PROXY_ENABLED`, `BLE_PROXY_DEFAULT_TIMEOUT`, `BLE_PROXY_ADAPTER`. See `docs/DOCKER_DEPLOYMENT.md`.

## Project Roadmap & TODO

This project is fully functional for capturing and archiving profiles. Writing saved profiles back to modules will depend on discovering a safe, compatible workflow (on‑device only, or BLE‑assisted if available).

-   [x] **UI:** Create the HTML/CSS/JS frontend.
    
-   [x] **Backend:** Create the Dockerized FastAPI/SQLite backend.
    
-   [x] **Documentation Site (GitHub Pages) + Community Modules Repository:**

    -   **Task:** Create a companion GitHub Pages site with docs and a public, curated repository of community‑shared SFP modules.
    
    -   **Plan:** See `docs/SIDECAR_SITE_TODO.md` for structure, `index.json` schema, and CI validation ideas.
    
    -   **Implement:** Bootstrap site (MkDocs/Docusaurus), create `SFPLiberate/modules` repo with `index.json`, CI validation, and contribution docs.

-   [ ] **Upload to Community (from Web UI):**

    -   **Task:** After reading an SFP, allow users to opt‑in to share their module to the community repository.
    
    -   **Plan:** Add an “Upload to Community (TODO)” button in the UI. No GitHub sign‑in required: submissions are posted to a backend inbox (`POST /api/submissions`) for maintainers to triage and publish to the modules repo. Also support a downloadable ZIP for manual PRs.
    
    -   **Implement:** Add an `uploadToCommunity()` stub that prepares `metadata.json` and raw `.bin` data, then either initiates OAuth flow or downloads an archive for manual PR.

-   [ ] **Import Community Modules (to Local DB):**

    -   **Task:** Let users browse and import community modules from the GitHub Pages index into their local database.
    
    -   **Plan:** Add a “Load Community Modules (TODO)” UI, fetch the public `index.json`, render a list, and allow import of selected items via a new backend endpoint (or direct binary fetch + existing save flow).
    
    -   **Implement:** Frontend `loadCommunityModulesTODO()` to fetch the index and display; backend `POST /api/modules/import` (TODO) to accept metadata + binary URL and persist. Use checksum to dedupe.

-   [x] **BLE Proxy Mode:** Backend WS + adapter selection; UI auto‑detect and fallback for Safari/iOS
    -   **Env‑driven:** `BLE_PROXY_ENABLED=true` enables WS proxy; default is `false` for standalone deployments.
    -   **Adapters:** Auto‑enumerate via DBus; allow selecting `hci0` etc. Optional default via env.

-   [ ] **Air‑Gapped Mode Docs:** Document air‑gapped deployment (offline Docker images, no external calls), and validate no external network requests in default configuration.

-   [ ] **iOS/Safari UX Polishing:** Clearer guidance, help links, and proxy hints when Web Bluetooth isn’t available.

-   [ ] **Checksums & Backups:**
    -   **Duplicate detection:** Use SHA‑256 during import/export; dedupe on save/import.
    -   **Backups:** Export all modules (and future DDM logs) to CSV/ZIP; support manual import of those files.

## Browser Compatibility

### ✅ Supported
- **Chrome** (Desktop, Android, ChromeOS) - Full Web Bluetooth support
- **Edge** (Desktop, Android) - Full Web Bluetooth support
- **Opera** (Desktop, Android) - Full Web Bluetooth support
- **Bluefy Browser** (iOS App Store) - Third-party iOS browser with full Web Bluetooth support

### ❌ NOT Supported
- **Safari** (macOS, iOS, iPadOS) - **NO Web Bluetooth support** as of Safari 18 / iOS 18
  - Apple's position: "Not Considering" this feature (privacy/fingerprinting concerns)
  - **No experimental flags available** - previous documentation suggesting this was incorrect
- **Firefox** - No Web Bluetooth support

### iOS/Safari Users
Safari does not support Web Bluetooth. You have three options:

1. **Standalone BLE Proxy** (Recommended) — Run a lightweight Docker container locally:
   ```bash
   docker run -d --name sfp-ble-proxy --network host \
     ghcr.io/sfpliberate/ble-proxy:latest
   ```
   See [ble-proxy-service/README.md](./ble-proxy-service/README.md) for full setup guide.

2. **Bluefy Browser** — Download **Bluefy – Web BLE Browser** from the App Store for direct BLE support on iOS.

3. **Self-Hosted BLE Proxy** — If running the full stack, enable BLE Proxy mode in your backend (see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)).

## Build & Run Instructions

### Prerequisites

1.  **Docker & Docker Compose:** You must have Docker installed to run the backend.
    
2.  **A Compatible Browser:** Web Bluetooth API is required. Supported browsers:
    - **Chrome** (Desktop, Android, ChromeOS) ✅
    - **Edge** (Desktop, Android) ✅
    - **Opera** (Desktop, Android) ✅
    - **Bluefy Browser** (iOS) ✅ - Download from App Store for iOS devices
    - **Safari** (all platforms) ❌ - NOT supported (see Browser Compatibility section above)
    - **Firefox** ❌ - NOT supported
    
3.  **Hardware:** A Unifi SFP Wizard device.
    

### Running the Application

This project is built to run with a single command:

1.  **Clone the Repository:**
    
    ```
    git clone [https://github.com/your-username/SFPLiberate.git](https://github.com/your-username/SFPLiberate.git)
    cd SFPLiberate
    
    ```
    
2.  Build and Run with Docker Compose:
    
    This command will:
    
    -   Build the backend (FastAPI) and frontend (Next.js) containers.
    -   Serve the frontend on `http://localhost:8080` (Next.js on port 3000 inside the container).
    -   Reverse proxy/API rewrites: the frontend proxies `/api/*` to the backend in standalone mode.
        
    
    ```
    docker-compose up --build
    
    ```
    
3.  Access the App:
    
    Once the containers are running, open your Web Bluetooth-compatible browser (e.g., Chrome) and go to:
    
    http://localhost:8080
    
    _(Note: We use port `8080` mapped to Next.js port `3000` inside the container to avoid conflicts with local servers)._ 
    
4.  **Connect and Go!**

- Click “Discover SFP and Connect”. The app will:
  1) Try Web Bluetooth Scanning to find devices named like “sfp”, harvest service UUIDs, reopen the chooser with the right permissions, infer notify/write, save the profile, and connect directly.
  2) If scanning isn’t supported (or UUIDs aren’t advertised), fall back to proxy discovery and connect via backend.

- You can also use “Scan (Open Chooser)” (unfiltered chooser) and “Proxy Discovery” manually.
        

### Development

-   To stop the application: `docker-compose down`
    
-   To view logs: `docker-compose logs -f backend` or `docker-compose logs -f frontend`
    
-   The backend API docs are available at `http://localhost:8080/api/docs` when running.

## Documentation

Comprehensive documentation is available in the `docs/` directory:

### Deployment Guides
- **[APPWRITE_SITES_DEPLOYMENT.md](./docs/APPWRITE_SITES_DEPLOYMENT.md)** - Complete guide to deploying on Appwrite Sites (Git Auto-Deploy, Manual Upload, CLI methods)
- **[DOCKER_DEPLOYMENT.md](./docs/DOCKER_DEPLOYMENT.md)** - Self-hosted Docker deployment with BLE proxy setup
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - General deployment overview and recommendations

### Configuration
- **[ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md)** - Complete reference for all environment variables across deployment modes
- **[APPWRITE_CONFIGURATION_UPDATE.md](./docs/APPWRITE_CONFIGURATION_UPDATE.md)** - Migration guide for Appwrite auto-injected variables

### API & Technical
- **[BLE_API_SPECIFICATION.md](./docs/BLE_API_SPECIFICATION.md)** - BLE protocol specification and reverse-engineering notes
- **[APPWRITE_DATABASE_IMPLEMENTATION.md](./docs/APPWRITE_DATABASE_IMPLEMENTATION.md)** - Backend database implementation details
- **[AUTH_SYSTEM.md](./docs/AUTH_SYSTEM.md)** - Appwrite authentication integration

### Development
- **[BLUETOOTH_MIGRATION_GUIDE.md](./docs/BLUETOOTH_MIGRATION_GUIDE.md)** - Guide for Bluetooth API changes
- **[BLUETOOTH_TESTING_GUIDE.md](./docs/BLUETOOTH_TESTING_GUIDE.md)** - Testing procedures for BLE features
- **[MODERNIZATION_SUMMARY.md](./docs/MODERNIZATION_SUMMARY.md)** - Architecture modernization overview

### BLE Proxy
- **[STANDALONE_BLE_PROXY_SERVICE.md](./docs/STANDALONE_BLE_PROXY_SERVICE.md)** - Standalone BLE proxy for iOS/Safari support
- **[ble-proxy-service/README.md](./ble-proxy-service/README.md)** - BLE proxy service documentation

## Disclaimer

This project is an independent, community‑driven effort and is not affiliated with, endorsed by, or supported by Ubiquiti. The SFP Wizard’s firmware and BLE behavior may change at any time; this tool may stop working without notice if a firmware update alters the observed interfaces. Use at your own risk.
    

## Contributing

Contributions are highly encouraged! The most critical need is to reverse-engineer the SFP Write protocol. If you have any insights, please open an Issue or a Pull Request.
