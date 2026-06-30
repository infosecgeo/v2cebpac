# Storage Layer Documentation

## Overview

The storage layer provides a robust, thread-safe JSON-based database system for the Cebu Pacific backend. It implements atomic writes, automatic backups, data validation, and concurrent access handling.

## Architecture

### Core Components

#### DatabaseManager
- Thread-safe JSON file operations
- Atomic writes using temp files
- Configurable validation
- Lock-based concurrency control

#### AsyncLock
- Provides mutual exclusion for async operations
- Prevents race conditions
- Queue-based wait mechanism

#### BackupService
- Automatic periodic backups
- Configurable backup rotation
- Manual backup creation
- Restore functionality

#### DatabaseInitializer
- Initializes all database files
- Creates default data
- Integrity checking
- Reset functionality

## Storage Services

### ConfigService
Manages runtime configuration with caching.

**Methods:**
- `get(useCache)` - Get current configuration
- `update(updates, updatedBy)` - Update configuration
- `reset(updatedBy)` - Reset to defaults
- `getSection(section)` - Get specific section
- `updateSection(section, updates, updatedBy)` - Update section
- `invalidateCache()` - Clear cache

**Data Structure:**
```json
{
  "version": 1,
  "updatedAt": "ISO8601",
  "updatedBy": "username",
  "runtime": { ... },
  "proxy": { ... },
  "processing": { ... },
  "modes": { ... },
  "payment": { ... }
}
```

### LicenseService
Manages license keys and credits.

**Methods:**
- `create(licenseData)` - Create new license
- `getByKey(key)` - Get license by key
- `getById(id)` - Get license by ID
- `update(id, updates)` - Update license
- `delete(id)` - Delete license
- `list(filters)` - List licenses
- `search(query)` - Search licenses
- `updateCredits(id, amount)` - Update credits
- `linkTelegram(id, telegramId, username)` - Link Telegram account

**Data Structure:**
```json
{
  "id": "uuid",
  "key": "XXXX-XXXX-XXXX-XXXX",
  "status": "active|suspended|expired|revoked",
  "userId": "string",
  "expiresAt": "ISO8601",
  "createdAt": "ISO8601",
  "lastUsedAt": "ISO8601 | null",
  "credits": 100,
  "maxConcurrentSessions": 1,
  "telegramId": "",
  "telegramUsername": ""
}
```

### UserService
Manages admin users with password hashing.

**Methods:**
- `create(userData)` - Create user
- `getById(id)` - Get user by ID
- `getByUsername(username)` - Get user by username
- `update(id, updates)` - Update user
- `delete(id)` - Delete user
- `list()` - List all users
- `authenticate(username, password)` - Authenticate user
- `updateLastLogin(id)` - Update last login timestamp

**Data Structure:**
```json
{
  "id": "uuid",
  "username": "admin",
  "passwordHash": "bcrypt-hash",
  "role": "admin|superadmin",
  "email": "",
  "createdAt": "ISO8601",
  "lastLoginAt": "ISO8601 | null",
  "isActive": true
}
```

### SessionService
Manages active user sessions.

**Methods:**
- `create(sessionData)` - Create session
- `getById(id)` - Get session by ID
- `getByToken(token)` - Get session by token
- `delete(id)` - Delete session
- `list(filters)` - List sessions
- `cleanup()` - Remove expired sessions
- `updateActivity(id)` - Update last activity

**Data Structure:**
```json
{
  "id": "uuid",
  "licenseId": "uuid",
  "token": "jwt-token",
  "status": "active|expired|terminated",
  "ipAddress": "1.2.3.4",
  "userAgent": "...",
  "createdAt": "ISO8601",
  "expiresAt": "ISO8601",
  "lastActivityAt": "ISO8601"
}
```

### TransactionService
Logs all payment transactions.

**Methods:**
- `create(transactionData)` - Create transaction
- `getById(id)` - Get transaction by ID
- `list(filters)` - List transactions
- `getByLicense(licenseId, limit)` - Get license transactions
- `getStats(licenseId)` - Get transaction statistics

**Data Structure:**
```json
{
  "id": "uuid",
  "licenseId": "uuid",
  "type": "success|failed|pending",
  "cardNumber": "****1234",
  "amount": 100.00,
  "message": "Transaction successful",
  "metadata": {},
  "createdAt": "ISO8601"
}
```

### CreditService
Tracks credit history and operations.

**Methods:**
- `create(creditData)` - Create credit entry
- `getById(id)` - Get credit entry by ID
- `list(filters)` - List credit history
- `getByLicense(licenseId, limit)` - Get license credit history
- `getBalance(licenseId)` - Get current balance

**Data Structure:**
```json
{
  "id": "uuid",
  "licenseId": "uuid",
  "operation": "deduct|topup|refund|adjustment",
  "amount": 10,
  "balanceBefore": 100,
  "balanceAfter": 90,
  "reason": "Transaction used 1 credit",
  "performedBy": "system",
  "createdAt": "ISO8601"
}
```

### TelegramService
Manages Telegram bot integration.

