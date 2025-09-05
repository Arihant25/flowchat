"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ChatNode } from "../page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, GitBranch, Send } from "lucide-react";
import ProviderModelSelector from "@/components/ui/provider-model-selector";
import ThinkingIndicator from "@/components/ui/thinking-indicator";
import { getUserPreferences, saveLastUsedProviderAndModel, getLastUsedProviderAndModel } from "@/lib/storage";
import { ChatMessage, StreamingResponse } from "@/lib/types";

interface ChatNodeComponentProps {
  node: ChatNode;
  onUpdateNode: (nodeId: string, updates: Partial<ChatNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddChild: (parentId: string, x: number, y: number, aiResponse?: ChatNode) => void;
  onBranch: (nodeId: string) => void;
  onTextSelection: (nodeId: string, text: string, x: number, y: number) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
  zoom: number;
}

export default function ChatNodeComponent({
  node,
  onUpdateNode,
  onDeleteNode,
  onAddChild,
  onBranch,
  onTextSelection,
  onMoveNode,
  onNodeClick,
  zoom,
}: ChatNodeComponentProps) {
  const [localContent, setLocalContent] = useState(node.content);
  const [isLocalEditing, setIsLocalEditing] = useState(node.isEditing);
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [streamingResponse, setStreamingResponse] = useState<StreamingResponse | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Use refs to store initial values and prevent re-renders
  const initialNodeRef = useRef(node);
  const propsRef = useRef({ onUpdateNode, onDeleteNode, onAddChild, onBranch, onTextSelection, onMoveNode, onNodeClick });

  // Update refs when props change but don't cause re-renders
  propsRef.current = { onUpdateNode, onDeleteNode, onAddChild, onBranch, onTextSelection, onMoveNode, onNodeClick };

  useEffect(() => {
    if (isLocalEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLocalEditing]);

  useEffect(() => {
    // Load user preferences for default provider/model and last used settings
    const loadDefaults = async () => {
      // Only run once per component instance
      if (hasInitialized) {
        return;
      }

      const preferences = getUserPreferences();
      const lastUsed = getLastUsedProviderAndModel();

      // For new nodes (editing), prefer last used settings, fall back to default
      if (node.isEditing) {
        if (lastUsed.providerId && lastUsed.model) {
          setSelectedProviderId(lastUsed.providerId);
          setSelectedModel(lastUsed.model);
        } else if (preferences.defaultProvider) {
          setSelectedProviderId(preferences.defaultProvider);
        }
      } else if (preferences.defaultProvider) {
        // For existing nodes, just load default if nothing selected
        setSelectedProviderId(preferences.defaultProvider);
      }

      setHasInitialized(true);
    };
    loadDefaults();
  }, []); // Run only on mount

  const buildConversationHistory = (): ChatMessage[] => {
    // This would need to be implemented to build the actual conversation history
    // For now, we'll return an empty array
    // TODO: Build proper conversation history from the node tree
    return [];
  };

  const handleSubmit = async () => {
    if (!localContent.trim() || !selectedProviderId || !selectedModel) return;

    setIsLoading(true);
    setStreamingResponse(null);
    setIsLocalEditing(false);

    // Update the parent state only once at the end
    propsRef.current.onUpdateNode(initialNodeRef.current.id, {
      content: localContent,
      isEditing: false
    });

    try {
      const preferences = getUserPreferences();
      const requestBody = {
        message: localContent,
        conversationHistory: buildConversationHistory(),
        provider: selectedProviderId.split('_')[0], // Extract provider type from ID
        model: selectedModel,
        providerId: selectedProviderId,
        temperature: preferences.temperature || 0.7,
        systemPrompt: preferences.systemPrompt || "",
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      let aiContent = "";
      let thinking = "";
      let thinkingTime = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split("\n").filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed: StreamingResponse = JSON.parse(data);
                setStreamingResponse(parsed);

                if (parsed.content) {
                  aiContent = parsed.content;
                }
                if (parsed.thinking) {
                  thinking = parsed.thinking;
                }
                if (parsed.thinkingTime) {
                  thinkingTime = parsed.thinkingTime;
                }

                if (parsed.isComplete) {
                  // Save the successfully used provider and model for future use
                  saveLastUsedProviderAndModel(selectedProviderId, selectedModel);

                  // Create AI response node
                  const aiResponse: ChatNode = {
                    id: `node-${Date.now()}-ai`,
                    content: aiContent,
                    thinking: thinking || undefined,
                    thinkingTime: thinkingTime || undefined,
                    isUser: false,
                    x: initialNodeRef.current.x,
                    y: initialNodeRef.current.y + 200,
                    parentId: initialNodeRef.current.id,
                    childIds: [],
                  };

                  // Add the AI response as a child
                  propsRef.current.onAddChild(initialNodeRef.current.id, initialNodeRef.current.x, initialNodeRef.current.y + 200, aiResponse);
                  setStreamingResponse(null);
                  break;
                }
              } catch (e) {
                // Ignore JSON parse errors for partial chunks
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error("Failed to get AI response:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      // Create error response node
      const errorResponse: ChatNode = {
        id: `node-${Date.now()}-error`,
        content: `Error: ${errorMessage}`,
        isUser: false,
        x: initialNodeRef.current.x,
        y: initialNodeRef.current.y + 200,
        parentId: initialNodeRef.current.id,
        childIds: [],
      };

      propsRef.current.onAddChild(initialNodeRef.current.id, initialNodeRef.current.x, initialNodeRef.current.y + 200, errorResponse);
    } finally {
      setIsLoading(false);
      setStreamingResponse(null);
    }
  };

  const handleDelete = () => {
    const shouldSkipConfirm = localStorage.getItem("skipDeleteConfirm") === "true";

    if (shouldSkipConfirm) {
      propsRef.current.onDeleteNode(initialNodeRef.current.id);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = () => {
    if (dontAskAgain) {
      localStorage.setItem("skipDeleteConfirm", "true");
    }
    propsRef.current.onDeleteNode(initialNodeRef.current.id);
    setShowDeleteConfirm(false);
  };

  const handleAddChild = () => {
    propsRef.current.onAddChild(initialNodeRef.current.id, initialNodeRef.current.x, initialNodeRef.current.y + 150);
  };

  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      propsRef.current.onTextSelection(initialNodeRef.current.id, selection.toString(), rect.right, rect.top);
    }
  };

  return (
    <>
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.1}
        dragConstraints={false}
        onDragEnd={(event, info) => {
          const newX = initialNodeRef.current.x + info.offset.x;
          const newY = initialNodeRef.current.y + info.offset.y;
          propsRef.current.onMoveNode(initialNodeRef.current.id, newX, newY);
        }}
        initial={{ x: 0, y: 0 }}
        animate={{ x: 0, y: 0 }}
        whileDrag={{
          scale: 0.95,
          rotate: 2,
          zIndex: 1000,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30
        }}
      >
        <Card
          data-node="true"
          className={`absolute min-w-80 max-w-96 transition-all duration-200 ${initialNodeRef.current.isUser ? "border-blue-200" : "border-green-200"
            } ${isHovered ? "shadow-lg scale-105" : "shadow-md"} cursor-grab z-20`}
          style={{
            left: initialNodeRef.current.x,
            top: initialNodeRef.current.y,
            transform: `scale(${Math.max(0.5, Math.min(1, 1 / zoom))})`,
            transformOrigin: "top left",
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <CardContent className="p-4 relative">
            {isHovered && (
              <div className="absolute -top-2 -right-2 flex gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="w-6 h-6"
                  onClick={() => propsRef.current.onBranch(initialNodeRef.current.id)}
                  title="Branch conversation"
                >
                  <GitBranch className="w-3 h-3" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="w-6 h-6"
                  onClick={handleDelete}
                  title="Delete node"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}

            <div className={`text-xs mb-2 ${initialNodeRef.current.isUser ? "text-blue-600" : "text-green-600"}`}>
              {initialNodeRef.current.isUser ? "You" : "AI"}
            </div>

            {!initialNodeRef.current.isUser && initialNodeRef.current.thinking && (
              <ThinkingIndicator
                thinking={initialNodeRef.current.thinking}
                thinkingTime={initialNodeRef.current.thinkingTime}
                isThinking={false}
              />
            )}

            {streamingResponse && (
              <ThinkingIndicator
                thinking={streamingResponse.thinking}
                thinkingTime={streamingResponse.thinkingTime}
                isThinking={streamingResponse.isThinking}
              />
            )}

            {isLocalEditing ? (
              <div className="space-y-2">
                <Textarea
                  ref={textareaRef}
                  value={localContent}
                  onChange={(e) => setLocalContent(e.target.value)}
                  onBlur={() => {
                    // Only sync content when losing focus if content changed
                    if (localContent !== initialNodeRef.current.content) {
                      propsRef.current.onUpdateNode(initialNodeRef.current.id, { content: localContent });
                    }
                  }}
                  placeholder="Type your message..."
                  className="min-h-20 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.ctrlKey) {
                      handleSubmit();
                    }
                  }}
                />

                {/* Provider and Model Selection */}
                <ProviderModelSelector
                  selectedProviderId={selectedProviderId}
                  selectedModel={selectedModel}
                  onProviderChange={setSelectedProviderId}
                  onModelChange={setSelectedModel}
                  className="mb-2"
                  autoSelectDefault={false}
                  preserveModelOnProviderChange={true}
                />

                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!localContent.trim() || !selectedProviderId || !selectedModel || isLoading}
                  >
                    <Send className="w-3 h-3 mr-1" />
                    {isLoading ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {streamingResponse && !streamingResponse.isComplete && (
                  <div className="mb-2">
                    <div className="text-sm text-muted-foreground mb-1">
                      {streamingResponse.isThinking ? "Thinking..." : "Responding..."}
                    </div>
                    <div className="whitespace-pre-wrap">
                      {streamingResponse.content}
                      {!streamingResponse.isThinking && (
                        <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
                      )}
                    </div>
                  </div>
                )}

                <div
                  ref={contentRef}
                  className="whitespace-pre-wrap select-text cursor-text"
                  onMouseUp={handleTextSelect}
                >
                  {localContent}
                </div>
              </>
            )}

            {isHovered && !isLocalEditing && (
              <Button
                size="sm"
                variant="ghost"
                className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 w-8 h-8 p-0"
                onClick={handleAddChild}
                title="Add follow-up message"
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Delete Node</h3>
              <p className="text-muted-foreground mb-4">
                Are you sure you want to delete this node and all its children? This action cannot be undone.
              </p>
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  id="dontAskAgain"
                  checked={dontAskAgain}
                  onChange={(e) => setDontAskAgain(e.target.checked)}
                />
                <label htmlFor="dontAskAgain" className="text-sm">
                  Don't ask me again
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={confirmDelete}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
