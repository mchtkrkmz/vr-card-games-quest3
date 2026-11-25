// Hybrid Server-Backed & Offline IndexedDB User Database Engine for VR Kıraathane
// Strictly enforces: only ADMIN_EMAIL (mchtkrkmz@gmail.com) has built-in AI & Admin delegation powers.

export const ADMIN_EMAIL = 'mchtkrkmz@gmail.com';

export class UserDatabaseEngine {
  constructor() {
    this.dbName = 'VR_KIRAATHANE_DB';
    this.dbVersion = 1;
    this.db = null;
    this.isReady = false;
    this.initPromise = this.init();
  }

  async init() {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        this.isReady = true;
        resolve(null);
        return;
      }

      try {
        const request = window.indexedDB.open(this.dbName, this.dbVersion);

        request.onerror = () => {
          this.isReady = true;
          resolve(null);
        };

        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('users')) {
            const userStore = db.createObjectStore('users', { keyPath: 'email' });
            userStore.createIndex('name', 'name', { unique: false });
            userStore.createIndex('role', 'role', { unique: false });
            userStore.createIndex('createdAt', 'createdAt', { unique: false });
          }

          if (!db.objectStoreNames.contains('match_history')) {
            const historyStore = db.createObjectStore('match_history', { keyPath: 'id', autoIncrement: true });
            historyStore.createIndex('userEmail', 'userEmail', { unique: false });
            historyStore.createIndex('gameType', 'gameType', { unique: false });
            historyStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };

