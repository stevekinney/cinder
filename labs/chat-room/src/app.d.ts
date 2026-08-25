// See https://svelte.dev/docs/kit/types#app.d.ts for the available interfaces.
declare global {
	namespace App {}
}

declare module '$env/static/private' {
	export const ANTHROPIC_API_KEY: string;
}

export {};
