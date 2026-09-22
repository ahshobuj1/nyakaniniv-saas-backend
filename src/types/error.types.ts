export interface ValidationIssue {
  path: string;
  message: string;
  code?: string;
}

export interface ValidationDetails {
  issues: ValidationIssue[];
  invalidFields: number;
}

export interface ErrorResponseBody {
  message: string;
  code: string;
  statusCode: number;
  timestamp: string;
  requestId: string;
  details?: unknown;
  stack?: string;
}

export interface ErrorResponse {
  success: false;
  error: ErrorResponseBody;
}
