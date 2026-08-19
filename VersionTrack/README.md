# VersionTrack 🚀

**Live Demo:** https://frontend-zeta-lake-76.vercel.app

VersionTrack is a distributed document version control platform inspired by GitHub, Google Docs Version History, and Notion. It is built as a robust, production-quality engineering tool tailored for teams that need to create documents, edit collaboratively in real-time, maintain an immutable history of changes, compare revision diffs, and perform rollbacks without losing historical audit trails.

---

## 🏛 Architecture & Scaling Considerations

VersionTrack is designed with modern distributed systems principles in mind, assuming support for **millions of documents** and **horizontal scaling**:

1. **Immutable History Isolation**:
   - Instead of storing version history inside a single document (which would quickly hit MongoDB's 16MB document limit and cause slow queries), history is decoupled.
   - Historical revisions live in their own `versions` collection. This allows MongoDB to distribute versions across different shards easily.
2. **MongoDB Sharding & Keys**:
   - The primary shard key for `versions` and `activities` collections is set on `documentId`. This ensures all historical records and logs for a given document live on the same database shard for fast, localized index queries, while different documents are balanced across the cluster.
3. **Optimized Indexes**:
   - Composite index `{ documentId: 1, versionNumber: -1 }` on `versions` yields fast retrieval of history logs in descending order.
   - Index `{ owner: 1 }` and `{ "collaborators.user": 1 }` on `documents` allow high-throughput dashboard querying.
   - Text indexing on the document title is enabled for search scaling.
4. **Stateless Backend Nodes**:
   - The Express application is completely stateless. To run behind a load balancer (horizontal scaling), a Redis Adapter can be attached to Socket.IO to broadcast collaboration events across multiple Node.js server instances.

---

## 🛠 Tech Stack

- **Frontend**: React (Vite), TailwindCSS, React Router, Axios, Socket.IO Client, Diff (jsdiff parser)
- **Backend**: Node.js, Express, Socket.IO
- **Database**: MongoDB (via Mongoose)
- **Security**: JSON Web Tokens (JWT) & bcryptjs (password hashing)

---

## 📁 Project Folder Structure

```text
System Design/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                 # Database connection config
│   │   ├── controllers/
│   │   │   ├── activityController.js # Activity log history queries
│   │   │   ├── authController.js     # User registration, login & profile
│   │   │   ├── documentController.js # CRUD, searching, collaboration invites
│   │   │   └── versionController.js  # Version creation, restore, diff compare
│   │   ├── middleware/
│   │   │   └── authMiddleware.js     # JWT route protection
│   │   ├── models/
│   │   │   ├── Activity.js           # Activity log schema & index config
│   │   │   ├── Document.js           # Document metadata & permissions schema
│   │   │   ├── User.js               # User profile schema with bcrypt hooks
│   │   │   └── Version.js            # Version history schema with text states
│   │   ├── routes/
│   │   │   ├── activityRoutes.js
│   │   │   ├── authRoutes.js
│   │   │   ├── documentRoutes.js
│   │   │   └── versionRoutes.js
│   │   ├── sockets/
│   │   │   └── collaboration.js     # Socket.io room-based collab handler
│   │   └── server.js                 # Express server & socket orchestrator
│   ├── .env                          # Env configuration
│   └── package.json                  # Dependencies manifest
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DiffViewer.jsx        # GitHub-style Side-by-side & Unified diff viewer
│   │   │   ├── Navbar.jsx            # Shared header component
│   │   │   └── PrivateRoute.jsx      # Auth verification guard
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # State provider for session auth
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx         # Document lists, Search, Creation
│   │   │   ├── Login.jsx             # Minimalist auth entrance
│   │   │   ├── Register.jsx          # Register entrance
│   │   │   └── Workspace.jsx         # Collaborative editor & history tab views
│   │   ├── utils/
│   │   │   └── api.js                # Custom Axios client with JWT interceptors
│   │   ├── App.jsx                   # React application router
│   │   ├── index.css                 # Custom global scrollbars & dark styles
│   │   └── main.jsx
│   ├── tailwind.config.js            # Monochrome design parameters
│   └── package.json
└── README.md                         # Detailed system architecture document
```

---

## ⚙️ Core Logic Implementations

### 1. Document Version Control (N+1)
When users click "Commit Version" in the Editor tab:
1. The backend increments the current document version: `document.currentVersion += 1`.
2. A new, separate document in the `versions` collection is created. This stores the current snapshot's text content, the editor's userId, a timestamp, and a custom commit summary.
3. This guarantees that history is linear and immutable, avoiding race conditions or history overwrite conflicts.

### 2. Audit-Preserving Rollback
Rollbacks never delete history! If a user restores version `V5` on a document currently at `V7`:
1. The system retrieves the text content of `V5`.
2. The system increments the version index to `V8`.
3. A new version `V8` is created with a copy of `V5`'s content and a commit message `"Restored back to Version 5"`.
4. The active document content is set to the text of `V5`.
This guarantees that auditing is complete: every rollback action is itself recorded as a new, auditable version step.

### 3. GitHub-Style Diff Comparison
We use the `diff` package (line-by-line diffing) to calculate additions, removals, and unchanged lines between any two selected versions. 
- **Unified View**: Displays changes inline, highlighting additions in green (`+`) and removals in red (`-`).
- **Side-by-Side View**: Renders two columns (Base Version vs Compare Version). Left and right blocks are aligned so modified lines align next to each other.

### 4. Real-time Collaboration (WebSockets)
- Room-based architecture: sockets join a channel named after the `documentId`.
- **Live Editing**: As user A types, a debounced keypress event broadcasts changes to all users in the same room. Users viewing the document see content update instantly.
- **Typing Indicators**: Displays `"User X is editing..."` while typing.
- **Collaborator Badges**: Keeps a live registry of socket connections in each room and displays avatar badges showing exactly who is online.

---

## 🚀 Running the Application Local Dev

### Prerequisites
- Install **Node.js** (v18+)
- Ensure **MongoDB** is running locally on port `27017` (`mongodb://localhost:27017/versiontrack`).

### 1. Backend Setup
1. Open a terminal in the `backend/` folder.
2. Verify the `.env` variables:
   ```env
   PORT=5001
   MONGO_URI=mongodb://localhost:27017/versiontrack
   JWT_SECRET=supersecretversiontrackkey
   ```
3. Run the backend development server:
   ```bash
   npm run dev
   ```
   *The backend will boot up at `http://localhost:5001` and establish connection to MongoDB.*

### 2. Frontend Setup
1. Open a separate terminal in the `frontend/` folder.
2. Install dependencies (if not already done):
   ```bash
   npm install
   ```
3. Launch the Vite client:
   ```bash
   npm run dev
   ```
4. Access the web interface at `http://localhost:5173`.

---

## 🛰 API Endpoints Reference

### Authentication (`/api/auth`)
- `POST /register`: Registers a new user account. Returns a JWT.
- `POST /login`: Validates credentials. Returns a JWT.
- `GET /me`: Fetches the currently authenticated user profile. (Protected)

### Documents (`/api/documents`)
- `GET /`: Lists all documents owned by or collaborating with the user. (Protected)
- `POST /`: Creates a new document (initializes version 1). (Protected)
- `GET /search?q=query`: Searches document titles by query parameter. (Protected)
- `GET /:id`: Fetches detailed document content, collaborators, and user permissions. (Protected)
- `PUT /:id`: Updates working copy content or title. (Protected)
- `DELETE /:id`: Soft deletes a document (maintains revision history). (Protected)

### Collaborators Management (`/api/documents/:id/collaborators`)
- `POST /`: Invites a collaborator by username or email. (Protected, Owner only)
- `PUT /:userId`: Updates permission level ('editor' or 'viewer'). (Protected, Owner only)
- `DELETE /:userId`: Revokes access for a collaborator. (Protected, Owner only)

### Versions (`/api/versions`)
- `POST /`: Commits/saves a new version. (Protected, Owner/Editor only)
- `GET /document/:documentId`: Retrieves the version list timeline. (Protected)
- `GET /document/:documentId/:versionNumber`: Gets a single specific version. (Protected)
- `GET /compare/:documentId?baseVersion=X&compareVersion=Y`: Computes a line-by-line diff. (Protected)
- `POST /restore`: Creates a rollback commit to restore a past version. (Protected, Owner/Editor only)

### Activities (`/api/activities`)
- `GET /document/:documentId`: Retrieves full audit log history of events. (Protected)
