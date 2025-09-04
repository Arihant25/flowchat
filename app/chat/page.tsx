"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  getAllConversations,
  putConversation,
  deleteConversation as deleteStoredConversation,
  StoredConversation,
  initializeDefaultProviders,
} from "@/lib/storage";
import ChatSidebar from "./components/ChatSidebar";
import ChatCanvas from "./components/ChatCanvas";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";

export interface ChatNode {
  id: string;
  content: string;
  isUser: boolean;
  x: number;
  y: number;
  parentId?: string;
  childIds: string[];
  isEditing?: boolean;
  thinking?: string;
  thinkingTime?: number;
}

export interface ChatConversation {
  id: string;
  title: string;
  nodes: ChatNode[];
  lastModified: Date;
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversation, setCurrentConversation] =
    useState<ChatConversation | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingNodePosition, setPendingNodePosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const createNewConversation = useCallback(
    (initialNodePosition?: { x: number; y: number }) => {
      const newConversation: ChatConversation = {
        id: `conv-${Date.now()}`,
        title: "New Conversation",
        nodes: initialNodePosition
          ? [
            {
              id: `node-${Date.now()}`,
              content: "",
              isUser: true,
              x: initialNodePosition.x,
              y: initialNodePosition.y,
              childIds: [],
              isEditing: true,
            },
          ]
          : [],
        lastModified: new Date(),
      };
      setCurrentConversation(newConversation);
      setConversations((prev) => [newConversation, ...prev]);
      // persist
      try {
        const toStore: StoredConversation = {
          id: newConversation.id,
          title: newConversation.title,
          nodes: newConversation.nodes,
          lastModified: newConversation.lastModified.toISOString(),
        };
        void putConversation(toStore);
      } catch (err) {
        console.warn("Failed to persist new conversation:", err);
      }
    },
    [],
  );

  const updateConversation = useCallback(
    (updatedConversation: ChatConversation) => {
      setCurrentConversation(updatedConversation);
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === updatedConversation.id
            ? { ...updatedConversation, lastModified: new Date() }
            : conv,
        ),
      );
      // persist
      try {
        const toStore: StoredConversation = {
          id: updatedConversation.id,
          title: updatedConversation.title,
          nodes: updatedConversation.nodes,
          lastModified: new Date().toISOString(),
        };
        void putConversation(toStore);
      } catch (err) {
        console.warn("Failed to persist updated conversation:", err);
      }
    },
    [],
  );

  const deleteConversation = useCallback(
    (conversationId: string) => {
      setConversations((prev) =>
        prev.filter((conv) => conv.id !== conversationId),
      );
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
      }
      // remove from storage
      try {
        void deleteStoredConversation(conversationId);
      } catch (err) {
        console.warn("Failed to delete conversation from storage:", err);
      }
    },
    [currentConversation?.id],
  );

  const renameConversation = useCallback((conversationId: string, newTitle: string) => {
    setConversations((prev) => {
      const updatedConversations = prev.map((conv) =>
        conv.id === conversationId ? { ...conv, title: newTitle, lastModified: new Date() } : conv,
      );

      // Persist the updated conversation
      const conversationToUpdate = updatedConversations.find((c) => c.id === conversationId);
      if (conversationToUpdate) {
        try {
          const toStore: StoredConversation = {
            id: conversationId,
            title: newTitle,
            nodes: conversationToUpdate.nodes,
            lastModified: new Date().toISOString(),
          };
          void putConversation(toStore);
        } catch (err) {
          console.warn("Failed to persist renamed conversation:", err);
        }
      }

      return updatedConversations;
    });

    setCurrentConversation((prev) =>
      prev && prev.id === conversationId ? { ...prev, title: newTitle, lastModified: new Date() } : prev,
    );
  }, []);

  // Load conversations from IndexedDB on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Initialize default providers first
        await initializeDefaultProviders();

        const stored = await getAllConversations();
        if (!mounted) return;
        // convert back to ChatConversation shape
        const loaded: ChatConversation[] = stored
          .sort((a, b) => (a.lastModified > b.lastModified ? -1 : 1))
          .map((s) => ({
            id: s.id,
            title: s.title,
            nodes: s.nodes || [],
            lastModified: new Date(s.lastModified),
          }));

        if (loaded.length > 0) {
          setConversations(loaded);
          setCurrentConversation(loaded[0]);
        }
      } catch (err) {
        console.warn("Failed to load conversations from storage:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const selectConversation = useCallback((conversation: ChatConversation) => {
    setCurrentConversation(conversation);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex-1 flex relative">
        {!isFullscreen && (
          <ChatSidebar
            conversations={conversations}
            currentConversation={currentConversation}
            onNewConversation={createNewConversation}
            onSelectConversation={selectConversation}
            onDeleteConversation={deleteConversation}
            onRenameConversation={renameConversation}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        )}

        <div className="flex-1 relative">
          <ChatCanvas
            conversation={currentConversation}
            onUpdateConversation={updateConversation}
            onCreateNewConversation={createNewConversation}
          />

          <Button
            variant="outline"
            size="icon"
            className="absolute top-4 right-4 z-10"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
