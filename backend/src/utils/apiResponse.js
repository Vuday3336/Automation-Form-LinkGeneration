// Every API response has the same shape so the frontend can handle them uniformly:
//   success: { success: true,  message, data }
//   failure: { success: false, message, errors? }

export function sendSuccess(res, { status = 200, message = 'OK', data = null } = {}) {
  return res.status(status).json({ success: true, message, data });
}

// Throw this from anywhere (controller, service, middleware) to send a clean error response.
// The error middleware turns it into JSON with the right HTTP status code.
export class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }

  static badRequest(message = 'Bad request', errors) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have permission to do this') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Resource already exists') {
    return new ApiError(409, message);
  }

  // 410 Gone: the thing existed but is no longer available (expired or revoked link).
  static gone(message = 'This resource is no longer available') {
    return new ApiError(410, message);
  }
}
