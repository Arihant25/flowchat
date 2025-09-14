"use client";

import { useState } from "react";
import { ChatConversation } from "../page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Settings,
  Menu,
  Trash2,
  Edit3,
  Check,
  X
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { staggerContainer, staggerItem, hoverVariants, easings } from "@/lib/animations";

interface ChatSidebarProps {
  conversations: ChatConversation[];
  currentConversation: ChatConversation | null;
  onNewConversation: () => void;
  onSelectConversation: (conversation: ChatConversation) => void;
  onDeleteConversation: (conversationId: string) => void;
  onRenameConversation?: (conversationId: string, newTitle: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function ChatSidebar({
  conversations,
  currentConversation,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  collapsed,
  onToggleCollapse,
}: ChatSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const startEditing = (conversation: ChatConversation) => {
    setEditingId(conversation.id);
    setEditingTitle(conversation.title);
  };

  const saveEdit = () => {
    if (editingId && editingTitle.trim()) {
      // Inform parent to update the conversation title
      if (typeof onRenameConversation === "function") {
        onRenameConversation(editingId, editingTitle.trim());
      }
    }
    setEditingId(null);
    setEditingTitle("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getConversationPreview = (conversation: ChatConversation) => {
    const firstUserMessage = conversation.nodes.find(node => node.isUser && node.content.trim());
    if (!firstUserMessage) return "New Conversation";
    const content = firstUserMessage.content || "";
    return content.substring(0, 60) + (content.length > 60 ? "..." : "");
  };

  return (
    <motion.div
      className={`bg-background border-r transition-all duration-300 flex flex-col h-screen overflow-x-hidden ${collapsed ? "w-16" : "w-80"
        } group hover:w-80`}
      onMouseEnter={() => !collapsed && undefined}
      layout
      transition={easings.smooth}
    >
      {/* Header */}
      <motion.div
        className="p-4 border-b flex items-center justify-between flex-shrink-0"
        layout
      >
        <motion.div
          whileHover={hoverVariants.scale.hover}
          whileTap={{ scale: 0.9 }}
          transition={easings.fast}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="flex-shrink-0"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </motion.div>

        {/* New Chat button - only show when not collapsed or on hover when collapsed */}
        {!collapsed && (
          <motion.div
            whileHover={hoverVariants.scale.hover}
            whileTap={{ scale: 0.95 }}
            transition={easings.fast}
          >
            <Button
              onClick={onNewConversation}
              className="flex items-center gap-2"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              <span className="whitespace-nowrap">New Chat</span>
            </Button>
          </motion.div>
        )}

        {/* Show on hover when collapsed */}
        {collapsed && (
          <div className="hidden group-hover:block">
            <motion.div
              whileHover={hoverVariants.scale.hover}
              whileTap={{ scale: 0.95 }}
              transition={easings.fast}
            >
              <Button
                onClick={onNewConversation}
                className="flex items-center gap-2"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                <span className="whitespace-nowrap">New Chat</span>
              </Button>
            </motion.div>
          </div>
        )}
      </motion.div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 max-h-full">
        <motion.div
          className="p-2 space-y-1 h-full overflow-x-hidden"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence>
            {conversations.map((conversation, index) => (
              <motion.div
                key={conversation.id}
                variants={staggerItem}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
                transition={easings.spring}
                custom={index}
              >
                <motion.div
                  whileHover={hoverVariants.lift.hover}
                  whileTap={{ scale: 0.98 }}
                  transition={easings.fast}
                >
                  <Card
                    className={`cursor-pointer transition-colors hover:bg-accent ${currentConversation?.id === conversation.id ? "bg-accent" : ""
                      } ${collapsed ? "group-hover:block" : "block"}`}
                    onClick={() => !editingId && onSelectConversation(conversation)}
                  >
                    <CardContent className="p-3">
                      <div className={`transition-all duration-300 ${collapsed ? "hidden group-hover:block" : "block"
                        }`}>
                        {editingId === conversation.id ? (
                          <div className="space-y-2">
                            <Input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit();
                                if (e.key === "Escape") cancelEdit();
                              }}
                              className="text-sm"
                              autoFocus
                            />
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={saveEdit} className="h-6 w-6">
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-6 w-6">
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between group/item">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate mb-1">
                                  {conversation.title}
                                </h4>
                                <p className="text-xs text-muted-foreground truncate mb-2">
                                  {getConversationPreview(conversation)}
                                </p>
                                <div className="text-xs text-muted-foreground">
                                  {formatDate(conversation.lastModified)}
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                <motion.div
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditing(conversation);
                                    }}
                                    className="h-6 w-6"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </Button>
                                </motion.div>
                                <motion.div
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteConversation(conversation.id);
                                    }}
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </motion.div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Collapsed view - just show a dot for each conversation */}
                      <div className={`${collapsed ? "block group-hover:hidden" : "hidden"}`}>
                        <div className={`w-2 h-2 rounded-full mx-auto ${currentConversation?.id === conversation.id ? "bg-primary" : "bg-muted-foreground"
                          }`} />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        className="p-4 border-t flex-shrink-0"
        layout
      >
        {/* Expanded state */}
        {!collapsed && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            transition={easings.smooth}
          >
            <motion.div
              whileHover={hoverVariants.lift.hover}
              transition={easings.fast}
            >
              <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                <Link href="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        )}

        {/* Collapsed state */}
        {collapsed && (
          <>
            {/* Show full button on hover */}
            <div className="hidden group-hover:block w-full">
              <motion.div
                whileHover={hoverVariants.lift.hover}
                transition={easings.fast}
              >
                <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </Button>
              </motion.div>
            </div>

            {/* Show icon only when not hovering */}
            <div className="block group-hover:hidden w-full">
              <Button asChild variant="ghost" size="icon" className="w-full">
                <Link href="/settings">
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
