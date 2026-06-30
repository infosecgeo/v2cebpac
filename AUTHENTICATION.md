# Authentication Setup Guide

This document explains how to set up and use authentication in the Cebu Pacific system.

## Overview

The system has two types of authentication:

1. **Admin Authentication**: Username + Password (for accessing admin dashboard)
2. **User Authentication**: License Key (for regular users accessing payment processor)

## Initial Setup

### 1. Configure Environment Variables

Create or edit `backend/.env` file:

```bash
# Admin Configuration
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourSecurePassword123

# JWT Configuration
JWT_SECRET=your_secure_random_256bit_secret_here
JWT_EXPIRES_IN=24h
```

**Important**: Change the default admin password before deploying to production!

### 2. Initialize Database

Run the initialization script to create database files and the default admin user:

```bash
cd backend
npm run init-db
```

This will create:
- `storage/db/users.json` - Admin users
- `storage/db/licenses.json` - License keys
- `storage/db/sessions.json` - Active sessions
- `storage/db/transactions.json` - Transaction history
- Other database files...

The script will display the admin credentials:

```
Default Admin Credentials:
  Username: admin
  Password: admin123

⚠️  IMPORTANT: Change the default admin password immediately!

Admin Login: http://localhost:3000/admin/login.html
```

### 3. Start the Server

```bash
npm start
```

## Admin Access

### Login to Admin Dashboard

1. Navigate to: `http://localhost:3000/admin/login.html`
2. Enter your admin username and password
3. Click "Login"

**Default Credentials** (first time only):
- Username: `admin` (or your `ADMIN_USERNAME` from .env)
- Password: `admin123` (or your `ADMIN_PASSWORD` from .env)

### Admin Features

Once logged in, admins can:
- View dashboard statistics
- Manage users and licenses
- View transactions
- Configure system settings

### Logout

Click the "Logout" button in the top-right corner of the admin dashboard.

## User Access (License-Based)

### Login as a Regular User

1. Navigate to: `http://localhost:3000/`
2. Click the "Login" button
3. Enter your username and license key
4. Click "Login"

**Note**: Regular users do NOT use passwords. They use license keys issued by admins.

### User Features

Once logged in, users can:
- Process payment requests
- View their credit balance
- Submit payment forms
- View transaction results

### Form Access Control

The payment form is **disabled** until the user logs in. This ensures:
- Only authenticated users can process payments
- Credits are properly tracked
- All transactions are logged

## Security Features

### 1. Protected Routes

- **Admin Dashboard** (`/admin/`): Redirects to login page if not authenticated
- **Payment Form** (`/`): Disables form fields until user logs in
- **API Endpoints** (`/api/admin/*`): Requires valid JWT token

### 2. Authentication Flow

#### Admin Flow:
```
/admin/ → Check localStorage for adminToken
  ↓
  No token? → Redirect to /admin/login.html
  ↓
  Token exists? → Validate with backend → Show dashboard
  ↓
  Invalid token? → Clear storage → Redirect to login
```

#### User Flow:
```
/ → Load payment form (disabled)
  ↓
  Click "Login" → Enter license key → Validate
  ↓
  Valid? → Store token → Enable form → Show credits
  ↓
  Invalid? → Show error → Keep form disabled
```

### 3. Token Storage

- **Admin tokens**: Stored in `localStorage.adminToken`
- **User tokens**: Stored in `localStorage.userToken`
- Tokens are JWT-based with expiration
- Tokens are verified on each API request

### 4. Session Management

- Admin sessions are validated on page load
- User sessions are validated on page load and before form submission
- Invalid sessions automatically redirect to login
- Logout clears tokens and redirects appropriately

## API Endpoints

### Admin Endpoints

- `POST /api/admin/login` - Admin login
  ```json
  {
    "username": "admin",
    "password": "password123"
  }
  ```

- `GET /api/admin/*` - Requires admin token in header:
  ```
  Authorization: ****** <token>
  ```

### User Endpoints

- `POST /api/auth/license` - User login with license key
  ```json
  {
    "licenseKey": "XXXX-XXXX-XXXX-XXXX"
  }
  ```

- `GET /api/auth/validate` - Validate user token
  ```
  Authorization: ****** <token>
  ```

## Troubleshooting

### Cannot login to admin dashboard

1. Check if database is initialized:
   ```bash
   ls backend/storage/db/users.json
   ```

2. Reinitialize database if needed:
   ```bash
   npm run init-db:force
   ```

3. Check admin credentials in `.env` file

4. Clear browser localStorage:
   ```javascript
   // In browser console
   localStorage.clear()
   ```

### User login fails

1. Verify license key exists in database
2. Check license status (should be "active")
3. Check license expiration date
4. Verify JWT_SECRET is set in .env

### Form stays disabled after login

1. Check browser console for errors
2. Verify `/api/auth/validate` returns successfully
3. Clear localStorage and login again
4. Check that userToken is stored:
   ```javascript
   // In browser console
   console.log(localStorage.getItem('userToken'))
   ```

## Best Practices

### For Production

1. **Change default admin password** immediately
2. **Use strong JWT_SECRET** (256-bit random string)
3. **Enable HTTPS** (configure in backend .env)
4. **Regular password rotation** for admin accounts
5. **Monitor failed login attempts**
6. **Regular database backups**

### For Development

1. Use different credentials than production
2. Keep `.env` file out of version control
3. Test authentication flows regularly
4. Clear localStorage between tests

## Additional Security

### Rate Limiting

The system includes rate limiting on authentication endpoints:
- Max 5 failed login attempts per 15 minutes
- Automatic lockout after excessive failures

### Password Requirements

Admin passwords should:
- Be at least 8 characters long
- Include uppercase and lowercase letters
- Include numbers
- Include special characters

### License Key Security

- License keys are validated against database
- Expired licenses are automatically rejected
- Suspended licenses cannot be used
- Maximum concurrent sessions per license

## Support

For additional help:
1. Check application logs in `backend/logs/`
2. Review error messages in browser console
3. Verify database integrity
4. Check network connectivity between servers
