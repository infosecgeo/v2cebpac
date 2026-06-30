# Cebu Pacific Backend

Node.js backend server for license management, authentication, and transaction processing.

## Features

- License-based authentication
- JWT session management
- Credit system
- Telegram bot integration
- Admin dashboard
- Real-time WebSocket updates
- JSON-based database
- Automatic backups

## Requirements

- Node.js >= 18.0.0
- npm >= 9.0.0

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## Configuration

Edit `.env` file with your settings:

- `JWT_SECRET`: Generate a secure random string (256-bit hex)
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `ADMIN_USERNAME` & `ADMIN_PASSWORD`: Admin credentials
- Other settings as needed

## Running

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## API Endpoints

### Client API (`/api`)
- `POST /api/auth/license` - Authenticate with license key
- `GET /api/auth/validate` - Validate session token
- `POST /api/auth/logout` - Logout
- `GET /api/config/runtime` - Get runtime configuration
- `GET /api/credits/balance` - Get credit balance
- `POST /api/credits/check` - Check if has credits
- `POST /api/credits/topup/request` - Request top-up
- `POST /api/transactions/start` - Start transaction
- `POST /api/transactions/complete` - Complete transaction

### Admin API (`/api/admin`)
- `POST /api/admin/login` - Admin login
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/licenses` - List licenses
- `POST /api/admin/licenses/generate` - Generate licenses
- `PATCH /api/admin/licenses/:id` - Update license
- `POST /api/admin/config/update` - Update runtime config
- `GET /api/admin/transactions` - View transactions

## Admin Dashboard

Access the admin dashboard at: `http://localhost:3000/admin`

Default credentials (change these!):
- Username: `admin`
- Password: `admin123`

## Database

JSON-based database stored in `storage/db/`:
- `users.json` - Admin users
- `licenses.json` - License keys
- `credits.json` - Credit history
- `transactions.json` - Transaction logs
- `sessions.json` - Active sessions
- `config.json` - Runtime configuration
- `telegram.json` - Telegram bot data
- `proxies.json` - Proxy pool

Backups are automatically created in `storage/backups/`

## Logs

Logs are stored in `logs/`:
- `app.log` - Combined logs
- `error.log` - Error logs only

## Security

- All passwords hashed with bcrypt
- JWT tokens with expiration
- Rate limiting on all endpoints
- CORS configured
- Helmet security headers
- Input validation with Joi
- HTTPS support

## Development

```bash
# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Production Deployment

See `docs/DEPLOYMENT.md` for detailed deployment instructions.

## License

ISC
