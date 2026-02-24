import { z } from 'zod';

export const DeleteChatSchema = z.object({
	id: z.string()
});

export const ChatRequestSchema = z.object({
	id: z.string(),
	parentId: z.string().nullable().optional(),
	assistantMessageId: z.string().optional(),
	personalization: z
		.object({
			tone: z.string().optional(),
			customInstructions: z.string().optional()
		})
		.optional(),
	messages: z
		.array(
			z
				.looseObject({
					id: z.string(),
					role: z.enum(['system', 'user', 'assistant', 'data', 'tool']),
					content: z.union([z.string(), z.array(z.any())]).optional(),
					parts: z
						.array(
							z.looseObject({
								type: z.string()
							})
						)
						.default([])
				})
				.superRefine((m, ctx) => {
					const hasContent =
						(typeof m.content === 'string' && m.content.trim().length > 0) ||
						(Array.isArray(m.content) && m.content.length > 0);
					const hasParts = Array.isArray(m.parts) && m.parts.length > 0;
					if (!hasContent && !hasParts) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							message: 'Message must have content or parts'
						});
					}
				})
		)
		.nonempty()
});

export const StartRunSchema = ChatRequestSchema.extend({
	assistantMessageId: z.string().min(1)
});

export const ActiveRunQuerySchema = z.object({
	chatId: z.string().min(1)
});

export const VoteSchema = z.object({
	type: z.enum(['up', 'down'])
});

export const ChatTitleSchema = z.object({
	chatId: z.string(),
	title: z.string().min(1)
});

export const PinnedSchema = z.object({
	chatId: z.string(),
	pinned: z.boolean()
});

export const ChatUnreadSchema = z.object({
	chatId: z.string(),
	unread: z.boolean()
});

export const ShareChatSchema = z.object({
	chatId: z.string()
});

export const SynchronizedCookieSchema = z.object({
	value: z.string()
});

export const DeleteFileSchema = z.object({
	url: z.string().min(1)
});

export const RenameFileSchema = z.object({
	url: z.string().min(1),
	name: z.string().trim().min(1).max(255)
});

export const UpdateProfileSchema = z.object({
	displayName: z.string().max(40).nullable().optional(),
	avatarUrl: z.string().trim().min(1).nullable().optional()
});
