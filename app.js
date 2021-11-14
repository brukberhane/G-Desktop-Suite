const { BrowserWindow, ipcMain, nativeTheme, app, session } = require("electron");

const store = require("./src/helpers/store");
const config = require("./src/helpers/config");
const { setThemeOnAllWindows } = require("./src/helpers/theme");
const {
  CONSTANTS: { OS_PLATFORMS, THEME_OPTIONS, USER_PREF_KEYS },
} = require("./src/helpers/util");

const { createMainWindow } = require("./src/js/mainwindow");
const path = require("path");
const {userAgent, signInURL} = require("./src/helpers/config");
const isPackaged = require('electron-is-packaged').isPackaged;

// Listen for theme requests from windows to set theme
ipcMain.on("theme-request", function (_, webContentsId) {
  setThemeOnAllWindows();
});

// Listen for changes in native os theme to set theme
nativeTheme.on("updated", () => {
  // Don't change theme if not set to auto.
  if (store.get(USER_PREF_KEYS.THEME) !== THEME_OPTIONS.AUTO) {
    return;
  }
  setThemeOnAllWindows();
});

// Listen for changes in store
const unsubscribeStoreWatch = store.onDidChange(USER_PREF_KEYS.THEME, () => {
  setThemeOnAllWindows();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {

  // Assumes that you put the unpacked extension in the project folder and called the folder "offline"
  const appPackagedPath = `${isPackaged && config.osPlatform === OS_PLATFORMS.MAC_OS ? ".." : "."}/offline`;
  const offlineToolsPath = path.join(path.dirname(process.execPath), appPackagedPath);
  await session.defaultSession.loadExtension(offlineToolsPath).then(() => createMainWindow()).catch((e) => console.error(e));
  // Check the urls and pass the weird User-Agent to let google sign you in.
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.includes("accounts.google")){
      details.requestHeaders['User-Agent'] = "Chrome";
    } else {
      details.requestHeaders['User-Agent'] = userAgent;
    }
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// Quit when all windows are closed.
app.on("window-all-closed", function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (config.osPlatform === OS_PLATFORMS.MAC_OS) app.quit();

  unsubscribeStoreWatch();
});

// Make store accessible for easy access in other files.
module.exports = { store };
