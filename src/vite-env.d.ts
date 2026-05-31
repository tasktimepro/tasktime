/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_DEBUGBUNDLE_PROJECT_TOKEN?: string
	readonly VITE_DEBUGBUNDLE_ENVIRONMENT?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}