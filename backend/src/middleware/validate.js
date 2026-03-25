const { validationResult } = require('express-validator');

/**
 * Runs a list of express-validator chains and returns 400 with all errors
 * if any fail. Pass as middleware before the route handler.
 *
 * Usage:
 *   router.post('/login', validate(validators.login), loginHandler);
 */
const validate = (validations) => async (req, res, next) => {
  await Promise.all(validations.map((v) => v.run(req)));
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(({ path, msg }) => ({ field: path, message: msg })),
    });
  }
  next();
};

module.exports = validate;
