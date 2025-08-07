# Premier Squares Service

A simple Node.js API service with a health check endpoint.

## Features

- ✅ Health check endpoint
- ✅ CORS enabled
- ✅ Security headers with Helmet
- ✅ Error handling
- ✅ Development mode with auto-reload
- ✅ Firebase integration for contest management
- ✅ Contest CRUD operations

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase project (optional - for full functionality)

### Installation

1. Install dependencies:
```bash
npm install
```

2. **Firebase Setup (Optional):**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Go to Project Settings > Service Accounts
   - Generate a new private key
   - Save the JSON file as `firebase-service-account.json` in the root directory
   - Or set the `FIREBASE_SERVICE_ACCOUNT` environment variable with the JSON content

### Running the Service

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3001` (or the port specified in the `PORT` environment variable).

## API Endpoints

### Health Check
- **GET** `/health`
- Returns service status and uptime information

**Response:**
```json
{
  "status": "OK",
  "message": "Service is running",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 123.456
}
```

### Root Endpoint
- **GET** `/`
- Returns API information and available endpoints

**Response:**
```json
{
  "message": "Premier Squares Service API",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "contests": {
      "create": "POST /contests",
      "getAll": "GET /contests",
      "getById": "GET /contests/:id",
      "update": "PUT /contests/:id",
      "start": "POST /contests/:id/start"
    }
  }
}
```

### Contest Endpoints

#### Create Contest
- **POST** `/contests`
- Creates a new contest entry with the provided eventId

**Request Body:**
```json
{
  "eventId": "your-event-id",
  "costPerSquare": 10.00
}
```

**Required Fields:**
- `eventId` (string) - The event identifier
- `costPerSquare` (number) - Cost per square in dollars (must be positive)

**Response:**
```json
{
  "success": true,
  "message": "Contest entry created successfully",
  "documentId": "generated-firebase-document-id",
  "data": {
    "eventId": "your-event-id",
    "costPerSquare": 10.00,
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z",
    "status": "new",
    "id": "generated-firebase-document-id"
  }
}
```

#### Get All Contests
- **GET** `/contests`
- Returns all contest entries

**Response:**
```json
{
  "success": true,
  "count": 1,
  "contests": [
    {
      "id": "document-id",
      "eventId": "event-id",
      "createdAt": "2024-01-01T12:00:00.000Z",
      "updatedAt": "2024-01-01T12:00:00.000Z",
      "status": "new"
    }
  ]
}
```

#### Get Contest by ID
- **GET** `/contests/:id`
- Returns a specific contest by document ID

**Response:**
```json
{
  "success": true,
  "contest": {
    "id": "document-id",
    "eventId": "event-id",
    "costPerSquare": 10.00,
    "names": ["John Doe", "Jane Smith"],
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z",
    "status": "new"
  }
}
```

#### Update Contest
- **PUT** `/contests/:id`
- Updates a contest with a names array (max 100 names)
- **Only allowed when contest status is 'new'**

**Request Body:**
```json
{
  "names": ["John Doe", "Jane Smith", "Bob Johnson"]
}
```

**Required Fields:**
- `names` (array) - Array of participant names (max 100 items, all must be non-empty strings)

**Validation Rules:**
- Contest must exist
- Contest status must be 'new' (cannot update active/completed contests)

**Response:**
```json
{
  "success": true,
  "message": "Contest updated successfully",
  "data": {
    "id": "document-id",
    "eventId": "event-id",
    "costPerSquare": 10.00,
    "names": ["John Doe", "Jane Smith", "Bob Johnson"],
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z",
    "status": "new"
  }
}
```

**Error Response (Wrong Status):**
```json
{
  "error": "Bad Request",
  "message": "Contest cannot be updated in 'active' state. Only contests in 'new' state can be updated.",
  "currentStatus": "active"
}
```

#### Start Contest
- **POST** `/contests/:id/start`
- Validates all required fields and starts a contest (changes status to 'active' and randomly shuffles the names array)

**Validation Requirements:**
- Contest status must be 'new' (cannot start active/completed/cancelled contests)
- `eventId` must exist
- `costPerSquare` must be a positive number
- `names` array must have exactly 100 non-empty strings

**Response (Success):**
```json
{
  "success": true,
  "message": "Contest has started successfully",
  "data": {
    "id": "document-id",
    "eventId": "event-id",
    "costPerSquare": 10.00,
    "names": ["Name3", "Name1", "Name2", ...], // Randomly shuffled
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z",
    "status": "active"
  }
}
```

**Response (Validation Failed):**
```json
{
  "error": "Validation Failed",
  "message": "Contest cannot start due to missing or invalid data",
  "validationErrors": [
    "Contest cannot be started in 'active' state. Only contests in 'new' state can be started."
  ],
  "contestData": {
    "id": "document-id",
    "eventId": "event-id",
    "costPerSquare": 10.00,
    "namesCount": 100,
    "status": "active"
  }
}
```

## Environment Variables

- `PORT` - Server port (default: 3001)
- `FIREBASE_SERVICE_ACCOUNT` - Firebase service account JSON (optional)
- `FIREBASE_DATABASE_URL` - Firebase database URL (optional)

## Scripts

- `npm start` - Start the server in production mode
- `npm run dev` - Start the server in development mode with auto-reload
- `npm test` - Run tests (not implemented yet)

## Project Structure

```
premier-squares-service/
├── server.js                          # Main server file
├── package.json                       # Dependencies and scripts
├── config/
│   └── firebase.js                   # Firebase configuration
├── routes/
│   └── contests.js                   # Contest routes
├── firebase-service-account.example.json  # Firebase setup template
└── README.md                         # This file
```

## Testing the API

You can test the endpoints using curl:

```bash
# Health check
curl http://localhost:3001/health

# Root endpoint
curl http://localhost:3001/

# Create a contest
curl -X POST http://localhost:3001/contests \
  -H "Content-Type: application/json" \
  -d '{"eventId": "test-event-123", "costPerSquare": 10.00}'

# Get all contests
curl http://localhost:3001/contests

# Get specific contest (replace DOCUMENT_ID with actual ID)
curl http://localhost:3001/contests/DOCUMENT_ID

# Update contest with names (replace DOCUMENT_ID with actual ID)
curl -X PUT http://localhost:3001/contests/DOCUMENT_ID \
  -H "Content-Type: application/json" \
  -d '{"names": ["John Doe", "Jane Smith", "Bob Johnson"]}'

# Start contest (replace DOCUMENT_ID with actual ID)
curl -X POST http://localhost:3001/contests/DOCUMENT_ID/start
```

Or use your browser to visit:
- http://localhost:3001/health
- http://localhost:3001/
- http://localhost:3001/contests (GET)

