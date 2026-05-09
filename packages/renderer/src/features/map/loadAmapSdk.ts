/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig?: {
      securityJsCode: string;
    };
  }
}

let loadPromise: Promise<any> | null = null;
const pluginPromises = new Map<string, Promise<any>>();
const AMAP_SDK_TIMEOUT_MS = 10000;
const AMAP_PLUGIN_TIMEOUT_MS = 8000;

export function loadAmapSdk(): Promise<any> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (window.AMap) {
      resolve(window.AMap);
      return;
    }

    const key = String(import.meta.env.VITE_AMAP_KEY ?? "").trim();
    const securityJsCode = String(import.meta.env.VITE_AMAP_SECURITY_JS_CODE ?? "").trim();

    if (!key) {
      reject(new Error("VITE_AMAP_KEY is not set in .env.local"));
      return;
    }

    if (securityJsCode) {
      window._AMapSecurityConfig = {
        securityJsCode,
      };
    } else if (window._AMapSecurityConfig) {
      delete window._AMapSecurityConfig;
    }

    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      loadPromise = null;
      script.remove();
      reject(new Error("AMap SDK load timed out"));
    }, AMAP_SDK_TIMEOUT_MS);

    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timeoutId);
      if (window.AMap) {
        resolve(window.AMap);
      } else {
        loadPromise = null;
        reject(new Error("AMap SDK loaded but window.AMap is undefined"));
      }
    };
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      loadPromise = null;
      reject(new Error("Failed to load AMap SDK"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export async function loadAmapPlugin(pluginName: string): Promise<any> {
  const AMap = await loadAmapSdk();

  if (pluginPromises.has(pluginName)) {
    return pluginPromises.get(pluginName)!;
  }

  const promise = new Promise<any>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pluginPromises.delete(pluginName);
      reject(new Error(`AMap plugin load timed out: ${pluginName}`));
    }, AMAP_PLUGIN_TIMEOUT_MS);

    AMap.plugin(pluginName, () => {
      window.clearTimeout(timeoutId);
      resolve(AMap);
    });
  });

  pluginPromises.set(pluginName, promise);
  return promise;
}
