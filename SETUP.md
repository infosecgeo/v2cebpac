# Pusa Pacific - Integrated System Setup Guide

## Architecture Overview

This system integrates two servers:

1. **Node.js Backend (Port 3000)** - License management, authentication, admin dashboard
2. **Go Payment Processor (Port 5000)** - Actual payment processing with Akamai bypass

The Node.js server acts as the main entry point and proxies payment requests to the Go server.

## System Components

### Node.js Backend (`/backend`)
- **Purpose**: User authentication, license management, credit system, admin dashboard
- **Port**: 3000 (configurable via `PORT` environment variable)
- **Main Routes**:
  - `GET /` - Serves the main payment UI (index.html)
  - `POST /pay` - Proxies to Go server for payment processing
  - `GET /admin` - Admin dashboard
  - `/api/*` - REST API endpoints
  - `/api/admin/*` - Admin API endpoints

### Go Payment Processor (`/`)
- **Purpose**: Handles actual payment processing with Cebu Pacific
- **Port**: 5000 (hardcoded in server.go)
- **Routes**:
  - `POST /pay` - Process payment requests

## Installation & Setup

### Prerequisites
- Node.js >= 18.0.0
- Go >= 1.19
- npm >= 9.0.0

### Step 1: Setup Node.js Backend

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env and configure:
# - JWT_SECRET (generate a secure random string)
# - ADMIN_USERNAME and ADMIN_PASSWORD
# - PAYMENT_PROCESSOR_URL=http://localhost:5000
nano .env

# Start the backend
npm start
# OR for development with auto-reload:
npm run dev
```

### Step 2: Setup Go Payment Processor

```bash
# From repository root
# Install Go dependencies
go mod download

# Build the payment processor
go build -o payment-processor

# Run the payment processor
./payment-processor
# OR run directly:
go run .
```

The Go server will start on port 5000 and listen for payment requests.

### Step 3: Access the System

1. **Main Payment UI**: http://localhost:3000/
2. **Admin Dashboard**: http://localhost:3000/admin
3. **API Health Check**: http://localhost:3000/health

## How It Works

### User Flow

1. **Login**:
   - User clicks "Login" button on the main page
   - Enters username and license key
   - Backend validates credentials via `/api/auth/login`
   - Session token stored in localStorage

2. **Payment Processing**:
   - User fills in card details and HPP content
   - Submits form (requires login + credits)
   - Frontend sends request to `/pay` with auth token
   - Node.js backend:
     - Verifies user authentication
     - Checks credit balance
     - Proxies request to Go server (port 5000)
   - Go server processes payment with Cebu Pacific
   - Response returns through Node.js to frontend
   - Credits deducted on successful transaction

3. **Admin Management**:
   - Admins access `/admin` dashboard
   - Login with admin credentials
   - Manage users, licenses, credits, transactions
   - View system statistics

### Credit System

- Each user has a credit balance
- 1 credit = 1 payment attempt
- Credits deducted after successful payment processing
- Admins can add/remove credits via admin dashboard
- Users with 0 credits cannot process payments

## Configuration

### Backend Environment Variables

Edit `/backend/.env`:

```bash
# Server
PORT=3000
HOST=0.0.0.0

# Security
JWT_SECRET=your_secure_random_secret_here

# Admin Access
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_this_password

# Payment Processor Integration
PAYMENT_PROCESSOR_URL=http://localhost:5000

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000

# CORS
CORS_ORIGIN=*
CORS_CREDENTIALS=true
```

### Go Server Configuration

The Go server is configured in `server.go`:
- Port: 5000 (hardcoded)
- Embedded index.html (not used when running integrated system)

## Running in Production

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start Go server
pm2 start ./payment-processor --name payment-processor

# Start Node.js backend
cd backend
pm2 start npm --name backend -- start

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

### Using systemd

Create service files for both servers:

**Backend Service** (`/etc/systemd/system/pusa-backend.service`):
```ini
[Unit]
Description=Pusa Pacific Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/v2cebpac/backend
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

**Payment Processor Service** (`/etc/systemd/system/pusa-payment.service`):
```ini
[Unit]
Description=Pusa Pacific Payment Processor
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/v2cebpac
ExecStart=/path/to/v2cebpac/payment-processor
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable pusa-backend pusa-payment
sudo systemctl start pusa-backend pusa-payment
```

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout user

### Admin (`/api/admin`)
- `POST /api/admin/login` - Admin login
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/users` - List users
- `GET /api/admin/licenses` - List licenses
- `GET /api/admin/transactions` - List transactions

### Payment Processing
- `POST /pay` - Process payment (proxied to Go server)

## Troubleshooting

### Cannot connect to payment processor
- Ensure Go server is running on port 5000
- Check `PAYMENT_PROCESSOR_URL` in backend .env
- Verify no firewall blocking port 5000

### Authentication fails
- Verify JWT_SECRET is set
- Check database files in `/backend/storage/db`
- Ensure user license is valid and not expired

### Payment processing fails
- Check Go server logs
- Verify HPP content is valid
- Ensure card format is correct: `number|month|year|cvv`

## Development

### Backend Development
```bash
cd backend
npm run dev  # Auto-reload on file changes
```

### Go Development
```bash
# Run with live reload (requires air)
go install github.com/cosmtrek/air@latest
air
```

## Security Notes

1. **Change default admin credentials** in production
2. **Use HTTPS** in production (configure in backend .env)
3. **Generate strong JWT_SECRET** (256-bit recommended)
4. **Restrict CORS_ORIGIN** to your domain in production
5. **Enable rate limiting** appropriate for your use case
6. **Regular backups** of database files

## Support

For issues or questions:
1. Check logs in `/backend/logs`
2. Review error messages in browser console
3. Verify both servers are running
4. Check network connectivity between servers
