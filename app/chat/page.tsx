"use client";

import { useState, useCallback, useEffect } from "react";
import {
  getAllConversations,
  putConversation,
  deleteConversation as deleteStoredConversation,
  getAllProviderConfigs,
  StoredConversation,
  initializeDefaultProviders,
} from "@/lib/storage";
import ChatSidebar from "./components/ChatSidebar";
import ChatCanvas from "./components/ChatCanvas";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";
import ProviderSetupDialog from "@/components/ui/provider-setup-dialog";
import { ProviderConfig } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { sidebarVariants, fadeVariants, easings } from "@/lib/animations";

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
  model?: string; // Track which model was used for AI responses
  providerId?: string; // Track which provider was used for AI responses
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
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([]);

  const fetchProviderConfigs = async () => {
    const configs = await getAllProviderConfigs();
    setProviderConfigs(configs);
    return configs;
  };

  const handleProviderConfigured = () => {
    fetchProviderConfigs();
  };

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!isFullscreen) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn("Failed to toggle fullscreen:", error);
    }
  }, [isFullscreen]);

  // Listen for fullscreen changes to update state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const createNewConversation = useCallback(
    (initialNodePosition?: { x: number; y: number }) => {
      const newConversation: ChatConversation = {
        id: `conv-${Date.now()}`,
        title: "New Conversation",
        nodes: [], // Always start with empty nodes array
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
      // Skip update if nothing meaningful changed (positions/content/title/node count)
      setCurrentConversation((prev) => {
        if (prev && prev.id === updatedConversation.id) {
          const prevNodes = prev.nodes;
          const nextNodes = updatedConversation.nodes;
          if (prevNodes.length === nextNodes.length) {
            let changed = false;
            for (let i = 0; i < prevNodes.length; i++) {
              const p = prevNodes[i];
              const n = nextNodes[i];
              if (
                p.id !== n.id ||
                p.content !== n.content ||
                p.x !== n.x ||
                p.y !== n.y ||
                p.childIds.length !== n.childIds.length
              ) {
                changed = true;
                break;
              }
            }
            if (!changed && prev.title === updatedConversation.title) {
              return prev; // no meaningful change
            }
          }
        }
        return updatedConversation;
      });

      setConversations((prev) => {
        let modified = false;
        let shouldMoveToTop = false;

        // Check if this is a new message being added (increase in node count)
        const existingConv = prev.find(conv => conv.id === updatedConversation.id);
        if (existingConv && updatedConversation.nodes.length > existingConv.nodes.length) {
          shouldMoveToTop = true;
        }

        const next = prev.map((conv) => {
          if (conv.id === updatedConversation.id) {
            // Shallow compare to avoid unnecessary array recreation
            const sameRef = conv === updatedConversation;
            if (sameRef) return conv;
            modified = true;
            return { ...updatedConversation, lastModified: new Date() };
          }
          return conv;
        });

        if (modified && shouldMoveToTop) {
          // Move the updated conversation to the top of the list
          const updatedConv = next.find(conv => conv.id === updatedConversation.id);
          if (updatedConv) {
            return [updatedConv, ...next.filter(conv => conv.id !== updatedConversation.id)];
          }
        }

        return modified ? next : prev;
      });
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

        const configs = await fetchProviderConfigs();
        // Show setup dialog if no providers are configured
        if (configs.length === 0) {
          setIsSetupDialogOpen(true);
        }

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
    <motion.div
      className="h-screen flex flex-col overflow-hidden"
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={easings.smooth}
    >
      <div className="flex-1 flex relative">
        <AnimatePresence>
          {!isFullscreen && (
            <motion.div
              variants={sidebarVariants}
              initial="closed"
              animate="open"
              exit="closed"
              transition={easings.smooth}
            >
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
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="flex-1 relative"
          layout
          transition={easings.smooth}
        >
          <ChatCanvas
            conversation={currentConversation}
            onUpdateConversation={updateConversation}
            onCreateNewConversation={createNewConversation}
          />

          <motion.div
            className="absolute top-4 right-4 z-10"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={easings.fast}
          >
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFullscreen}
            >
              <AnimatePresence mode="wait">
                {isFullscreen ? (
                  <motion.div
                    key="minimize"
                    initial={{ rotate: 180, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    exit={{ rotate: -180, scale: 0 }}
                    transition={easings.spring}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="maximize"
                    initial={{ rotate: -180, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    exit={{ rotate: 180, scale: 0 }}
                    transition={easings.spring}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </motion.div>
        </motion.div>
      </div>
      <ProviderSetupDialog
        isOpen={isSetupDialogOpen}
        onClose={() => setIsSetupDialogOpen(false)}
        onProviderConfigured={handleProviderConfigured}
      />
    </motion.div>
  );
}
