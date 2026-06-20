import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Plus, Search, FileText, User, Users, Calendar, ArrowRight, Shield } from 'lucide-react';

const Dashboard = () => {
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/documents');
      setDocuments(res.data);
    } catch (err) {
      console.error('Failed to fetch documents', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim() === '') {
      fetchDocuments();
      return;
    }

    try {
      const res = await api.get(`/documents/search?q=${query}`);
      setDocuments(res.data);
    } catch (err) {
      console.error('Search failed', err);
    }
  };

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setError('Document title is required');
      return;
    }

    try {
      setError('');
      setCreating(true);
      const res = await api.post('/documents', {
        title: newTitle,
        content: newContent,
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewContent('');
      navigate(`/documents/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create document');
    } finally {
      setCreating(false);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'owner':
        return 'border-zinc-700 bg-zinc-900 text-zinc-200';
      case 'editor':
        return 'border-blue-900/30 bg-blue-950/20 text-blue-400';
      case 'viewer':
        return 'border-zinc-800 bg-zinc-900/30 text-zinc-400';
      default:
        return 'border-zinc-800 bg-zinc-900/30 text-zinc-400';
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-6 mb-8">
        <div>
          <h1 className="text-xl font-semibold font-mono tracking-tight text-white">Workspace</h1>
          <p className="text-xs font-mono text-zinc-500 mt-1">Manage, collaborate and track your document commits.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-1.5 rounded-md bg-white px-4 py-2 text-xs font-mono font-medium text-black hover:bg-zinc-200 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>NEW DOCUMENT</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearch}
          className="w-full rounded-md border border-zinc-800 bg-zinc-900/20 py-2.5 pl-10 pr-4 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
          placeholder="Search documents by title..."
        />
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <div className="h-5 w-5 animate-spin rounded-full border border-zinc-700 border-t-zinc-400 mb-2"></div>
          <span className="text-xs font-mono uppercase tracking-wider">Retrieving documents...</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 py-16 text-center">
          <FileText className="h-8 w-8 text-zinc-600 mb-3" />
          <h3 className="text-sm font-semibold font-mono text-zinc-300">No documents found</h3>
          <p className="text-xs font-mono text-zinc-500 mt-1 max-w-[280px]">
            {searchQuery ? 'Try adjusting your search criteria.' : 'Create a new document to start collaborating and tracking revisions.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:border-zinc-700 hover:text-white transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create First Document</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => {
            // Determine role representation
            const isOwner = doc.owner?._id === doc.owner?._id; // placeholder, will verify role dynamically
            return (
              <div
                key={doc._id}
                onClick={() => navigate(`/documents/${doc._id}`)}
                className="group relative flex flex-col justify-between rounded-lg border border-zinc-800 bg-zinc-900/20 p-5 hover:border-zinc-700 hover:bg-zinc-900/30 transition-all duration-200 cursor-pointer"
              >
                <div>
                  {/* Top line metadata */}
                  <div className="flex items-center justify-between mb-3 text-[10px] font-mono">
                    <span className="text-zinc-500">v{doc.currentVersion}</span>
                    <span className={`rounded-full border px-2 py-0.5 uppercase tracking-wider ${getRoleColor(doc.owner?._id === doc.owner?._id ? 'owner' : 'collaborator')}`}>
                      {doc.owner?._id === doc.owner?._id ? 'owner' : 'collab'}
                    </span>
                  </div>

                  {/* Title & snippet */}
                  <h3 className="text-sm font-semibold font-mono text-zinc-100 group-hover:text-white transition-colors truncate mb-1">
                    {doc.title}
                  </h3>
                  <p className="text-xs font-mono text-zinc-500 line-clamp-2 mb-4 min-h-[32px]">
                    {doc.content || <span className="italic text-zinc-600">No content yet.</span>}
                  </p>
                </div>

                {/* Bottom line meta */}
                <div className="flex items-center justify-between border-t border-zinc-800/60 pt-3 text-[10px] font-mono text-zinc-500">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="truncate max-w-[80px]">{doc.owner?.username}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="h-4 w-4 text-zinc-400" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Document Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h2 className="text-sm font-semibold font-mono tracking-tight text-white mb-4">
              CREATE NEW DOCUMENT
            </h2>

            {error && (
              <div className="mb-4 rounded-md border border-red-900/30 bg-red-950/20 px-3 py-2 text-xs text-red-400 font-mono">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateDocument} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900/50 py-2 px-3 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  placeholder="e.g. API Architecture Spec"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Initial Content (Optional)
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows="4"
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900/50 py-2 px-3 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700 resize-none"
                  placeholder="Type initial content here..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-md border border-zinc-800 bg-transparent px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-md bg-white px-3 py-1.5 text-xs font-mono font-medium text-black hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {creating ? 'CREATING...' : 'CREATE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
