const ROLE_NAMES = Object.freeze(['user', 'reviewer', 'admin']);
const ROLE_LEVEL = Object.freeze({ user: 0, reviewer: 1, admin: 2 });

function isRole(role) {
  return Object.hasOwn(ROLE_LEVEL, role);
}

function hasMinimumRole(role, minimumRole) {
  return isRole(role)
    && isRole(minimumRole)
    && ROLE_LEVEL[role] >= ROLE_LEVEL[minimumRole];
}

function requireMinimumRole(role, minimumRole) {
  if (!hasMinimumRole(role, minimumRole)) {
    const error = new Error('You do not have permission to perform this action.');
    error.statusCode = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }
}

module.exports = { ROLE_NAMES, isRole, hasMinimumRole, requireMinimumRole };
