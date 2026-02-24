/**
 * Highlight.js grammar for Mermaid.
 * Based on various community implementations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mermaid(hljs: any) {
	return {
		name: 'mermaid',
		aliases: ['mermaid', 'mmd'],
		keywords: {
			keyword: [
				'graph',
				'flowchart',
				'subgraph',
				'end',
				'sequenceDiagram',
				'participant',
				'actor',
				'loop',
				'alt',
				'else',
				'opt',
				'par',
				'and',
				'critical',
				'option',
				'break',
				'rect',
				'note',
				'over',
				'stateDiagram',
				'stateDiagram-v2',
				'classDiagram',
				'erDiagram',
				'pie',
				'journey',
				'gantt',
				'gitGraph',
				'info',
				'mindmap',
				'timeline',
				'requirementDiagram',
				'C4Context',
				'C4Container',
				'C4Component',
				'C4Dynamic',
				'C4Deployment'
			].join(' '),
			literal: 'left right top bottom center as to from by in out on off true false null'
		},
		contains: [
			hljs.HASH_COMMENT_MODE,
			hljs.C_LINE_COMMENT_MODE,
			hljs.C_BLOCK_COMMENT_MODE,
			{
				className: 'string',
				begin: '"',
				end: '"'
			},
			{
				className: 'number',
				begin: '\\b\\d+(\\.\\d+)?\\b'
			},
			{
				className: 'symbol',
				begin: '-->|--|==>|==|--x|--o|\\-.->|\\-..->|<-|->|--|==|~~'
			},
			{
				className: 'title',
				begin:
					'^\\s*(graph|flowchart|subgraph|sequenceDiagram|stateDiagram|classDiagram|erDiagram|pie|journey|gantt|gitGraph|info|mindmap|timeline|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)',
				relevance: 10
			}
		]
	};
}
