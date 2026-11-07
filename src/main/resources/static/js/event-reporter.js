const DEFAULTS = {
  baseUrl: "/api/v1",
  batchSize: 20,
  flushIntervalMs: 5000,
  maxRetries: 4
};

export class EventReporter {
  constructor(options = {}) {
    this.opts = { ...DEFAULTS, ...options };
    this.sessionId = null;
    this.offline = false;
    this.queue = [];
    this.localEvents = [];
    this.flushing = false;
    this.retryTimer = 0;
    this.periodicTimer = 0;
    this.retryCount = 0;
  }

  async openSession() {
    try {
      const response = await fetch(this.opts.baseUrl + "/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      this.sessionId = data.sessionId;
      this.offline = false;
      this.startPeriodicFlush();
      return data;
    } catch (error) {
      this.offline = true;
      this.sessionId = null;
      return { sessionId: null, offline: true, error };
    }
  }

  async postBaseline(yaw, pitch, roll) {
    if (this.offline || !this.sessionId) return false;
    try {
      const response = await fetch(this.opts.baseUrl + "/sessions/" + this.sessionId + "/baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yaw, pitch, roll })
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  enqueue(event) {
    this.localEvents.push(event);
    if (this.localEvents.length > 500) this.localEvents.shift();
    if (this.offline || !this.sessionId) return;
    this.queue.push(event);
    if (this.queue.length >= this.opts.batchSize) this.flush();
  }

  startPeriodicFlush() {
    if (this.periodicTimer) return;
    this.periodicTimer = window.setInterval(() => this.flush(), this.opts.flushIntervalMs);
  }

  async flush() {
    if (this.flushing || this.queue.length === 0 || this.offline || !this.sessionId) return;
    this.flushing = true;
    const batch = this.queue.slice(0, this.opts.batchSize);

    try {
      const response = await fetch(this.opts.baseUrl + "/sessions/" + this.sessionId + "/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch)
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      this.queue.splice(0, batch.length);
      this.retryCount = 0;
    } catch (error) {
      this.retryCount += 1;
      if (this.retryCount > this.opts.maxRetries) {
        this.offline = true;
      } else {
        window.clearTimeout(this.retryTimer);
        this.retryTimer = window.setTimeout(() => this.flush(), 1500 * this.retryCount);
      }
    } finally {
      this.flushing = false;
    }
  }

  async summary() {
    if (this.offline || !this.sessionId) return null;
    try {
      const response = await fetch(this.opts.baseUrl + "/sessions/" + this.sessionId + "/summary");
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  async close() {
    await this.flush();
    window.clearInterval(this.periodicTimer);
    this.periodicTimer = 0;
    if (this.offline || !this.sessionId) return;
    try {
      await fetch(this.opts.baseUrl + "/sessions/" + this.sessionId + "/close", { method: "POST" });
    } catch (error) {
      // 关闭会话失败不影响前端展示
    }
  }
}