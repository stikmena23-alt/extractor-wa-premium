export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(code: string, status: number, message?: string, details?: unknown) {
    super(message ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export class ValidationError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, 400, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, 404, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code = "unauthorized", message = "No autorizado") {
    super(code, 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(code = "forbidden", message = "Acceso denegado") {
    super(code, 403, message);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, 409, message, details);
  }
}
