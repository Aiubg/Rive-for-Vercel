CREATE TABLE `GenerationRun` (
	`id` text PRIMARY KEY NOT NULL,
	`chatId` text NOT NULL,
	`userId` text NOT NULL,
	`status` text NOT NULL,
	`modelId` text NOT NULL,
	`userMessageId` text NOT NULL,
	`assistantMessageId` text NOT NULL,
	`messages` text NOT NULL,
	`personalization` text NOT NULL,
	`generationSettings` text DEFAULT '{}' NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	`startedAt` integer,
	`finishedAt` integer,
	`error` text,
	FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userMessageId`) REFERENCES `Message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `RunEvent` (
	`runId` text NOT NULL,
	`seq` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`chunk` text NOT NULL,
	PRIMARY KEY(`runId`, `seq`),
	FOREIGN KEY (`runId`) REFERENCES `GenerationRun`(`id`) ON UPDATE no action ON DELETE cascade
);
