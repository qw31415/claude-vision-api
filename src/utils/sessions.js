export class SessionManager {
  constructor(kv) {
    this.kv = kv;
    this.defaultExpiration = 60 * 60 * 24; // 24 hours in seconds
  }

  async createSession(sessionId, initialData = {}) {
    const sessionData = {
      id: sessionId,
      messages: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
      ...initialData
    };

    await this.kv.put(`session:${sessionId}`, JSON.stringify(sessionData), {
      expirationTtl: this.defaultExpiration
    });

    return sessionData;
  }

  async getSession(sessionId) {
    if (!sessionId) return null;

    const data = await this.kv.get(`session:${sessionId}`);
    if (!data) return null;

    try {
      const sessionData = JSON.parse(data);
      // Update last activity
      sessionData.lastActivity = Date.now();
      await this.updateSession(sessionId, sessionData);
      return sessionData;
    } catch (error) {
      console.error('Failed to parse session data:', error);
      return null;
    }
  }

  async updateSession(sessionId, sessionData) {
    sessionData.lastActivity = Date.now();
    await this.kv.put(`session:${sessionId}`, JSON.stringify(sessionData), {
      expirationTtl: this.defaultExpiration
    });
  }

  async addMessage(sessionId, message) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.messages.push({
      ...message,
      timestamp: Date.now()
    });

    // Keep only last 50 messages to prevent sessions from growing too large
    if (session.messages.length > 50) {
      session.messages = session.messages.slice(-50);
    }

    await this.updateSession(sessionId, session);
    return session;
  }

  async clearSession(sessionId) {
    await this.kv.delete(`session:${sessionId}`);
  }

  async getSessionHistory(sessionId, limit = 10) {
    const session = await this.getSession(sessionId);
    if (!session) return [];

    return session.messages.slice(-limit);
  }

  // Clean up old sessions (called periodically)
  async cleanup() {
    // This would require listing all keys, which is expensive in KV
    // Better to rely on TTL expiration
    console.log('Session cleanup relies on KV TTL expiration');
  }
}