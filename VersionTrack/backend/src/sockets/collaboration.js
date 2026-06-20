// Map to keep track of active users viewing/editing documents
// Key: documentId, Value: Map of socket.id -> { userId, username, email }
const activeCollaborators = new Map();

const setupCollaboration = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join room for a document
    socket.on('join-document', ({ documentId, user }) => {
      if (!documentId || !user) return;

      socket.join(documentId);
      socket.documentId = documentId;
      socket.user = user;

      if (!activeCollaborators.has(documentId)) {
        activeCollaborators.set(documentId, new Map());
      }

      // Add collaborator to active list
      activeCollaborators.get(documentId).set(socket.id, {
        userId: user._id,
        username: user.username,
        email: user.email,
      });

      // Broadcast updated list to the room
      sendCollaboratorsUpdate(io, documentId);
      console.log(`User ${user.username} joined document room: ${documentId}`);
    });

    // Handle live document editing updates
    socket.on('edit-document', ({ documentId, content, senderId }) => {
      // Broadcast content to all other users in the document room
      socket.to(documentId).emit('document-updated', { content, senderId });
    });

    // Handle typing events
    socket.on('typing', ({ documentId, username }) => {
      socket.to(documentId).emit('user-typing', { username });
    });

    socket.on('stop-typing', ({ documentId, username }) => {
      socket.to(documentId).emit('user-stop-typing', { username });
    });

    // Handle client leaving document explicitly
    socket.on('leave-document', ({ documentId }) => {
      socket.leave(documentId);
      removeUserFromRoom(socket, documentId, io);
      console.log(`Socket ${socket.id} left room ${documentId}`);
    });

    // Handle client disconnection
    socket.on('disconnect', () => {
      const { documentId } = socket;
      if (documentId) {
        removeUserFromRoom(socket, documentId, io);
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

// Helper: Remove user from document room registry and emit update
const removeUserFromRoom = (socket, documentId, io) => {
  if (activeCollaborators.has(documentId)) {
    const roomCollabs = activeCollaborators.get(documentId);
    roomCollabs.delete(socket.id);

    if (roomCollabs.size === 0) {
      activeCollaborators.delete(documentId);
    } else {
      sendCollaboratorsUpdate(io, documentId);
    }
  }
};

// Helper: Collect and broadcast unique collaborators
const sendCollaboratorsUpdate = (io, documentId) => {
  if (activeCollaborators.has(documentId)) {
    const list = Array.from(activeCollaborators.get(documentId).values());
    const uniqueList = [];
    const seen = new Set();

    for (const item of list) {
      if (!seen.has(item.userId)) {
        seen.add(item.userId);
        uniqueList.push(item);
      }
    }

    io.to(documentId).emit('active-collaborators', uniqueList);
  }
};

module.exports = setupCollaboration;
