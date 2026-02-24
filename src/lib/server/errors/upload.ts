import { TaggedError } from '$lib/server/errors/tagged-error';

export class UploadForbiddenError extends TaggedError<'UploadForbiddenError'> {
	constructor(options: ErrorOptions = {}) {
		super('Forbidden upload access', options);
	}
}

export class UploadNotFoundError extends TaggedError<'UploadNotFoundError'> {
	constructor(options: ErrorOptions = {}) {
		super('Upload file not found', options);
	}
}

export type UploadError = UploadForbiddenError | UploadNotFoundError;
