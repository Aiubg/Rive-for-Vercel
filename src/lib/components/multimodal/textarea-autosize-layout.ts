export function computeTextareaAutosizeLayout(args: {
	scrollHeight: number;
	viewportInnerHeight: number | null | undefined;
	maxHeight: number;
	minHeight?: number;
	extraHeight?: number;
}) {
	const minH = args.minHeight ?? 60;
	const extraHeight =
		typeof args.extraHeight === 'number' && Number.isFinite(args.extraHeight)
			? args.extraHeight
			: 0;
	const viewportInnerHeight =
		typeof args.viewportInnerHeight === 'number' && Number.isFinite(args.viewportInnerHeight)
			? args.viewportInnerHeight
			: null;
	const viewportBound =
		viewportInnerHeight && viewportInnerHeight > 0 ? viewportInnerHeight * 0.5 : args.maxHeight;
	const maxH = Math.min(viewportBound, args.maxHeight);
	const fullHeight = args.scrollHeight + Math.max(0, extraHeight);
	const height = Math.max(minH, Math.min(fullHeight, Math.floor(maxH)));
	const overflowY = fullHeight > height ? 'auto' : 'hidden';
	const stickToBottom = fullHeight > height;

	return { height, overflowY, stickToBottom };
}
