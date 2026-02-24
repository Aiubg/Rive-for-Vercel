import { dev } from '$app/environment';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LogLevels: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3
};

class Logger {
	private level: LogLevel;

	constructor(level: LogLevel = process.env.NODE_ENV === 'test' ? 'info' : dev ? 'debug' : 'info') {
		this.level = level;
	}

	setLevel(level: LogLevel) {
		this.level = level;
	}

	private shouldLog(level: LogLevel): boolean {
		return LogLevels[level] >= LogLevels[this.level];
	}

	private getTimestamp(): string {
		const now = new Date();
		return now.toISOString().split('T')[1]?.slice(0, 8) ?? '';
	}

	private formatMessage(level: LogLevel, message: string): string {
		const timestamp = this.getTimestamp();
		return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
	}

	info(message: string, ...args: unknown[]) {
		this.log('info', message, ...args);
	}

	warn(message: string, ...args: unknown[]) {
		this.log('warn', message, ...args);
	}

	error(message: string, ...args: unknown[]) {
		this.log('error', message, ...args);
	}

	debug(message: string, ...args: unknown[]) {
		this.log('debug', message, ...args);
	}

	private log(level: LogLevel, message: string, ...args: unknown[]) {
		if (!this.shouldLog(level)) return;

		const formattedMessage = this.formatMessage(level, message);
		const fn =
			level === 'error'
				? console.error
				: level === 'warn'
					? console.warn
					: level === 'debug'
						? console.debug
						: console.info;
		fn(formattedMessage, ...args);
	}
}

export const logger = new Logger();
