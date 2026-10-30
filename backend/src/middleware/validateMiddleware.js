import { ApiError } from '../utils/apiResponse.js';

// validate({ params, query, body }) checks each part of the request against a Zod schema.
// Valid, cleaned data is placed on req.validated.{params,query,body}; controllers read from
// there, never from the raw request. Invalid input stops here with a 400 and field messages.
export const validate = (schemas) => (req, res, next) => {
  req.validated ??= {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || part,
        message: issue.message,
      }));
      return next(ApiError.badRequest('Validation failed', errors));
    }
    req.validated[part] = result.data;
  }
  next();
};
