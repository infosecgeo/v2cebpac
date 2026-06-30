const path = require('path');
const Joi = require('joi');
const DatabaseManager = require('../DatabaseManager');
const logger = require('../../utils/logger');

// Validation schema for proxy data
const proxySchema = Joi.object({
  proxies: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      url: Joi.string().required(),
      protocol: Joi.string().valid('http', 'https', 'socks4', 'socks5').required(),
      host: Joi.string().required(),
      port: Joi.number().integer().min(1).max(65535).required(),
      username: Joi.string().allow(''),
      password: Joi.string().allow(''),
      country: Joi.string().allow(''),
      region: Joi.string().allow(''),
      isActive: Joi.boolean().required(),
      lastUsed: Joi.string().isoDate().allow(null),
      usageCount: Joi.number().integer().min(0).required(),
      successCount: Joi.number().integer().min(0).required(),
      failureCount: Joi.number().integer().min(0).required(),
      avgResponseTime: Joi.number().min(0).allow(null),
      createdAt: Joi.string().isoDate().required(),
      updatedAt: Joi.string().isoDate().required(),
    })
  ).required(),
  rotationIndex: Joi.number().integer().min(0).required(),
});

/**
 * Proxy Service
 * Manages proxy pool and rotation
 */
class ProxyService {
  constructor() {
    const dbPath = path.join(__dirname, '..', 'db', 'proxies.json');
    this.db = new DatabaseManager(dbPath, {
      pretty: true,
      validator: (data) => {
        const { error } = proxySchema.validate(data);
        if (error) {
          throw new Error(`Proxy data validation failed: ${error.message}`);
        }
      },
    });
  }

  /**
   * Initialize proxy data structure
   * @private
   */
  async _initialize() {
    const data = await this.db.read();
    if (!data || Object.keys(data).length === 0) {
      const initial = {
        proxies: [],
        rotationIndex: 0,
      };
      await this.db.write(initial);
      return initial;
    }
    return data;
  }

  /**
   * Parse proxy URL into components
   * @private
   */
  _parseProxyUrl(proxyUrl) {
    try {
      const url = new URL(proxyUrl);
      return {
        protocol: url.protocol.replace(':', ''),
        host: url.hostname,
        port: parseInt(url.port) || 8080,
        username: url.username || '',
        password: url.password || '',
      };
    } catch (error) {
      throw new Error(`Invalid proxy URL: ${error.message}`);
    }
  }

