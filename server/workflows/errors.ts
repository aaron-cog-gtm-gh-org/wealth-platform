export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export function badRequest(message: string): never {
  throw new HttpError(400, message);
}

export function notFound(message: string): never {
  throw new HttpError(404, message);
}

export function conflict(message: string): never {
  throw new HttpError(409, message);
}
