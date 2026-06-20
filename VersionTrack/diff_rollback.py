#!/usr/bin/env python3
"""
VersionTrack - Python-Based Document Version Control System
Case Study Q5 Implementation

This script implements a simulated Document Version Control System in Python,
demonstrating document updates, history logging, diff generation, and
audit-preserving rollbacks.
"""

import sys
import difflib
from datetime import datetime, timezone

# ANSI escape codes for terminal coloring
COLOR_GREEN = "\033[92m"  # Additions (+)
COLOR_RED = "\033[91m"    # Deletions (-)
COLOR_RESET = "\033[0m"   # Unchanged / Reset


class Version:
    """Represents an immutable snapshot of a document version."""
    def __init__(self, version_number: int, content: str, editor: str, change_summary: str):
        self.version_number = version_number
        self.content = content
        self.editor = editor
        self.change_summary = change_summary
        self.created_at = datetime.now(timezone.utc)

    def __str__(self):
        return (f"v{self.version_number} | {self.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')} | "
                f"Editor: {self.editor} | Summary: {self.change_summary}")


class ActivityLog:
    """Represents an audit log entry for operations performed on a document."""
    def __init__(self, action: str, user: str, details: dict):
        self.action = action
        self.user = user
        self.details = details
        self.timestamp = datetime.now(timezone.utc)

    def __str__(self):
        timestamp_str = self.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')
        details_str = ", ".join([f"{k}: {v}" for k, v in self.details.items()])
        return f"[{timestamp_str}] ACTION: {self.action} | User: {self.user} | Details: {{{details_str}}}"