        request.onsuccess = (e) => {
          this.db = e.target.result;
          this.isReady = true;
          resolve(this.db);
        };
      } catch {
        this.isReady = true;
        resolve(null);
      }
    });
  }

  async hashPassword(password, salt = 'vr_kiraathane_salt_2026') {
    try {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        const enc = new TextEncoder();
        const keyData = enc.encode(password + salt);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', keyData);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch {
      // Fallback
    }
    let hash = 0;
    const str = password + salt;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  async _apiRequest(pathUrl, options = {}) {
    if (typeof fetch === 'undefined') {
      const err = new Error('NO_FETCH');
      err.isNetwork = true;
      throw err;
    }
    try {
      const headers = { ...(options.headers || {}) };
      if (options.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
      const resp = await fetch(pathUrl, { ...options, headers });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const err = new Error(data.error || `HTTP ${resp.status}`);
        err.status = resp.status;
        throw err;
      }
      return data;
    } catch (err) {
      if (typeof err.status === 'number') throw err;
      err.isNetwork = true;
      throw err;
    }
  }

  // Register a new member (requires explicit signup even for ADMIN_EMAIL)
  async registerUser(name, email, password, avatarId = 'dayi') {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    try {
      const res = await this._apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), email: normalizedEmail, password, avatarId }),
      });
      if (res?.user) {
        const userWithToken = { ...res.user, token: res.token || null };
        await this.saveUserDirect(userWithToken);
        this.saveSession(userWithToken);
        return userWithToken;
      }
    } catch (err) {
      if (!err.isNetwork) throw err;
    }

    // Offline fallback ONLY when backend is unreachable
    const existing = await this.getUser(normalizedEmail);
    if (existing) {
      throw new Error('Bu e-posta adresiyle kayıtlı bir üyelik zaten mevcut!');
    }

    const passwordHash = await this.hashPassword(password);
    const isAdmin = normalizedEmail === ADMIN_EMAIL;

    const newUser = {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      avatarId,
      role: isAdmin ? 'ADMIN' : 'PLAYER',
      isAdmin,
      aiAccess: isAdmin,
      createdAt: new Date().toISOString(),
      stats: { gamesPlayed: 0, wins: 0, okeyWins: 0, batakWins: 0, pistiWins: 0 },
    };

    await this.saveUserDirect(newUser);
    this.saveSession(newUser);
    return newUser;
  }

  // Login member (strict password verification — zero hardcoded backdoor)
  async loginUser(email, password) {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    try {
      const res = await this._apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      if (res?.user) {
        const userWithToken = { ...res.user, token: res.token || null };
        await this.saveUserDirect(userWithToken);
        this.saveSession(userWithToken);
        return userWithToken;
      }
    } catch (err) {
      if (!err.isNetwork) throw err;
    }

    // Offline fallback ONLY when backend is unreachable
    const user = await this.getUser(normalizedEmail);
    if (!user) {
      throw new Error('Bu e-posta adresi ile kayıtlı üye bulunamadı. Lütfen "Üye Ol" sekmesinden kayıt olun.');
    }

    const inputHash = await this.hashPassword(password);
    const isMatch = user.passwordHash === inputHash || (user.password && user.password === password);
    if (!isMatch) {
      throw new Error('Hatalı şifre girdiniz! Lütfen tekrar deneyin.');
    }

    const sanitized = {
      ...user,
      isAdmin: normalizedEmail === ADMIN_EMAIL,
      aiAccess: normalizedEmail === ADMIN_EMAIL ? true : Boolean(user.aiAccess),
    };
    this.saveSession(sanitized);
    return sanitized;
  }

  // Validate active session against server and sync latest aiAccess
  async refreshSession() {
    const cached = this.getActiveSession();
    if (!cached || !cached.email) return null;

    if (cached.token) {
      try {
        const res = await this._apiRequest('/api/auth/me', {
          method: 'GET',
          headers: { Authorization: `Bearer ${cached.token}` },
        });
        if (res?.user) {
          const updated = { ...res.user, token: cached.token };
          await this.saveUserDirect(updated);
          this.saveSession(updated);
          return updated;
        }
      } catch (err) {
        if (err.status === 401) {
          this.clearSession();
          return null;
        }
      }
    }

    // Offline refresh from local store
    const localUser = await this.getUser(cached.email);
    if (localUser) {
      const merged = {
        ...cached,
        name: localUser.name || cached.name,
        isAdmin: cached.email.toLowerCase() === ADMIN_EMAIL,
        aiAccess: cached.email.toLowerCase() === ADMIN_EMAIL ? true : Boolean(localUser.aiAccess),
      };
      this.saveSession(merged);
      return merged;
    }
    return cached;
  }

  // Admin Only: list all registered members
  async listAllUsersForAdmin() {
    const session = this.getActiveSession();
    if (!session || session.email?.toLowerCase() !== ADMIN_EMAIL) {
      throw new Error('Bu işlem için yalnızca yönetici yetkilidir.');
    }

    if (session.token) {
      try {
        const res = await this._apiRequest('/api/admin/users', {
          method: 'GET',
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (Array.isArray(res?.users)) {
          return res.users;
        }
      } catch (err) {
        if (!err.isNetwork) throw err;
      }
    }

    return this.getAllUsersFromLocalStorage().map((u) => ({
      name: u.name,
      email: u.email,
      role: u.email?.toLowerCase() === ADMIN_EMAIL ? 'ADMIN' : 'PLAYER',
      isAdmin: u.email?.toLowerCase() === ADMIN_EMAIL,
      aiAccess: u.email?.toLowerCase() === ADMIN_EMAIL ? true : Boolean(u.aiAccess),
    }));
  }

  // Admin Only: grant or revoke AI access for a member
  async setUserAiAccess(targetEmail, enabled) {
    const session = this.getActiveSession();
    if (!session || session.email?.toLowerCase() !== ADMIN_EMAIL) {
      throw new Error('Bu işlem için yalnızca yönetici yetkilidir.');
    }
    const normTarget = String(targetEmail || '').trim().toLowerCase();

    if (session.token) {
      try {
        const res = await this._apiRequest('/api/admin/set-ai-access', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.token}` },
          body: JSON.stringify({ email: normTarget, aiAccess: Boolean(enabled) }),
        });
        if (res?.user) {
          await this.saveUserDirect(res.user);
          return res.user;
        }
      } catch (err) {
        if (!err.isNetwork) throw err;
      }
    }

    const user = await this.getUser(normTarget);
    if (!user) throw new Error('Üye bulunamadı.');
    user.aiAccess = Boolean(enabled);
    await this.saveUserDirect(user);
    return user;
  }

  async getUser(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return null;

    const localUser = this.getUserFromLocalStorage(normalizedEmail);
    if (localUser) return localUser;

    if (this.db) {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(this.getUserFromLocalStorage(normalizedEmail));
        }, 800);

        try {
          const transaction = this.db.transaction(['users'], 'readonly');
          const store = transaction.objectStore('users');
          const request = store.get(normalizedEmail);
          request.onsuccess = () => {
            clearTimeout(timeout);
            resolve(request.result || this.getUserFromLocalStorage(normalizedEmail));
          };
          request.onerror = () => {
            clearTimeout(timeout);
            resolve(this.getUserFromLocalStorage(normalizedEmail));
          };
        } catch {
          clearTimeout(timeout);
          resolve(this.getUserFromLocalStorage(normalizedEmail));
        }
      });
    }

    return null;
  }

  async saveUserDirect(user) {
    if (!user || !user.email) return;
    if (typeof localStorage !== 'undefined') {
      try {
        const list = this.getAllUsersFromLocalStorage();
        const idx = list.findIndex((u) => u.email.toLowerCase() === user.email.toLowerCase());
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...user };
        } else {
          list.push(user);
        }
        localStorage.setItem('vr_registered_users', JSON.stringify(list));
      } catch {
        // ignore
      }
    }

    if (this.db) {
      try {
        const transaction = this.db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        store.put(user);
      } catch {
        // ignore
      }
    }
  }

  getUserFromLocalStorage(email) {
    const list = this.getAllUsersFromLocalStorage();
    return list.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  getAllUsersFromLocalStorage() {
    if (typeof localStorage === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('vr_registered_users') || '[]');
    } catch {
      return [];
    }
  }

  saveSession(user) {
    if (typeof localStorage === 'undefined' || !user?.email) return;
    const email = String(user.email).trim().toLowerCase();
    const isAdmin = email === ADMIN_EMAIL;
    const safeSession = {
      name: user.name,
      email,
      avatarId: user.avatarId || 'dayi',
      role: isAdmin ? 'ADMIN' : 'PLAYER',
      isAdmin,
      aiAccess: isAdmin ? true : Boolean(user.aiAccess),
      token: user.token || null,
      stats: user.stats || {},
    };
    localStorage.setItem('vr_kiraathane_active_user', JSON.stringify(safeSession));
  }

  getActiveSession() {
    if (typeof localStorage === 'undefined') return null;
    try {
      return JSON.parse(localStorage.getItem('vr_kiraathane_active_user') || 'null');
    } catch {
      return null;
    }
  }

  clearSession() {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem('vr_kiraathane_active_user');
  }

  async recordGameResult(userEmail, gameType, won = false) {
    if (!userEmail) return;
    const user = await this.getUser(userEmail);
    if (!user) return;

    if (!user.stats) {
      user.stats = { gamesPlayed: 0, wins: 0, okeyWins: 0, batakWins: 0, pistiWins: 0 };
    }

    user.stats.gamesPlayed = (user.stats.gamesPlayed || 0) + 1;
    if (won) {
      user.stats.wins = (user.stats.wins || 0) + 1;
      if (gameType === 'OKEY' || gameType === 'OKEY101') user.stats.okeyWins = (user.stats.okeyWins || 0) + 1;
      if (gameType === 'BATAK') user.stats.batakWins = (user.stats.batakWins || 0) + 1;
      if (gameType === 'PISTI') user.stats.pistiWins = (user.stats.pistiWins || 0) + 1;
    }

    await this.saveUserDirect(user);
    this.saveSession(user);
  }
}

export const userDb = new UserDatabaseEngine();
