export function authenticateUser(request, auth) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  return auth.authenticate(token);
}

export function requireAuth(auth) {
  return (request) => {
    const user = authenticateUser(request, auth);
    if (!user) {
      return { error: "Необхідна авторизація", status: 401 };
    }
    request.user = user;
    return null;
  };
}

export function requireAdmin(auth) {
  return (request) => {
    const user = authenticateUser(request, auth);
    if (!user) {
      return { error: "Необхідна авторизація", status: 401 };
    }
    if (user.role !== "admin") {
      return {
        error: "Доступ заборонено. Потрібні права адміністратора.",
        status: 403,
      };
    }
    request.user = user;
    return null;
  };
}