class DocumentVersionManager:
    """Manages document lifetime, version commits, diffing, and rollbacks."""
    def __init__(self, document_id: str, title: str, initial_content: str, owner: str):
        self.document_id = document_id
        self.title = title
        self.content = initial_content
        self.owner = owner
        self.collaborators = {}  # username -> permission ('editor' or 'viewer')
        self.current_version = 1
        
        # In-memory database lists
        self.versions = []
        self.activity_log = []

        # Save initial version
        first_version = Version(
            version_number=1,
            content=initial_content,
            editor=owner,
            change_summary="Initial document creation"
        )
        self.versions.append(first_version)
        self.log_activity("DOCUMENT_CREATED", owner, {"title": title, "initial_version": 1})

    def add_collaborator(self, owner_username: str, collaborator_username: str, permission: str):
        """Allows document owner to invite editors or viewers."""
        if owner_username != self.owner:
            raise PermissionError("Only the document owner can manage collaborators.")
        
        if permission not in ["editor", "viewer"]:
            raise ValueError("Permission must be 'editor' or 'viewer'.")
            
        self.collaborators[collaborator_username] = permission
        self.log_activity("COLLABORATOR_ADDED", owner_username, {
            "collaborator": collaborator_username, 
            "permission": permission
        })

    def verify_permission(self, username: str, required_permission: str = "viewer"):
        """Checks if a user is authorized to perform operations on this document."""
        if username == self.owner:
            return True
        
        user_permission = self.collaborators.get(username)
        if not user_permission:
            raise PermissionError(f"User '{username}' does not have access to this document.")
            
        if required_permission == "editor" and user_permission != "editor":
            raise PermissionError(f"User '{username}' has viewer-only permissions.")
            
        return True

    def commit_version(self, new_content: str, editor: str, change_summary: str = None) -> Version:
        """Commits changes to the document, generating a new immutable Version snapshot."""
        self.verify_permission(editor, required_permission="editor")
        
        self.current_version += 1
        self.content = new_content
        
        summary = change_summary or f"Updated content to Version {self.current_version}"
        new_version = Version(
            version_number=self.current_version,
            content=new_content,
            editor=editor,
            change_summary=summary
        )
        self.versions.append(new_version)
        
        self.log_activity("VERSION_SAVED", editor, {
            "version_number": self.current_version,
            "change_summary": summary
        })
        return new_version

    def get_version(self, version_number: int, viewer: str) -> Version:
        """Retrieves a specific historical version snapshot."""
        self.verify_permission(viewer, required_permission="viewer")
        
        for version in self.versions:
            if version.version_number == version_number:
                return version
        raise ValueError(f"Version {version_number} not found.")

    def rollback(self, target_version_number: int, editor: str) -> Version:
        """
        Performs an audit-preserving rollback.
        Fetches target version content, increments version index, and commits it as a new version.
        Guarantees that history remains strictly linear and audit-trail is preserved.
        """
        self.verify_permission(editor, required_permission="editor")
        
        # Retrieve target version
        target_version = self.get_version(target_version_number, editor)
        
        # Rollback by committing a new version with the old content
        rollback_summary = f"Restored content back to Version {target_version_number}"
        
        new_version = self.commit_version(
            new_content=target_version.content,
            editor=editor,
            change_summary=rollback_summary
        )
        
        self.log_activity("ROLLBACK_PERFORMED", editor, {
            "restored_version": target_version_number,
            "new_version": new_version.version_number
        })
        return new_version

    def generate_diff(self, version_a_num: int, version_b_num: int, viewer: str, format_type: str = "unified") -> str:
        """
        Generates line-by-line diff between two versions using standard Myers-like difference.
        Returns a colored terminal representation or unified diff text.
        """
        self.verify_permission(viewer, required_permission="viewer")
        
        version_a = self.get_version(version_a_num, viewer)
        version_b = self.get_version(version_b_num, viewer)
        
        lines_a = version_a.content.splitlines(keepends=True)
        lines_b = version_b.content.splitlines(keepends=True)
        
        diff_output = []
        
        if format_type == "unified":
            # standard unified diff
            diff_lines = list(difflib.unified_diff(
                lines_a, lines_b, 
                fromfile=f"Version {version_a_num}", 
                tofile=f"Version {version_b_num}"
            ))
            for line in diff_lines:
                if line.startswith('+') and not line.startswith('+++'):
                    diff_output.append(f"{COLOR_GREEN}{line.rstrip()}{COLOR_RESET}")
                elif line.startswith('-') and not line.startswith('---'):
                    diff_output.append(f"{COLOR_RED}{line.rstrip()}{COLOR_RESET}")
                else:
                    diff_output.append(line.rstrip())
                    
        elif format_type == "side-by-side":
            # Generate a cleaner side-by-side representation in the terminal
            matcher = difflib.SequenceMatcher(None, lines_a, lines_b)
            column_width = 45
            header_format = f"{{:<{column_width}}} | {{:<{column_width}}}"
            row_format = f"{{:<{column_width + 9}}} | {{:<{column_width + 9}}}"
            
            diff_output.append(header_format.format(f"--- Version {version_a_num} (Base)", f"+++ Version {version_b_num} (Compare)"))
            diff_output.append("-" * (column_width * 2 + 3))
            
            for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                if tag == 'equal':
                    # Draw matching lines next to each other
                    for a, b in zip(lines_a[i1:i2], lines_b[j1:j2]):
                        diff_output.append(header_format.format(a.strip()[:column_width], b.strip()[:column_width]))
                elif tag == 'replace':
                    # Draw modified lines (base red, compare green)
                    max_len = max(i2 - i1, j2 - j1)
                    for idx in range(max_len):
                        a_line = lines_a[i1 + idx].strip() if i1 + idx < i2 else ""
                        b_line = lines_b[j1 + idx].strip() if j1 + idx < j2 else ""
                        
                        a_colored = f"{COLOR_RED}{a_line[:column_width]}{COLOR_RESET}" if a_line else ""
                        b_colored = f"{COLOR_GREEN}{b_line[:column_width]}{COLOR_RESET}" if b_line else ""
                        
                        diff_output.append(row_format.format(a_colored, b_colored))
                elif tag == 'delete':
                    # Deleted from base (red left column, blank right)
                    for a in lines_a[i1:i2]:
                        a_colored = f"{COLOR_RED}{a.strip()[:column_width]}{COLOR_RESET}"
                        diff_output.append(row_format.format(a_colored, ""))
                elif tag == 'insert':
                    # Added in compare (blank left, green right)
                    for b in lines_b[j1:j2]:
                        b_colored = f"{COLOR_GREEN}{b.strip()[:column_width]}{COLOR_RESET}"
                        diff_output.append(row_format.format("", b_colored))
                        
        return "\n".join(diff_output)

    def log_activity(self, action: str, user: str, details: dict):
        """Records document changes and permission modifications in the audit trail."""
        log_entry = ActivityLog(action, user, details)
        self.activity_log.append(log_entry)

    def print_history(self):
        """Displays revision timeline."""
        print(f"\n--- History Log for Document: '{self.title}' ({self.document_id}) ---")
        for version in reversed(self.versions):
            print(version)

    def print_activity_log(self):
        """Displays full audit trail."""
        print(f"\n--- Activity Log / Audit Trail for Document: '{self.title}' ---")
        for log in self.activity_log:
            print(log)


