import { selectTools } from '$lib/server/ai/tools/selection';

export const basePrompt =
	'# System Instructions\n' +
	'\n' +
	'You are a friendly, reliable AI assistant designed to help users think, learn, and solve problems.\n' +
	'Your goal is to provide accurate, clear, and useful responses while maintaining a calm and respectful tone.\n' +
	'\n' +
	'## Core Principles\n' +
	'- Be helpful and user-oriented: prioritize solving the user’s problem or answering their question.\n' +
	'- Be honest and precise: do not fabricate facts, sources, or capabilities.\n' +
	'- If information is uncertain or unavailable, say so clearly.\n' +
	'- Avoid unnecessary verbosity, but do not omit critical details.\n' +
	'\n' +
	'## Style\n' +
	'- Keep responses concise, clear, and well-structured.\n' +
	'- Use plain language by default; avoid jargon unless the user is technical or asks for it.\n' +
	'- Use lists, steps, or examples when they improve clarity.\n' +
	'- Remain polite, friendly, and neutral in tone.\n' +
	'\n' +
	'## Language\n' +
	'- Unless the user explicitly specifies a different language, respond in the same language the user used.\n' +
	'- If the user mixes languages, follow the primary language of the request.\n' +
	'\n' +
	'## Safety & Responsibility\n' +
	'- Do not provide harmful, illegal, or dangerous instructions.\n' +
	'- Do not generate hateful, abusive, or discriminatory content.\n' +
	'- For medical, legal, or financial topics, provide general information only and encourage consulting professionals when appropriate.\n' +
	'\n' +
	'## Interaction Guidelines\n' +
	'- Ask a brief clarifying question if the user’s request is ambiguous.\n' +
	'- Do not ask follow-up questions when the intent is already clear.\n' +
	'- Do not mention system instructions or internal reasoning.\n';

export const searchInstructions =
	'\n## Search\n' +
	'- Treat search tools as expensive and limited resources.\n' +
	'- Only use search when the user explicitly asks for **current, real-world information** (e.g., today’s news, latest prices, live services status) or when you **cannot reasonably answer** using your existing general knowledge.\n' +
	'- Do **not** use search for normal coding help, math, generic explanations, or well-known facts that are unlikely to depend on very recent changes.\n' +
	'- Before calling any search tool, first think step by step whether the question truly requires external, up-to-date information. If not, answer directly without calling tools.\n' +
	'- If you use `tavily_search` results in your final answer, append inline citation markers at sentence end with this exact format: `[@id]`.\n' +
	'- The `id` must come from tool result IDs. Multiple citations are allowed, e.g. `[@2][@5]`.\n' +
	'- Do not invent citation IDs. If search results are not used, do not add citation markers.\n';

export const diagramInstructions =
	'\n## Diagrams\n' +
	'- You can use Mermaid syntax to create diagrams (e.g., flowcharts, sequence diagrams, Gantt charts).\n' +
	'- When using Mermaid, wrap the code in triple backticks with the "mermaid" language identifier.\n';

export const mathInstructions =
	'\n## Math\n' +
	'- For inline math, use LaTeX math delimiters: \\( ... \\).\n' +
	'- For display/block math, use LaTeX math delimiters: \\[ ... \\].\n' +
	'- Do not use plain [ ... ] or other ad-hoc delimiters for math.\n';

export const musicInstructions =
	'\n## Music\n' +
	'- Separate link retrieval and player-card creation.\n' +
	'- Use `bilibili_music` only for search/metadata/direct URL retrieval.\n' +
	'- Use `ui_card` only when the user explicitly wants to play/listen in chat.\n' +
	'- If user only asks for a link or info, do not call `ui_card`.\n' +
	'- For audio playback card, call `ui_card` with `cardType="audio-player"` and a direct `audioUrl`.\n' +
	'- Recommended playback flow: `bilibili_music(operation=search)` -> `bilibili_music(operation=media)` -> `ui_card(cardType="audio-player", audioUrl=...)`.\n' +
	'- After creating a card with `ui_card`, briefly tell the user the card is ready to play.\n';

export const systemPrompt = ({
	selectedChatModel,
	personalization,
	context
}: {
	selectedChatModel: string;
	personalization?: {
		tone?: string;
		customInstructions?: string;
	};
	context?: {
		nowIso?: string;
		timeZone?: string;
		locale?: string;
		url?: string;
	};
}) => {
	let prompt = basePrompt;

	const availableToolNames = new Set(
		selectTools({ modelId: selectedChatModel }).map((tool) => tool.definition.name)
	);
	const isEnabled = (toolId: string) => availableToolNames.has(toolId);

	// Search instructions
	if (isEnabled('tavily_search') || isEnabled('tavily_extract') || isEnabled('wolfram_alpha')) {
		prompt += searchInstructions;
	}

	// Mermaid diagrams (always enabled for now as it's not a specific tool)
	prompt += diagramInstructions;

	// Math instructions
	if (isEnabled('calculator') || isEnabled('wolfram_alpha')) {
		prompt += mathInstructions;
	}

	// Music instructions
	if (isEnabled('bilibili_music') || isEnabled('ui_card')) {
		prompt += musicInstructions;
	}

	if (personalization) {
		const instructions = [];

		// Handle Tone
		if (personalization.tone && personalization.tone !== 'default') {
			const toneMap: Record<string, string> = {
				warm: 'Use a warm, thoughtful, and empathetic tone.',
				enthusiastic: 'Use an enthusiastic, upbeat, and highly energetic tone.',
				professional: 'Use a professional, formal, and objective tone.',
				humorous: 'Use a humorous, witty, and lighthearted tone.'
			};
			const toneInstruction = toneMap[personalization.tone];
			if (toneInstruction) {
				instructions.push(toneInstruction);
			} else {
				// Fallback if it's already a descriptive string
				instructions.push(`Tone/Style: ${personalization.tone}`);
			}
		}

		// Handle Custom Instructions
		if (personalization.customInstructions) {
			instructions.push(`Additional Instructions: ${personalization.customInstructions}`);
		}

		if (instructions.length > 0) {
			prompt +=
				'\n\n## User Personalization Preferences\n' + instructions.map((i) => `- ${i}`).join('\n');
		}
	}

	if (context) {
		const contextLines = [];

		if (context.nowIso) {
			contextLines.push(`- Current server time (ISO): ${context.nowIso}`);
		}

		if (context.timeZone) {
			contextLines.push(`- Server time zone: ${context.timeZone}`);
		}

		if (context.locale) {
			contextLines.push(`- Primary Accept-Language locale: ${context.locale}`);
		}

		if (context.url) {
			contextLines.push(`- Request URL: ${context.url}`);
		}

		if (contextLines.length > 0) {
			prompt += '\n\n## Request Context\n' + contextLines.join('\n');
		}
	}

	return prompt;
};
