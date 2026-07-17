/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COPERNICUS_CLIENT_ID?: string;
  readonly VITE_COPERNICUS_CLIENT_SECRET?: string;
  readonly VITE_COPERNICUS_CATALOG_URL?: string;
  readonly VITE_COPERNICUS_PROCESS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