# ==========================================
# Run Simulation Demonstrate VersionTrack
# ==========================================
if __name__ == "__main__":
    print("======================================================================")
    print("       VersionTrack: Document Version Control Simulation Engine       ")
    print("======================================================================\n")

    # 1. Initialize Document
    doc_id = "doc-9941"
    owner = "alice_dev"
    initial_text = (
        "Project Charter\n"
        "1. Scope: Build a collaborative documentation server.\n"
        "2. Tech Stack: Node.js, Express, Socket.io, MongoDB.\n"
        "3. Timeline: Delivery expected in 4 weeks.\n"
    )
    
    print(f"[Simulation] Alice creates a new document '{doc_id}'...")
    manager = DocumentVersionManager(
        document_id=doc_id, 
        title="Project Charter", 
        initial_content=initial_text, 
        owner=owner
    )
    
    # 2. Add Collaborators
    print("\n[Simulation] Alice adds bob_engineer as Editor and charlie_mgr as Viewer...")
    manager.add_collaborator(owner, "bob_engineer", "editor")
    manager.add_collaborator(owner, "charlie_mgr", "viewer")

    # 3. Editor edits document (Version 2)
    new_text_v2 = (
        "Project Charter\n"
        "1. Scope: Build a collaborative document version manager.\n"
        "2. Tech Stack: Node.js, React, Socket.io, MongoDB, Redis.\n"
        "3. Timeline: Delivery expected in 4 weeks.\n"
    )
    print("\n[Simulation] Bob updates document scopes and tech stack (Version 2)...")
    manager.commit_version(
        new_content=new_text_v2, 
        editor="bob_engineer", 
        change_summary="Refined tech stack and updated scope definition"
    )

    # 4. Editor edits document again (Version 3)
    new_text_v3 = (
        "Project Charter\n"
        "1. Scope: Build a collaborative document version manager.\n"
        "2. Tech Stack: Node.js, React, Socket.io, MongoDB, Redis.\n"
        "3. Timeline: Delivery compressed. Delivery expected in 3 weeks.\n"
        "4. Budget: Approved up to $50,000 USD.\n"
    )
    print("\n[Simulation] Bob compresses timeline and adds section 4 (Version 3)...")
    manager.commit_version(
        new_content=new_text_v3, 
        editor="bob_engineer", 
        change_summary="Compressed delivery timeline and added budget constraint"
    )

    # 5. Show History log
    manager.print_history()

    # 6. Generate and Print Diff Comparisons
    print("\n========================================= Unified Diff (v1 vs v3) =========================================")
    unified_diff = manager.generate_diff(1, 3, "charlie_mgr", format_type="unified")
    print(unified_diff)
    print("============================================================================================================")

    print("\n========================= Side-by-Side Diff (v2 vs v3) =========================")
    sbs_diff = manager.generate_diff(2, 3, "charlie_mgr", format_type="side-by-side")
    print(sbs_diff)
    print("================================================================================")

    # 7. Access Control Protection Test
    print("\n[Simulation] Testing access control: Charlie (Viewer) tries to write a version...")
    try:
        manager.commit_version("Hack content!", "charlie_mgr", "Malicious update")
    except PermissionError as e:
        print(f"❌ Access Denied: {e}")

    # 8. Perform Version Rollback (Audit-Preserving)
    print(f"\n[Simulation] Alice decides to rollback document changes to Version 2...")
    manager.rollback(target_version_number=2, editor="alice_dev")

    # 9. Verify rollback results and linearity of version chain
    print("\n[Simulation] Verifying doc state after rollback...")
    print(f"Current Version Index: {manager.current_version}")
    print("\nCurrent Document Text Content:")
    print("----------------------------------------")
    print(manager.content.strip())
    print("----------------------------------------")

    # Print updated history to show V4 is now V2 content
    manager.print_history()

    # Print entire audit trail
    manager.print_activity_log()
    print("\n[Simulation Completed successfully!]")
