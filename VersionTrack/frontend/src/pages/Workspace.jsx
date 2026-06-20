import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  FileText, History, Activity, GitCompare, Users, Save, Shield, Edit3,
  CheckCircle, RefreshCw, X, UserMinus, UserPlus, AlertCircle, ArrowLeft,
  ChevronRight, Calendar, ArrowLeftRight
} from 'lucide-react';
import DiffViewer from '../components/DiffViewer';

const Workspace = () => {
  const { id: documentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Document metadata state
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Socket state
  const [activeCollaborators, setActiveCollaborators] = useState([]);
  const [typingIndicator, setTypingIndicator] = useState('');
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Tab views
  const [activeTab, setActiveTab] = useState('editor'); // 'editor', 'timeline', 'activity', 'compare'

  // Edit / Save state
  const [isTyping, setIsTyping] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [commitSummary, setCommitSummary] = useState('');
  const [localContent, setLocalContent] = useState('');

  // Collaborators Modal
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabSearch, setCollabSearch] = useState('');
  const [collabPermission, setCollabPermission] = useState('viewer');
  const [collabError, setCollabError] = useState('');
  const [collabLoading, setCollabLoading] = useState(false);

  // History & Compare states
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState([]); // Array of 2 versions to compare
  const [compareData, setCompareData] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Activity states
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // 1. Fetch document metadata and setup sockets
  useEffect(() => {
    fetchDocument();

    // Initialize socket connection
    socketRef.current = io('http://localhost:5001');

    // Join room
    socketRef.current.emit('join-document', {
      documentId,
      user,
    });

    // Listeners
    socketRef.current.on('active-collaborators', (collaborators) => {
      setActiveCollaborators(collaborators);
    });

    socketRef.current.on('document-updated', ({ content, senderId }) => {
      if (senderId !== user._id) {
        setLocalContent(content);
        setDoc((prev) => (prev ? { ...prev, content } : null));
      }
    });

    socketRef.current.on('user-typing', ({ username }) => {
      setTypingIndicator(`${username} is editing...`);
    });

    socketRef.current.on('user-stop-typing', () => {
      setTypingIndicator('');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-document', { documentId });
        socketRef.current.disconnect();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [documentId]);

  // Fetch document details
  const fetchDocument = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/documents/${documentId}`);
      setDoc(res.data);
      setLocalContent(res.data.content);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  // 2. Real-time typing sync
  const handleContentChange = (e) => {
    const content = e.target.value;
    setLocalContent(content);

    // Update document local state
    setDoc((prev) => (prev ? { ...prev, content } : null));

    // Emit live changes
    socketRef.current.emit('edit-document', {
      documentId,
      content,
      senderId: user._id,
    });

    // Trigger typing event with debounce
    if (!isTyping) {
      setIsTyping(true);
      socketRef.current.emit('typing', { documentId, username: user.username });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketRef.current.emit('stop-typing', { documentId, username: user.username });
      
      // Auto-save the working copy content back to database
      saveWorkingCopy(content);
    }, 1200);
  };

  const saveWorkingCopy = async (content) => {
    try {
      await api.put(`/documents/${documentId}`, { content });
    } catch (err) {
      console.error('Failed to auto-save working copy', err);
    }
  };

  // 3. Save Commit Version
  const handleSaveVersionSubmit = async (e) => {
    e.preventDefault();
    if (!commitSummary.trim()) return;

    try {
      setSavingVersion(true);
      // Ensure local content is saved first
      await api.put(`/documents/${documentId}`, { content: localContent });

      // Save version
      const res = await api.post('/versions', {
        documentId,
        changeSummary: commitSummary,
      });

      // Update doc metadata version
      setDoc((prev) => (prev ? { ...prev, currentVersion: res.data.versionNumber } : null));

      setCommitSummary('');
      setShowSaveModal(false);
      
      // If timeline is open, refresh it
      if (activeTab === 'timeline') {
        fetchVersions();
      }
    } catch (err) {
      console.error('Failed to commit version', err);
    } finally {
      setSavingVersion(false);
    }
  };

  // 4. Fetch Version History
  const fetchVersions = async () => {
    try {
      setVersionsLoading(true);
      const res = await api.get(`/versions/document/${documentId}`);
      setVersions(res.data);
    } catch (err) {
      console.error('Failed to fetch version history', err);
    } finally {
      setVersionsLoading(false);
    }
  };

  // Toggle version selection for compare
  const toggleSelectVersion = (versionNum) => {
    setSelectedVersions((prev) => {
      if (prev.includes(versionNum)) {
        return prev.filter((v) => v !== versionNum);
      }
      if (prev.length >= 2) {
        // Replace the oldest selection
        return [prev[1], versionNum];
      }
      return [...prev, versionNum];
    });
  };

  // Compare selected versions
  const triggerComparison = async () => {
    if (selectedVersions.length !== 2) return;
    const sorted = [...selectedVersions].sort((a, b) => a - b);
    try {
      setCompareLoading(true);
      setActiveTab('compare');
      const res = await api.get(`/versions/compare/${documentId}?baseVersion=${sorted[0]}&compareVersion=${sorted[1]}`);
      setCompareData(res.data);
    } catch (err) {
      console.error('Comparison calculation failed', err);
    } finally {
      setCompareLoading(false);
    }
  };

  // 5. Restore old version (preserved audit trail)
  const handleRestoreVersion = async (vNum) => {
    if (!window.confirm(`Are you sure you want to restore Version ${vNum}? This will create a new commit.`)) return;

    try {
      setLoading(true);
      const res = await api.post('/versions/restore', {
        documentId,
        versionNumber: vNum,
      });

      const restoredContent = res.data.document.content;

      // Emit live changes to all active collaborators
      if (socketRef.current) {
        socketRef.current.emit('edit-document', {
          documentId,
          content: restoredContent,
          senderId: user._id,
        });
      }

      // Re-fetch populated document and correct permissions role
      await fetchDocument();

      // Switch back to editor
      setActiveTab('editor');
      alert(`Restored successfully. New version v${res.data.document.currentVersion} created.`);
    } catch (err) {
      console.error('Restore version failed', err);
      alert(err.response?.data?.message || 'Restore failed');
    } finally {
      setLoading(false);
    }
  };

  // 6. Invite Collaborator
  const handleInviteCollaborator = async (e) => {
    e.preventDefault();
    if (!collabSearch.trim()) return;

    try {
      setCollabLoading(true);
      setCollabError('');
      const res = await api.post(`/documents/${documentId}/collaborators`, {
        emailOrUsername: collabSearch,
        permission: collabPermission,
      });
      setDoc((prev) => (prev ? { ...prev, collaborators: res.data } : null));
      setCollabSearch('');
    } catch (err) {
      setCollabError(err.response?.data?.message || 'Failed to invite collaborator');
    } finally {
      setCollabLoading(false);
    }
  };

  // Remove Collaborator
  const handleRemoveCollaborator = async (collabUserId) => {
    if (!window.confirm('Are you sure you want to remove this collaborator?')) return;
    try {
      const res = await api.delete(`/documents/${documentId}/collaborators/${collabUserId}`);
      setDoc((prev) => (prev ? { ...prev, collaborators: res.data } : null));
    } catch (err) {
      console.error('Failed to remove collaborator', err);
    }
  };

  // 7. Fetch Activity Feed
  const fetchActivities = async () => {
    try {
      setActivitiesLoading(true);
      const res = await api.get(`/activities/document/${documentId}`);
      setActivities(res.data);
    } catch (err) {
      console.error('Failed to fetch activity logs', err);
    } finally {
      setActivitiesLoading(false);
    }
  };

  // React to tab selection changes
  useEffect(() => {
    if (activeTab === 'timeline') {
      fetchVersions();
      setSelectedVersions([]);
    } else if (activeTab === 'activity') {
      fetchActivities();
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-xs font-mono">LOADING WORKSPACE...</span>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
        <h3 className="text-sm font-semibold font-mono text-zinc-300">Document inaccessible</h3>
        <p className="text-xs font-mono text-zinc-500 mt-1">{error || 'Verify permissions or document existence.'}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 inline-flex items-center gap-1 text-xs font-mono text-white hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </button>
      </div>
    );
  }

  const isEditable = doc.role === 'owner' || doc.role === 'editor';

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-zinc-950">
      {/* Sub-Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-zinc-400" />
            <span className="font-mono text-xs font-semibold text-zinc-200">{doc.title}</span>
            <span className="text-[10px] font-mono text-zinc-500">v{doc.currentVersion}</span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border border-zinc-800 rounded bg-zinc-900/40 p-0.5 text-xs font-mono">
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${activeTab === 'editor' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Editor</span>
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${activeTab === 'timeline' || activeTab === 'compare' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <History className="h-3.5 w-3.5" />
            <span>History</span>
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${activeTab === 'activity' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Audit</span>
          </button>
        </div>

        {/* Operations */}
        <div className="flex items-center gap-3">
          {isEditable && activeTab === 'editor' && (
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700 transition-all px-2.5 py-1.5 text-[10px] font-mono text-zinc-300 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>COMMIT VERSION</span>
            </button>
          )}

          <button
            onClick={() => setShowCollabModal(true)}
            className="flex items-center gap-1 rounded bg-zinc-900/80 border border-zinc-800 px-2.5 py-1.5 text-[10px] font-mono text-zinc-300 hover:border-zinc-700 transition-colors cursor-pointer"
          >
            <Users className="h-3.5 w-3.5" />
            <span>COLLABORATORS ({doc.collaborators.length})</span>
          </button>
        </div>
      </div>

      {/* Editor Active collaborators indicator line */}
      <div className="flex items-center justify-between border-b border-zinc-850/60 bg-zinc-900/10 px-6 py-1 text-[10px] font-mono text-zinc-500">
        <div className="flex items-center gap-2">
          {typingIndicator ? (
            <span className="text-zinc-400 italic animate-pulse">{typingIndicator}</span>
          ) : (
            <span className="text-zinc-600">All changes committed locally</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          <span>{activeCollaborators.length} active now:</span>
          <div className="flex -space-x-1 overflow-hidden ml-1">
            {activeCollaborators.map((c, i) => (
              <span
                key={c.userId + i}
                title={c.username}
                className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-zinc-950 bg-zinc-800 text-[8px] font-semibold text-zinc-300 uppercase select-none"
              >
                {c.username.slice(0, 2)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Workspace Workspace area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'editor' && (
          <div className="h-full flex flex-col p-6">
            <div className="flex-1 flex flex-col mx-auto w-full max-w-4xl border border-zinc-800 bg-zinc-900/10 rounded-lg overflow-hidden">
              <div className="border-b border-zinc-800 bg-zinc-900/30 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                  <Shield className="h-3.5 w-3.5" />
                  <span>ROLE:</span>
                  <span className="text-zinc-300 uppercase">{doc.role}</span>
                </div>
                {!isEditable && (
                  <span className="text-[9px] font-mono border border-amber-900/30 bg-amber-950/20 text-amber-500 px-1.5 py-0.5 rounded">
                    READ-ONLY
                  </span>
                )}
              </div>
              <textarea
                value={localContent}
                onChange={handleContentChange}
                disabled={!isEditable}
                className="flex-1 w-full bg-transparent p-6 text-sm font-mono text-zinc-200 placeholder-zinc-700 resize-none focus:outline-none leading-relaxed"
                placeholder={isEditable ? 'Start typing your document specs here...' : 'This document is read-only. Ask the owner for edit rights.'}
              />
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="mx-auto max-w-4xl px-6 py-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
              <div>
                <h2 className="text-sm font-semibold font-mono text-white">Version Timeline</h2>
                <p className="text-[11px] font-mono text-zinc-500 mt-0.5">Select up to two versions to compare diff commits.</p>
              </div>

              {selectedVersions.length === 2 && (
                <button
                  onClick={triggerComparison}
                  className="flex items-center gap-1.5 rounded bg-white px-3 py-1.5 text-xs font-mono font-medium text-black hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  <span>COMPARE SELECTED (v{selectedVersions[0]} vs v{selectedVersions[1]})</span>
                </button>
              )}
            </div>

            {versionsLoading ? (
              <div className="text-center py-12 text-zinc-500 text-xs font-mono">
                Retrieving history log...
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-12 text-zinc-650 text-xs font-mono">
                No saved versions found. Save your first version to track.
              </div>
            ) : (
              <div className="relative border-l border-zinc-850 pl-6 ml-3 space-y-6">
                {versions.map((v) => {
                  const isSelected = selectedVersions.includes(v.versionNumber);
                  return (
                    <div key={v._id} className="relative group">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full border ${isSelected ? 'bg-white border-white' : 'bg-zinc-950 border-zinc-700 group-hover:border-zinc-500'} transition-all`}></span>

                      <div className={`border rounded-lg p-4 transition-all ${isSelected ? 'border-zinc-600 bg-zinc-900/35' : 'border-zinc-800/80 bg-zinc-900/10 hover:border-zinc-700 hover:bg-zinc-900/20'}`}>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold font-mono text-zinc-200">v{v.versionNumber}</span>
                              <span className="text-[10px] font-mono text-zinc-500">— {v.changeSummary}</span>
                            </div>
                            <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500 pt-1">
                              <span className="flex items-center gap-1">
                                <Edit3 className="h-3 w-3" />
                                {v.editor?.username || 'Unknown'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(v.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleSelectVersion(v.versionNumber)}
                              className={`rounded border px-2 py-1 text-[10px] font-mono transition-colors ${isSelected ? 'border-white bg-white text-black font-semibold' : 'border-zinc-800 hover:border-zinc-700 hover:text-zinc-200 text-zinc-400'}`}
                            >
                              {isSelected ? 'SELECTED' : 'SELECT'}
                            </button>
                            {isEditable && (
                              <button
                                onClick={() => handleRestoreVersion(v.versionNumber)}
                                className="rounded border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200 px-2 py-1 text-[10px] font-mono text-zinc-400 cursor-pointer"
                              >
                                RESTORE
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="mx-auto max-w-5xl px-6 py-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('timeline')}
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h2 className="text-sm font-semibold font-mono text-white">Compare Versions</h2>
                  <p className="text-[11px] font-mono text-zinc-500 mt-0.5">
                    Showing diff calculations between version v{compareData?.baseVersion?.versionNumber} and v{compareData?.compareVersion?.versionNumber}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1 border border-zinc-850 px-2 py-1 rounded bg-zinc-900/35 text-zinc-400">
                  Base: v{compareData?.baseVersion?.versionNumber}
                </span>
                <ArrowLeftRight className="h-3.5 w-3.5 text-zinc-600" />
                <span className="flex items-center gap-1 border border-zinc-850 px-2 py-1 rounded bg-zinc-900/35 text-zinc-400">
                  Compare: v{compareData?.compareVersion?.versionNumber}
                </span>
              </div>
            </div>

            {compareLoading ? (
              <div className="text-center py-12 text-zinc-500 text-xs font-mono">
                Calculating changes diff...
              </div>
            ) : compareData ? (
              <DiffViewer diffBlocks={compareData.diff} />
            ) : (
              <div className="text-center py-12 text-zinc-500 text-xs font-mono">
                Select versions and trigger compare in History tab.
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="mx-auto max-w-4xl px-6 py-8">
            <div className="border-b border-zinc-800 pb-4 mb-6">
              <h2 className="text-sm font-semibold font-mono text-white">Document Audit Logs</h2>
              <p className="text-[11px] font-mono text-zinc-500 mt-0.5 font-mono">Complete historical action trail.</p>
            </div>

            {activitiesLoading ? (
              <div className="text-center py-12 text-zinc-500 text-xs font-mono">
                Loading audit trail...
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12 text-zinc-650 text-xs font-mono">
                No activity logs recorded.
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((a) => (
                  <div key={a._id} className="border border-zinc-850/80 rounded p-4 bg-zinc-900/10 flex items-start gap-4">
                    <div className="h-7 w-7 rounded border border-zinc-850 bg-zinc-900 flex items-center justify-center text-zinc-400 shrink-0">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5 text-xs font-mono">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-zinc-300">{a.user?.username || 'System'}</span>
                        <span className="text-zinc-500 uppercase text-[9px] border border-zinc-800 px-1 py-0.25 rounded bg-zinc-900/40">
                          {a.action.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(a.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-xs pt-1">
                        {a.action === 'DOCUMENT_CREATED' && `Created document with version v1.`}
                        {a.action === 'VERSION_SAVED' && `Saved new Version v${a.details?.versionNumber}: "${a.details?.changeSummary}"`}
                        {a.action === 'ROLLBACK_PERFORMED' && `Restored back to Version v${a.details?.restoredVersionNumber} (created Version v${a.details?.newVersionNumber}).`}
                        {a.action === 'COLLABORATOR_INVITED' && `Invited collaborator ${a.details?.collaboratorUsername} with role ${a.details?.permission}.`}
                        {a.action === 'COLLABORATOR_REMOVED' && `Removed collaborator ${a.details?.collaboratorUsername}.`}
                        {a.action === 'PERMISSION_CHANGED' && `Changed collaborator ${a.details?.collaboratorUsername} permission to ${a.details?.newPermission}.`}
                        {a.action === 'DOCUMENT_UPDATED' && `Updated working copy contents.`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. Commit Version Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-lg border border-zinc-850 bg-zinc-950 p-5 shadow-2xl">
            <h2 className="text-xs font-semibold font-mono tracking-tight text-white mb-3">
              COMMIT DOCUMENT VERSION
            </h2>
            <form onSubmit={handleSaveVersionSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Change Summary / Commit Message
                </label>
                <input
                  type="text"
                  value={commitSummary}
                  onChange={(e) => setCommitSummary(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-900/50 py-1.5 px-3 text-xs font-mono text-zinc-100 placeholder-zinc-650 focus:border-zinc-700 focus:outline-none"
                  placeholder="e.g. Added section 3 and fixed spacing"
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="rounded border border-zinc-800 bg-transparent px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={savingVersion}
                  className="rounded bg-white px-3 py-1.5 text-xs font-mono font-medium text-black hover:bg-zinc-200 cursor-pointer disabled:opacity-50"
                >
                  {savingVersion ? 'SAVING...' : 'SAVE VERSION'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Collaborators / Share Modal */}
      {showCollabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-850 bg-zinc-950 p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4 shrink-0">
              <h2 className="text-xs font-semibold font-mono text-white uppercase">Collaborators Settings</h2>
              <button
                onClick={() => {
                  setShowCollabModal(false);
                  setCollabError('');
                }}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Invite Form */}
            {doc.role === 'owner' && (
              <form onSubmit={handleInviteCollaborator} className="space-y-3 shrink-0 border-b border-zinc-800 pb-5 mb-4">
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                  Add Collaborator
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={collabSearch}
                    onChange={(e) => setCollabSearch(e.target.value)}
                    className="flex-1 rounded border border-zinc-800 bg-zinc-900/50 py-1.5 px-3 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:border-zinc-700 focus:outline-none"
                    placeholder="Username or email address..."
                    required
                  />
                  <select
                    value={collabPermission}
                    onChange={(e) => setCollabPermission(e.target.value)}
                    className="rounded border border-zinc-800 bg-zinc-900 py-1.5 px-2 text-xs font-mono text-zinc-300 focus:outline-none"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button
                    type="submit"
                    disabled={collabLoading}
                    className="flex items-center justify-center gap-1 rounded bg-white px-3 text-xs font-mono font-medium text-black hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>ADD</span>
                  </button>
                </div>
                {collabError && (
                  <p className="text-[10px] font-mono text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {collabError}
                  </p>
                )}
              </form>
            )}

            {/* Collaborators List */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Current Access</h3>

              {/* Owner */}
              <div className="flex items-center justify-between rounded border border-zinc-850/80 bg-zinc-900/20 px-3 py-2 text-xs font-mono">
                <div className="space-y-0.5">
                  <span className="text-zinc-200">{doc.owner?.username}</span>
                  <p className="text-[10px] text-zinc-500">{doc.owner?.email}</p>
                </div>
                <span className="text-[9px] border border-zinc-800 bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded">
                  OWNER
                </span>
              </div>

              {/* Collaborators list */}
              {doc.collaborators.length === 0 ? (
                <p className="text-[10px] font-mono text-zinc-650 italic text-center py-4">No other collaborators. Document is private.</p>
              ) : (
                doc.collaborators.map((c) => (
                  <div key={c.user?._id} className="flex items-center justify-between rounded border border-zinc-850/80 bg-zinc-900/20 px-3 py-2 text-xs font-mono">
                    <div className="space-y-0.5">
                      <span className="text-zinc-200">{c.user?.username}</span>
                      <p className="text-[10px] text-zinc-500">{c.user?.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] border border-zinc-800 bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded uppercase">
                        {c.permission}
                      </span>
                      {doc.role === 'owner' && (
                        <button
                          onClick={() => handleRemoveCollaborator(c.user?._id)}
                          className="text-zinc-500 hover:text-red-400 p-0.5 rounded"
                          title="Remove Access"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Workspace;
