declare module '$env/static/private' {
	export const XAI_API_KEY: string;
	export const GROQ_API_KEY: string;
	export const ANTHROPIC_API_KEY: string;
	export const OPENAI_API_KEY: string;
	export const SILICONFLOW_API_KEY: string;
	export const GOOGLE_GENERATIVE_AI_API_KEY: string;
	export const DEEPSEEK_API_KEY: string;
	export const OPENROUTER_API_KEY: string;
	export const OPENROUTER_SITE_URL: string;
	export const OPENROUTER_APP_NAME: string;
	export const WOLFRAM_ALPHA_APP_ID: string;
	export const LIBSQL_URL: string;
	export const LIBSQL_AUTH_TOKEN: string;
}

declare module '$env/static/public' {
	export const PUBLIC_ALLOW_ANONYMOUS_CHATS: string;
}