  /**
   * Add a proxy to the pool
   * @param {string} proxyUrl - Proxy URL
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Created proxy
   */
  async add(proxyUrl, metadata = {}) {
    const { v4: uuidv4 } = require('uuid');
    const parsed = this._parseProxyUrl(proxyUrl);

    const proxy = {
      id: uuidv4(),
      url: proxyUrl,
      ...parsed,
      country: metadata.country || '',
      region: metadata.region || '',
      isActive: true,
      lastUsed: null,
      usageCount: 0,
      successCount: 0,
      failureCount: 0,
      avgResponseTime: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.db.update((data) => {
      // Check for duplicates
      const existing = data.proxies.find(p => p.url === proxyUrl);
      if (existing) {
        throw new Error('Proxy already exists');
      }

      data.proxies.push(proxy);
      return data;
    });

    logger.info(`Added proxy: ${proxy.id} (${proxy.host}:${proxy.port})`);
    return proxy;
  }

  /**
   * Get proxy by ID
   * @param {string} id - Proxy ID
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    const data = await this._initialize();
    return data.proxies.find(p => p.id === id) || null;
  }

  /**
   * Get next proxy (rotation)
   * @param {string} strategy - Rotation strategy ('random', 'round-robin', 'least-used')
   * @returns {Promise<Object|null>}
   */
  async getNext(strategy = 'round-robin') {
    const data = await this._initialize();
    const activeProxies = data.proxies.filter(p => p.isActive);

    if (activeProxies.length === 0) {
      return null;
    }

    let proxy;

    switch (strategy) {
      case 'random':
        proxy = activeProxies[Math.floor(Math.random() * activeProxies.length)];
        break;

      case 'least-used':
        proxy = activeProxies.reduce((least, current) =>
          current.usageCount < least.usageCount ? current : least
        );
        break;

      case 'round-robin':
      default:
        proxy = activeProxies[data.rotationIndex % activeProxies.length];
        await this.db.update((d) => {
          d.rotationIndex = (d.rotationIndex + 1) % activeProxies.length;
          return d;
        });
        break;
    }

    return proxy;
  }

  /**
   * Record proxy usage
   * @param {string} id - Proxy ID
   * @param {boolean} success - Whether request was successful
   * @param {number} responseTime - Response time in milliseconds
   * @returns {Promise<void>}
   */
  async recordUsage(id, success, responseTime = null) {
    await this.db.update((data) => {
      const proxy = data.proxies.find(p => p.id === id);
      if (!proxy) {
        throw new Error('Proxy not found');
      }

      proxy.usageCount++;
      if (success) {
        proxy.successCount++;
      } else {
        proxy.failureCount++;
      }

      if (responseTime !== null) {
        if (proxy.avgResponseTime === null) {
          proxy.avgResponseTime = responseTime;
        } else {
          // Calculate rolling average
          proxy.avgResponseTime = (proxy.avgResponseTime * (proxy.usageCount - 1) + responseTime) / proxy.usageCount;
        }
      }

      proxy.lastUsed = new Date().toISOString();
      proxy.updatedAt = new Date().toISOString();

      return data;
    });
  }

  /**
   * Update proxy status
   * @param {string} id - Proxy ID
   * @param {boolean} isActive - Active status
   * @returns {Promise<Object>}
   */
  async updateStatus(id, isActive) {
    const updated = await this.db.update((data) => {
      const proxy = data.proxies.find(p => p.id === id);
      if (!proxy) {
        throw new Error('Proxy not found');
      }

      proxy.isActive = isActive;
      proxy.updatedAt = new Date().toISOString();

      return data;
    });

    const proxy = updated.proxies.find(p => p.id === id);
    logger.info(`Updated proxy status: ${id} -> ${isActive ? 'active' : 'inactive'}`);
    return proxy;
  }

  /**
   * Delete a proxy
   * @param {string} id - Proxy ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    await this.db.update((data) => {
      const index = data.proxies.findIndex(p => p.id === id);
      if (index === -1) {
        throw new Error('Proxy not found');
      }

      data.proxies.splice(index, 1);
      return data;
    });

    logger.info(`Deleted proxy: ${id}`);
  }

  /**
   * List all proxies
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async list(filters = {}) {
    const data = await this._initialize();
    let proxies = data.proxies;

    if (filters.isActive !== undefined) {
      proxies = proxies.filter(p => p.isActive === filters.isActive);
    }

    if (filters.country) {
      proxies = proxies.filter(p => p.country === filters.country);
    }

    return proxies;
  }

  /**
   * Get proxy statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    const data = await this._initialize();

    const stats = {
      total: data.proxies.length,
      active: data.proxies.filter(p => p.isActive).length,
      inactive: data.proxies.filter(p => !p.isActive).length,
      totalUsage: data.proxies.reduce((sum, p) => sum + p.usageCount, 0),
      totalSuccess: data.proxies.reduce((sum, p) => sum + p.successCount, 0),
      totalFailure: data.proxies.reduce((sum, p) => sum + p.failureCount, 0),
      avgResponseTime: 0,
    };

    // Calculate average response time across all proxies
    const proxiesWithResponseTime = data.proxies.filter(p => p.avgResponseTime !== null);
    if (proxiesWithResponseTime.length > 0) {
      stats.avgResponseTime = proxiesWithResponseTime.reduce((sum, p) => sum + p.avgResponseTime, 0) / proxiesWithResponseTime.length;
    }

    // Calculate success rate
    if (stats.totalUsage > 0) {
      stats.successRate = (stats.totalSuccess / stats.totalUsage) * 100;
    } else {
      stats.successRate = 0;
    }

    return stats;
  }

  /**
   * Reset proxy statistics
   * @param {string} id - Proxy ID (optional, resets all if not provided)
   * @returns {Promise<void>}
   */
  async resetStats(id = null) {
    await this.db.update((data) => {
      const proxies = id ? data.proxies.filter(p => p.id === id) : data.proxies;

      proxies.forEach(proxy => {
        proxy.usageCount = 0;
        proxy.successCount = 0;
        proxy.failureCount = 0;
        proxy.avgResponseTime = null;
        proxy.lastUsed = null;
        proxy.updatedAt = new Date().toISOString();
      });

      return data;
    });

    logger.info(`Reset proxy statistics${id ? `: ${id}` : ' (all proxies)'}`);
  }
}

// Export singleton instance
module.exports = new ProxyService();
