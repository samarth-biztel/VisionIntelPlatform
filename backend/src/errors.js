/**
 * Errors the API can map onto a meaningful HTTP status. Anything that is not
 * one of these is a genuine server fault and stays a 500.
 */
export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.status = 404;
    this.code = "not_found";
  }
}

export class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConflictError";
    this.status = 409;
    this.code = "conflict";
  }
}
