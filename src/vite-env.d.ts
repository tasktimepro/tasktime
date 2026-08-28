/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_DEBUGBUNDLE_PROJECT_TOKEN?: string
	readonly VITE_DEBUGBUNDLE_ENVIRONMENT?: string
	readonly VITE_DROPBOX_CLOUD_UI_ENABLED?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
