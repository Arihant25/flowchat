"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useDrop } from "react-dnd";
import { ChatConversation, ChatNode } from "../page";
import ChatNodeComponent from "./ChatNode";

interface ChatCanvasProps {
  conversation: ChatConversation | null;
  onUpdateConversation: (conversation: ChatConversation) => void;
  onCreateNewConversation: (initialNodePosition?: {
    x: number;
    y: number;
  }) => void;
}

export default function ChatCanvas({
  conversation,
  onUpdateConversation,
  onCreateNewConversation,
}: ChatCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState<{
    text: string;
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);

  // Use ref to avoid recreating callbacks when conversation changes
  const conversationRef = useRef<ChatConversation | null>(conversation);
  const onUpdateConversationRef = useRef(onUpdateConversation);

  // Keep refs in sync
  useEffect(() => {
    conversationRef.current = conversation;
    onUpdateConversationRef.current = onUpdateConversation;
  }, [conversation, onUpdateConversation]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current && !isPanning) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;

        const newNode: ChatNode = {
          id: `node-${Date.now()}`,
          content: "",
          isUser: true,
          x,
          y,
          childIds: [],
          isEditing: true,
        };

        if (!conversation) {
          // Call the parent's createNewConversation with initial node position
          onCreateNewConversation({ x, y });
          return;
        }

        const updatedConversation: ChatConversation = {
          ...conversation,
          nodes: [...conversation.nodes, newNode],
        };

        onUpdateConversation(updatedConversation);
      }
    },
    [
      conversation,
      onUpdateConversation,
      onCreateNewConversation,
      isPanning,
      pan,
      zoom,
    ],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const deltaX = e.clientX - lastPanPoint.x;
        const deltaY = e.clientY - lastPanPoint.y;
        setPan((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
        setLastPanPoint({ x: e.clientX, y: e.clientY });
      }
    },
    [isPanning, lastPanPoint],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(0.1, Math.min(3, prev * delta)));
  }, []);

  const updateNode = useCallback(
    (nodeId: string, updates: Partial<ChatNode>) => {
      const currentConversation = conversationRef.current;
      if (!currentConversation) return;

      const updatedNodes = currentConversation.nodes.map((node) =>
        node.id === nodeId ? { ...node, ...updates } : node,
      );

      onUpdateConversationRef.current({
        ...currentConversation,
        nodes: updatedNodes,
      });
    },
    [], // No dependencies - uses refs
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      const currentConversation = conversationRef.current;
      if (!currentConversation) return;

      const nodeToDelete = currentConversation.nodes.find((n) => n.id === nodeId);
      if (!nodeToDelete) return;

      const nodesToDelete = new Set<string>();

      const collectChildNodes = (id: string) => {
        nodesToDelete.add(id);
        const node = currentConversation.nodes.find((n) => n.id === id);
        if (node) {
          node.childIds.forEach((childId) => collectChildNodes(childId));
        }
      };

      collectChildNodes(nodeId);

      const updatedNodes = currentConversation.nodes
        .filter((node) => !nodesToDelete.has(node.id))
        .map((node) => ({
          ...node,
          childIds: node.childIds.filter(
            (childId) => !nodesToDelete.has(childId),
          ),
        }));

      if (nodeToDelete.parentId) {
        const parentIndex = updatedNodes.findIndex(
          (n) => n.id === nodeToDelete.parentId,
        );
        if (parentIndex !== -1) {
          updatedNodes[parentIndex] = {
            ...updatedNodes[parentIndex],
            childIds: updatedNodes[parentIndex].childIds.filter(
              (id) => id !== nodeId,
            ),
          };
        }
      }

      onUpdateConversationRef.current({
        ...currentConversation,
        nodes: updatedNodes,
      });
    },
    [], // No dependencies - uses refs
  );

  const addChildNode = useCallback(
    (parentId: string, x: number, y: number, aiResponse?: ChatNode) => {
      const currentConversation = conversationRef.current;
      if (!currentConversation) return;

      if (aiResponse) {
        // Add the provided AI response node
        const updatedNodes = currentConversation.nodes.map((node) =>
          node.id === parentId
            ? { ...node, childIds: [...node.childIds, aiResponse.id] }
            : node,
        );

        onUpdateConversationRef.current({
          ...currentConversation,
          nodes: [...updatedNodes, aiResponse],
        });
      } else {
        // Create a new user input node
        const newNode: ChatNode = {
          id: `node-${Date.now()}`,
          content: "",
          isUser: true,
          x,
          y,
          parentId,
          childIds: [],
          isEditing: true,
        };

        const updatedNodes = currentConversation.nodes.map((node) =>
          node.id === parentId
            ? { ...node, childIds: [...node.childIds, newNode.id] }
            : node,
        );

        onUpdateConversationRef.current({
          ...currentConversation,
          nodes: [...updatedNodes, newNode],
        });
      }
    },
    [], // No dependencies - uses refs
  );

  const branchNode = useCallback(
    (nodeId: string) => {
      const currentConversation = conversationRef.current;
      if (!currentConversation) return;

      const nodeIndex = currentConversation.nodes.findIndex((n) => n.id === nodeId);
      if (nodeIndex === -1) return;

      const originalNode = currentConversation.nodes[nodeIndex];
      const conversationHistory: ChatNode[] = [];

      let currentNode: ChatNode | undefined = originalNode;
      while (currentNode) {
        conversationHistory.unshift(currentNode);
        currentNode = currentNode.parentId
          ? currentConversation.nodes.find((n) => n.id === currentNode!.parentId)
          : undefined;
      }

      const newNodes: ChatNode[] = [];
      let previousNewNode: ChatNode | null = null;

      conversationHistory.forEach((node, index) => {
        const newNode: ChatNode = {
          id: `node-${Date.now()}-${index}`,
          content: node.content,
          isUser: node.isUser,
          x: node.x + 300,
          y: node.y,
          parentId: previousNewNode?.id,
          childIds: [],
          isEditing: index === conversationHistory.length - 1,
        };

        if (previousNewNode) {
          previousNewNode.childIds.push(newNode.id);
        }

        newNodes.push(newNode);
        previousNewNode = newNode;
      });

      onUpdateConversationRef.current({
        ...currentConversation,
        nodes: [...currentConversation.nodes, ...newNodes],
      });
    },
    [], // No dependencies - uses refs
  );

  const handleTextSelection = useCallback(
    (nodeId: string, text: string, x: number, y: number) => {
      if (text.trim()) {
        setSelectedText({ text, nodeId, x, y });
      }
    },
    [],
  );

  const moveNode = useCallback(
    (nodeId: string, x: number, y: number) => {
      const currentConversation = conversationRef.current;
      if (!currentConversation) return;

      console.log('Moving node:', { nodeId, x, y });

      const updatedNodes = currentConversation.nodes.map((node) =>
        node.id === nodeId ? { ...node, x, y } : node,
      );

      console.log('Updated nodes:', updatedNodes.find(n => n.id === nodeId));

      onUpdateConversationRef.current({
        ...currentConversation,
        nodes: updatedNodes,
      });
    },
    [], // No dependencies - uses refs
  );

  const handleNodeClick = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      // Connection mode functionality removed
    },
    [],
  );

  const handleReplyToSelection = useCallback(() => {
    if (!selectedText) return;

    addChildNode(selectedText.nodeId, selectedText.x + 200, selectedText.y);
    setSelectedText(null);
  }, [selectedText, addChildNode]);

  useEffect(() => {
    const handleGlobalClick = () => setSelectedText(null);
    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, []);

  const dotPattern = `radial-gradient(circle, rgba(156, 163, 175, 0.3) 1px, transparent 1px)`;
  const dotSize = 20 * zoom;

  // Canvas drop target component
  const CanvasDropTarget = useCallback(({ children }: { children: React.ReactNode }) => {
    const [{ isOver }, drop] = useDrop({
      accept: "node",
      drop: (item: { id: string; x: number; y: number }, monitor) => {
        const clientOffset = monitor.getClientOffset();
        const canvasElement = canvasRef.current;
        
        if (clientOffset && canvasElement) {
          const rect = canvasElement.getBoundingClientRect();
          
          // Calculate position relative to the canvas, accounting for pan and zoom
          const newX = (clientOffset.x - rect.left - pan.x) / zoom;
          const newY = (clientOffset.y - rect.top - pan.y) / zoom;
          
          console.log('Drop position:', { newX, newY, clientOffset, pan, zoom });
          moveNode(item.id, newX, newY);
        }
        
        return { dropped: true };
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    });

    const dropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (dropRef.current) {
        drop(dropRef.current);
      }
    }, [drop]);

    return (
      <div
        ref={dropRef}
        data-canvas="true"
        className={`w-full h-full overflow-hidden cursor-grab active:cursor-grabbing relative ${isOver ? "bg-blue-50/20" : ""
          }`}
        style={{
          backgroundImage: dotPattern,
          backgroundSize: `${dotSize}px ${dotSize}px`,
          backgroundPosition: `${pan.x % dotSize}px ${pan.y % dotSize}px`,
        }}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        {children}
      </div>
    );
  }, [pan, zoom, moveNode, dotPattern, dotSize, handleCanvasClick, handleMouseDown, handleMouseMove, handleMouseUp, handleWheel]);

  return (
    <DndProvider backend={HTML5Backend}>
      <CanvasDropTarget>
        <div
          ref={canvasRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
          className="absolute inset-0"
        >
          {!conversation || conversation.nodes.length === 0 ? (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-muted-foreground text-xl pointer-events-none">
              Click anywhere to start chatting!
            </div>
          ) : (
            <>
              {conversation.nodes.map((node) => (
                <ChatNodeComponent
                  key={node.id}
                  node={node}
                  onUpdateNode={updateNode}
                  onDeleteNode={deleteNode}
                  onAddChild={addChildNode}
                  onBranch={branchNode}
                  onTextSelection={handleTextSelection}
                  onMoveNode={moveNode}
                  onNodeClick={handleNodeClick}
                  zoom={zoom}
                />
              ))}

              {conversation.nodes.map((node) =>
                node.childIds.map((childId) => {
                  const childNode = conversation.nodes.find(
                    (n) => n.id === childId,
                  );
                  if (!childNode) return null;

                  const isHighlighted = false;

                  return (
                    <svg
                      key={`edge-${node.id}-${childId}`}
                      className="absolute pointer-events-none"
                      style={{
                        left: Math.min(node.x, childNode.x) - 10,
                        top: Math.min(node.y, childNode.y) - 10,
                        width: Math.abs(childNode.x - node.x) + 20,
                        height: Math.abs(childNode.y - node.y) + 20,
                      }}
                    >
                      <defs>
                        <marker
                          id={`arrowhead-${node.id}-${childId}`}
                          markerWidth="10"
                          markerHeight="7"
                          refX="9"
                          refY="3.5"
                          orient="auto"
                        >
                          <polygon
                            points="0 0, 10 3.5, 0 7"
                            fill={isHighlighted ? "rgba(59, 130, 246, 0.8)" : "rgba(156, 163, 175, 0.5)"}
                          />
                        </marker>
                      </defs>
                      <line
                        x1={node.x - Math.min(node.x, childNode.x) + 10}
                        y1={node.y - Math.min(node.y, childNode.y) + 10}
                        x2={childNode.x - Math.min(node.x, childNode.x) + 10}
                        y2={childNode.y - Math.min(node.y, childNode.y) + 10}
                        stroke={isHighlighted ? "rgba(59, 130, 246, 0.8)" : "rgba(156, 163, 175, 0.5)"}
                        strokeWidth={isHighlighted ? "3" : "2"}
                        markerEnd={`url(#arrowhead-${node.id}-${childId})`}
                        className="transition-all duration-200"
                      />
                    </svg>
                  );
                }),
              )}
            </>
          )}
        </div>

        {selectedText && (
          <div
            className="absolute z-50"
            style={{
              left: selectedText.x + pan.x,
              top: selectedText.y + pan.y - 40,
            }}
          >
            <button
              onClick={handleReplyToSelection}
              className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm hover:bg-primary/90"
            >
              Reply to Selection
            </button>
          </div>
        )}
      </CanvasDropTarget>
    </DndProvider>
  );
}
