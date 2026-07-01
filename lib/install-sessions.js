const { randomUUID } = require("crypto");

const DEFAULT_TTL_MS = 30 * 60 * 1000;

class InstallSessionStore {
  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
    this.sessions = new Map();
  }

  create(session) {
    const id = randomUUID();
    const expiresAt = Date.now() + this.ttlMs;

    this.sessions.set(id, {
      ...session,
      id,
      expiresAt,
      createdAt: Date.now(),
    });

    return this.sessions.get(id);
  }

  get(id) {
    const session = this.sessions.get(id);
    if (!session) {
      return null;
    }

    if (Date.now() > session.expiresAt) {
      this.delete(id);
      return null;
    }

    return session;
  }

  delete(id) {
    this.sessions.delete(id);
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(id);
      }
    }
  }
}

module.exports = {
  InstallSessionStore,
};
