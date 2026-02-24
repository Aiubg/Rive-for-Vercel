PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_Chat` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`userId` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_Chat`("id", "createdAt", "updatedAt", "title", "userId", "visibility", "pinned") SELECT "id", "createdAt", "updatedAt", "title", "userId", "visibility", "pinned" FROM `Chat`;--> statement-breakpoint
DROP TABLE `Chat`;--> statement-breakpoint
ALTER TABLE `__new_Chat` RENAME TO `Chat`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_Message` (
	`id` text PRIMARY KEY NOT NULL,
	`chatId` text NOT NULL,
	`role` text NOT NULL,
	`parentId` text,
	`parts` text NOT NULL,
	`attachments` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parentId`) REFERENCES `Message`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_Message`("id", "chatId", "role", "parentId", "parts", "attachments", "createdAt") SELECT "id", "chatId", "role", "parentId", "parts", "attachments", "createdAt" FROM `Message`;--> statement-breakpoint
DROP TABLE `Message`;--> statement-breakpoint
ALTER TABLE `__new_Message` RENAME TO `Message`;--> statement-breakpoint
CREATE TABLE `__new_Session` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_Session`("id", "userId", "expires_at") SELECT "id", "userId", "expires_at" FROM `Session`;--> statement-breakpoint
DROP TABLE `Session`;--> statement-breakpoint
ALTER TABLE `__new_Session` RENAME TO `Session`;--> statement-breakpoint
CREATE TABLE `__new_Share` (
	`id` text PRIMARY KEY NOT NULL,
	`chatId` text NOT NULL,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_Share`("id", "chatId", "userId", "createdAt") SELECT "id", "chatId", "userId", "createdAt" FROM `Share`;--> statement-breakpoint
DROP TABLE `Share`;--> statement-breakpoint
ALTER TABLE `__new_Share` RENAME TO `Share`;--> statement-breakpoint
CREATE TABLE `__new_Vote` (
	`chatId` text NOT NULL,
	`messageId` text NOT NULL,
	`isUpvoted` integer NOT NULL,
	PRIMARY KEY(`chatId`, `messageId`),
	FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_Vote`("chatId", "messageId", "isUpvoted") SELECT "chatId", "messageId", "isUpvoted" FROM `Vote`;--> statement-breakpoint
DROP TABLE `Vote`;--> statement-breakpoint
ALTER TABLE `__new_Vote` RENAME TO `Vote`;