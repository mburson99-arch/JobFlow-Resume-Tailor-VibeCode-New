const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("path");
const http = require("http");

const PORT = 3000;
const HOST = "localhost";

let mainWindow;

function loadRuntimeEnv(envPath) {
  try {
    const fs = require("fs");
    if (!fs.existsSync(envPath)) return;

    const contents = fs.readFileSync(envPath, "utf8");
    contents.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const separator = trimmed.indexOf("=");
      if (separator === -1) return;

      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    console.warn("Could not load JobFlow runtime environment:", error);
  }
}

function isLocalAppUrl(url) {
  return url.startsWith(`http://${HOST}:${PORT}`);
}

function isGoogleAuthUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "accounts.google.com" ||
      parsed.hostname === "ssl.gstatic.com" ||
      parsed.hostname.endsWith(".google.com") ||
      parsed.hostname.endsWith(".gstatic.com")
    );
  } catch (_) {
    return false;
  }
}

function isDev() {
  return !app.isPackaged;
}

function getServerEntrypoint() {
  if (isDev()) {
    // In dev, we rely on `npm run dev` (tsx server.ts) started by the script.
    return null;
  }
  return path.join(app.getAppPath(), "dist", "server.cjs");
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nativeWindowOpen: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isGoogleAuthUrl(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          parent: mainWindow,
          modal: false,
          webPreferences: {
            contextIsolation: true,
            nativeWindowOpen: true,
          },
        },
      };
    }

    if (!isLocalAppUrl(url)) {
      shell.openExternal(url);
      return { action: "deny" };
    }

    return { action: "allow" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isLocalAppUrl(url) && !isGoogleAuthUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const url = `http://${HOST}:${PORT}`;
  await mainWindow.loadURL(url);
}

function startBundledServer() {
  const entry = getServerEntrypoint();
  if (!entry) return;

  const dataDir = app.getPath("userData");
  const assetsDir = path.join(app.getAppPath(), "dist");

  process.env.NODE_ENV = "production";
  process.env.JOBFLOW_DATA_DIR = dataDir;
  process.env.JOBFLOW_ASSETS_DIR = assetsDir;
  loadRuntimeEnv(path.join(dataDir, ".env"));
  loadRuntimeEnv(path.join(app.getAppPath(), ".env"));

  require(entry);
}

function waitForServer(timeoutMs = 15000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://${HOST}:${PORT}`, (res) => {
        res.resume();
        resolve();
      });

      req.on("error", (error) => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(error);
          return;
        }

        setTimeout(check, 250);
      });

      req.setTimeout(1000, () => {
        req.destroy();
      });
    };

    check();
  });
}

app.on("before-quit", () => {
  app.isQuitting = true;
});

app.whenReady().then(async () => {
  try {
    startBundledServer();
    await waitForServer();
    await createWindow();
  } catch (e) {
    dialog.showErrorBox(
      "Failed to start JobFlow",
      e?.message ? String(e.message) : String(e)
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