**Methods:**
- `getBotConfig()` - Get bot configuration
- `updateBotConfig(config)` - Update bot config
- `createLinkingRequest(licenseKey, telegramId, username)` - Create link request
- `getLinkingRequest(requestId)` - Get link request
- `approveLinkingRequest(requestId)` - Approve link request
- `getLinkedAccountByLicense(licenseKey)` - Get linked account
- `getLinkedAccountByTelegram(telegramId)` - Get linked account
- `unlinkAccount(licenseKey)` - Unlink account
- `cleanupExpiredRequests()` - Remove expired requests
- `listLinkedAccounts()` - List all linked accounts
- `listPendingRequests()` - List pending requests

### ProxyService
Manages proxy pool and rotation.

**Methods:**
- `add(proxyUrl, metadata)` - Add proxy
- `getById(id)` - Get proxy by ID
- `getNext(strategy)` - Get next proxy (rotation)
- `recordUsage(id, success, responseTime)` - Record usage
- `updateStatus(id, isActive)` - Update status
- `delete(id)` - Delete proxy
- `list(filters)` - List proxies
- `getStats()` - Get proxy statistics
- `resetStats(id)` - Reset statistics

**Data Structure:**
```json
{
  "id": "uuid",
  "url": "******host:port",
  "protocol": "http|https|socks4|socks5",
  "host": "proxy.example.com",
  "port": 8080,
  "username": "",
  "password": "",
  "country": "PH",
  "region": "Manila",
  "isActive": true,
  "lastUsed": "ISO8601 | null",
  "usageCount": 0,
  "successCount": 0,
  "failureCount": 0,
  "avgResponseTime": null,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

## Usage Examples

### Basic Usage

```javascript
const {
  ConfigService,
  LicenseService,
  UserService,
  SessionService,
  BackupService,
  DatabaseInitializer,
} = require('./storage');

// Get configuration
const config = await ConfigService.get();

// Create a license
const license = await LicenseService.create({
  userId: 'user123',
  credits: 100,
  expiresAt: new Date('2025-12-31').toISOString(),
});

// Authenticate user
const user = await UserService.authenticate('admin', 'password');

// Create session
const session = await SessionService.create({
  licenseId: license.id,
  ipAddress: '1.2.3.4',
  userAgent: 'Mozilla/5.0...',
});
```

### Backup Management

```javascript
// Start automatic backups
const backupService = new BackupService({
  interval: 3600000, // 1 hour
  maxBackups: 24,
});
backupService.start();

// Create manual backup
const backupPath = await backupService.createBackup();

// List backups
const backups = await backupService.listBackups();

// Restore from backup
await backupService.restore(backups[0].name);
```

### Database Initialization

```javascript
const initializer = new DatabaseInitializer();

// Initialize all databases
const results = await initializer.initializeAll();

// Check integrity
const integrity = await initializer.checkIntegrity();

// Reset all (with backup)
await initializer.resetAll(true);
```

## Best Practices

1. **Always use services as singletons** - They're exported as instances
2. **Handle errors properly** - All operations can throw errors
3. **Use transactions for multi-step operations** - Use `update()` method
4. **Validate data before passing** - Services have built-in validation
5. **Clean up sessions periodically** - Call `SessionService.cleanup()`
6. **Monitor backup service** - Ensure backups are running
7. **Check database integrity** - Use `DatabaseInitializer.checkIntegrity()`

## Security Considerations

- Passwords are hashed with bcrypt (cost factor 12)
- Card numbers are automatically masked (only last 4 digits stored)
- Session tokens should be JWT tokens
- File permissions should restrict access to database files
- Backups should be stored securely

## Performance Tips

- ConfigService uses caching (1-minute TTL)
- Use filters when listing to reduce data transfer
- Cleanup expired sessions regularly
- Rotate old backups to save disk space
- Use appropriate limits when listing

## Troubleshooting

### Database file corruption
```javascript
const initializer = new DatabaseInitializer();
const integrity = await initializer.checkIntegrity();
// Restore from backup if invalid
```

### Lock timeout
- Increase timeout in DatabaseManager options
- Check for deadlocks in code
- Ensure locks are properly released

### Backup failures
- Check disk space
- Verify backup directory permissions
- Review backup service logs

## File Structure

```
storage/
├── BackupService.js          # Automatic backup service
├── DatabaseInitializer.js    # Database initialization
├── DatabaseManager.js        # Core database manager
├── index.js                  # Export all services
├── db/                       # Database files
│   ├── config.json
│   ├── licenses.json
│   ├── users.json
│   ├── sessions.json
│   ├── transactions.json
│   ├── credits.json
│   ├── telegram.json
│   └── proxies.json
├── backups/                  # Backup directory
└── services/                 # Service modules
    ├── ConfigService.js
    ├── LicenseService.js
    ├── UserService.js
    ├── SessionService.js
    ├── TransactionService.js
    ├── CreditService.js
    ├── TelegramService.js
    └── ProxyService.js
```

## Dependencies

- `joi` - Data validation
- `uuid` - UUID generation
- `bcryptjs` - Password hashing

## Testing

Unit tests should cover:
- Concurrent access scenarios
- Atomic write operations
- Data validation
- Backup and restore
- Error handling
- Service methods

## Migration

When adding new database fields:
1. Update Joi schema
2. Provide default values
3. Test with existing data
4. Document changes
5. Create migration if needed

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Verify database integrity
3. Review backup status
4. Check service documentation
