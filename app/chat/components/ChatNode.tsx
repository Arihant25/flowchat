"use client";

import { useState, useRef, useEffect } from "react";
import { ChatNode } from "../page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, X, GitBranch, Send, Copy, Check } from "lucide-react";
import ProviderModelSelector from "@/components/ui/provider-model-selector";
import ThinkingIndicator from "@/components/ui/thinking-indicator";
import MarkdownRenderer from "@/components/ui/markdown-renderer";
import { getUserPreferences, saveLastUsedProviderAndModel, getLastUsedProviderAndModel, getAllProviderConfigs } from "@/lib/storage";
import { ChatMessage, StreamingResponse, ProviderConfig } from "@/lib/types";
import { getModelBorderColor, USER_NODE_BORDER, DEFAULT_AI_NODE_BORDER } from "@/lib/utils";
import { streamChatCompletionClient, shouldUseClientSideStreaming } from "@/lib/client-ai-providers";

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
  getNodeById: (id: string) => ChatNode | undefined;
  isMarkedForDeletion?: boolean;
  deletionDepth?: number;
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
  getNodeById,
  isMarkedForDeletion = false,
  deletionDepth = 0,
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
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Use refs to store initial values and prevent re-renders
  const initialNodeRef = useRef(node);
  const propsRef = useRef({ onUpdateNode, onDeleteNode, onAddChild, onBranch, onTextSelection, onMoveNode, onNodeClick });

  // Dragging state for D3-style interactions
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Update refs when props change but don't cause re-renders
  useEffect(() => {
    initialNodeRef.current = node;
  }, [node]);

  // Update local state when node changes
  useEffect(() => {
    setLocalContent(node.content);
    setIsLocalEditing(node.isEditing ?? false);
  }, [node.content, node.isEditing]);

  // Handle cascading deletion animation
  useEffect(() => {
    if (isMarkedForDeletion && !isDeleting) {
      // Start deletion animation with delay based on depth
      const delay = deletionDepth * 80; // Match the stagger delay from ChatCanvas

      setTimeout(() => {
        setIsDeleting(true);
      }, delay);
    }
  }, [isMarkedForDeletion, isDeleting, deletionDepth]);

  propsRef.current = { onUpdateNode, onDeleteNode, onAddChild, onBranch, onTextSelection, onMoveNode, onNodeClick };

  // Get user preferences for color coding
  const userPreferences = getUserPreferences();
  const colorCodeNodes = userPreferences.colorCodeNodes;

  // Determine node border color based on preferences and model
  const getNodeBorderColor = () => {
    if (node.isUser) {
      return USER_NODE_BORDER;
    } else {
      // AI node
      if (colorCodeNodes && node.model) {
        return getModelBorderColor(node.model);
      } else {
        return DEFAULT_AI_NODE_BORDER;
      }
    }
  };

  const nodeBorderColor = getNodeBorderColor();

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
      // Fetch currently configured provider configs to support single-provider auto selection
      const providerConfigs = await getAllProviderConfigs();

      // For new nodes (editing), prefer last used settings, fall back to default
      if (node.isEditing) {
        if (providerConfigs.length === 1) {
          // Always choose the single configured provider, ignoring stale last-used/default
          const only = providerConfigs[0];
          setSelectedProviderId(only.id);
          // Model will auto-select via ProviderModelSelector once models load (if defaultModel exists)
        } else if (lastUsed.providerId && lastUsed.model) {
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
    const history: ChatMessage[] = [];
    const allNodes: ChatNode[] = [];

    // First, collect all nodes in the conversation path from current node back to root
    let currentNode: ChatNode | undefined = node;
    while (currentNode) {
      allNodes.push(currentNode);
      currentNode = currentNode.parentId ? getNodeById(currentNode.parentId) : undefined;
    }

    // Reverse to get root-to-current order
    allNodes.reverse();

    // Convert the path to messages, excluding the current node (last one) since it will be added separately
    // Only include nodes that have content
    for (let i = 0; i < allNodes.length - 1; i++) {
      const pathNode = allNodes[i];
      if (pathNode.content.trim()) {
        const message: ChatMessage = {
          role: pathNode.isUser ? 'user' : 'assistant',
          content: pathNode.content,
        };
        history.push(message);
      }
    }

    return history;
  };

  const calculateCardHeight = (): number => {
    let cardHeight = 200; // Increased default fallback height

    if (cardRef.current) {
      // Force layout calculation by accessing offsetHeight
      const actualHeight = cardRef.current.offsetHeight;
      if (actualHeight > 0) {
        // Use the actual rendered height
        cardHeight = actualHeight;
      }
    }

    return cardHeight;
  };

  const handleSubmit = async () => {
    if (!localContent.trim() || !selectedProviderId || !selectedModel) return;

    setIsLoading(true);
    setStreamingResponse(null);
    setIsLocalEditing(false);

    // Update the parent state only once at the end
    propsRef.current.onUpdateNode(node.id, {
      content: localContent,
      isEditing: false
    });

    // Create AI response node immediately before starting the stream
    const aiResponseId = `node-${Date.now()}-ai`;
    const aiResponse: ChatNode = {
      id: aiResponseId,
      content: "", // Start empty, will be updated during streaming
      isUser: false,
      x: node.x, // Position will be calculated by canvas
      y: node.y, // Position will be calculated by canvas
      parentId: node.id,
      childIds: [],
      model: selectedModel, // Store the model used for this response
      providerId: selectedProviderId, // Store the provider used for this response
    };

    // Add the AI response node immediately (canvas will calculate optimal position)
    propsRef.current.onAddChild(node.id, node.x, node.y, aiResponse);

    try {
      const preferences = getUserPreferences();

      // Get the full provider configuration from client-side storage (includes API key)
      const providerConfigs = await getAllProviderConfigs();
      const providerConfig = providerConfigs.find(c => c.id === selectedProviderId);

      if (!providerConfig) {
        throw new Error("Provider configuration not found");
      }

      // Build conversation history
      const conversationHistory = buildConversationHistory();

      // Check if we should use client-side streaming (for local providers)
      const useClientSide = shouldUseClientSideStreaming(providerConfig.provider);

      let aiContent = "";
      let thinking = "";
      let thinkingTime = 0;

      if (useClientSide) {
        // Client-side streaming for local providers (LM Studio, Ollama)
        try {
          for await (const chunk of streamChatCompletionClient(
            [...conversationHistory, { role: "user", content: localContent }],
            selectedModel,
            providerConfig,
            preferences.temperature || 0.7
          )) {
            if (chunk.content) {
              aiContent = chunk.content;
            }
            if (chunk.thinking) {
              thinking = chunk.thinking;
            }
            if (chunk.thinkingTime) {
              thinkingTime = chunk.thinkingTime;
            }

            // Update the AI response node with the streaming content
            propsRef.current.onUpdateNode(aiResponseId, {
              content: aiContent,
              thinking: thinking || undefined,
              thinkingTime: thinkingTime || undefined,
            });

            if (chunk.isComplete) {
              if (chunk.error) {
                throw new Error(chunk.error);
              }
              // Save the successfully used provider and model for future use
              saveLastUsedProviderAndModel(selectedProviderId, selectedModel);
              break;
            }
          }
        } catch (clientError) {
          throw clientError;
        }
      } else {
        // Server-side streaming for cloud providers (OpenAI, Anthropic, Google)
        const requestBody = {
          message: localContent,
          conversationHistory: conversationHistory,
          provider: selectedProviderId.split('_')[0], // Extract provider type from ID
          model: selectedModel,
          providerId: selectedProviderId,
          temperature: preferences.temperature || 0.7,
          systemPrompt: preferences.systemPrompt || "",
          providerConfig: providerConfig, // Send the full config including API key
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

                  if (parsed.content) {
                    aiContent = parsed.content;
                  }
                  if (parsed.thinking) {
                    thinking = parsed.thinking;
                  }
                  if (parsed.thinkingTime) {
                    thinkingTime = parsed.thinkingTime;
                  }

                  // Update the AI response node with the streaming content
                  propsRef.current.onUpdateNode(aiResponseId, {
                    content: aiContent,
                    thinking: thinking || undefined,
                    thinkingTime: thinkingTime || undefined,
                  });

                  if (parsed.isComplete) {
                    // Save the successfully used provider and model for future use
                    saveLastUsedProviderAndModel(selectedProviderId, selectedModel);
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
      }
    } catch (error) {
      console.error("Failed to get AI response:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      // Update the AI response node with error content
      propsRef.current.onUpdateNode(aiResponseId, {
        content: `Error: ${errorMessage}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    const shouldSkipConfirm = localStorage.getItem("skipDeleteConfirm") === "true";

    if (shouldSkipConfirm) {
      // Start the deletion animation
      setIsDeleting(true);
      // After animation completes, actually delete the node
      setTimeout(() => {
        propsRef.current.onDeleteNode(node.id);
      }, 400); // Match animation duration
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = () => {
    if (dontAskAgain) {
      localStorage.setItem("skipDeleteConfirm", "true");
    }
    setShowDeleteConfirm(false);
    // Start the deletion animation
    setIsDeleting(true);
    // After animation completes, actually delete the node
    setTimeout(() => {
      propsRef.current.onDeleteNode(node.id);
    }, 400); // Match animation duration
  };

  const handleAddChild = () => {
    // Let the parent canvas calculate the optimal position
    propsRef.current.onAddChild(node.id, node.x, node.y);
  };

  const handleTextSelect = (e: React.MouseEvent) => {
    if (node.isUser) return; // only AI nodes
    e.stopPropagation();

    // Use a small delay to ensure the browser has finalized the selection
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim() && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        propsRef.current.onTextSelection(node.id, selection.toString(), rect.left, rect.top);
      }
    }, 50);
  };

  // D3-style drag handling with improved momentum
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start dragging if clicking outside selectable text/content and interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('textarea') ||
      target.closest('select') ||
      target.closest('[data-interactive="true"]') ||
      target.closest('[data-selectable-content="true"]') // allow text selection
    ) {
      return; // do not initiate drag
    }

    setIsDragging(true);
    setDragStart({
      x: e.clientX / zoom,
      y: e.clientY / zoom,
    });
    setDragOffset({ x: 0, y: 0 });
    e.preventDefault();
    e.stopPropagation();
  };

  // Global mouse events for dragging (similar to D3 drag behavior)
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Calculate offset from the initial drag start position, accounting for zoom
      const newOffset = {
        x: (e.clientX / zoom) - dragStart.x,
        y: (e.clientY / zoom) - dragStart.y
      };
      setDragOffset(newOffset);
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        const newX = node.x + dragOffset.x;
        const newY = node.y + dragOffset.y;
        propsRef.current.onMoveNode(node.id, newX, newY);
        setDragOffset({ x: 0, y: 0 });
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart, dragOffset, node.x, node.y, node.id, zoom]);

  return (
    <>
      <div
        data-node="true"
        className="absolute"
        style={{
          left: node.x + dragOffset.x,
          top: node.y + dragOffset.y,
          transform: `scale(${Math.max(0.5, Math.min(1, 1 / zoom))})`,
          transformOrigin: "top left",
          zIndex: isDragging ? 1000 : 20,
        }}
      >
        <Card
          ref={cardRef}
          className={`chat-node-card min-w-[32rem] max-w-[48rem] transition-all duration-200 border-2 ${nodeBorderColor} ${isHovered ? "shadow-lg" : "shadow-md"} ${isDragging ? "shadow-2xl ring-2 ring-blue-400 ring-opacity-50 scale-95" : ""} cursor-grab active:cursor-grabbing`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onMouseDown={handleMouseDown}
          style={{
            animation: isDeleting ? "pop-out 0.3s ease-in-out forwards" : undefined,
          }}
        >
          <CardContent className="p-4 relative">
            {isHovered && (
              <div className="absolute -top-2 right-2 flex gap-1 z-10">
                <Button
                  size="icon"
                  variant="outline"
                  className="w-8 h-8 bg-background/90 backdrop-blur-sm"
                  onClick={async (e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    try {
                      await navigator.clipboard.writeText(node.content || "");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch (err) {
                      console.warn('Copy failed', err);
                    }
                  }}
                  title="Copy content"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
                {node.isUser && (
                  <Button
                    size="icon"
                    variant="outline"
                    className="w-8 h-8 bg-background/90 backdrop-blur-sm"
                    onClick={() => propsRef.current.onBranch(node.id)}
                    title="Branch conversation"
                  >
                    <GitBranch className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="outline"
                  className="w-8 h-8 bg-background/90 backdrop-blur-sm"
                  onClick={handleDelete}
                  title="Delete node"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div className="text-xs mb-2 text-muted-foreground">
              {node.isUser ? "You" : `${colorCodeNodes && node.model ? ` ${node.model}` : ""}`}
            </div>

            {!node.isUser && node.thinking && (
              <ThinkingIndicator
                thinking={node.thinking}
                thinkingTime={node.thinkingTime}
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
              <div className="space-y-3">
                <Textarea
                  ref={textareaRef}
                  value={localContent}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setLocalContent(e.target.value)}
                  onBlur={() => {
                    // Only sync content when losing focus if content changed
                    if (localContent !== node.content) {
                      propsRef.current.onUpdateNode(node.id, { content: localContent });
                    }
                  }}
                  placeholder="Type your message..."
                  className="min-h-20 resize-none"
                  onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                    // Ctrl+Enter or Shift+Enter will create a new line (default behavior)
                  }}
                />

                {/* Provider and Model Selection with Send Button */}
                <div className="flex items-center gap-3">
                  <ProviderModelSelector
                    selectedProviderId={selectedProviderId}
                    selectedModel={selectedModel}
                    onProviderChange={setSelectedProviderId}
                    onModelChange={setSelectedModel}
                    className="flex-1"
                    autoSelectDefault={false}
                    preserveModelOnProviderChange={true}
                  />
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!localContent.trim() || !selectedProviderId || !selectedModel || isLoading}
                    className="shrink-0"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    {isLoading ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            ) : (
              <div
                ref={contentRef}
                className="select-text cursor-text"
                data-selectable-content="true"
                onMouseUp={handleTextSelect}
              >
                <MarkdownRenderer
                  content={localContent || ""}
                  className="min-h-0"
                />
                {/* Show streaming cursor for AI nodes with empty content (likely streaming) */}
                {!node.isUser && !localContent.trim() && (
                  <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
                )}
              </div>
            )}

            {isHovered && !isLocalEditing && !node.isUser && (
              <Button
                size="sm"
                variant="ghost"
                className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-10 h-10 p-0"
                onClick={handleAddChild}
                title="Add follow-up message"
              >
                <Plus className="w-5 h-5" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Node</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this node and all its children? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-4">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
