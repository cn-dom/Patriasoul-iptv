const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("patriaSoul", Object.freeze({
  appName: "PatriaSoul IPTV",
  version: "0.1.0"
}));
