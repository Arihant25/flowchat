"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
      if (!conversation) return;

      const updatedNodes = conversation.nodes.map((node) =>
        node.id === nodeId ? { ...node, ...updates } : node,
      );

      onUpdateConversation({
        ...conversation,
        nodes: updatedNodes,
      });
    },
    [conversation, onUpdateConversation],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (!conversation) return;

      const nodeToDelete = conversation.nodes.find((n) => n.id === nodeId);
      if (!nodeToDelete) return;

      const nodesToDelete = new Set<string>();

      const collectChildNodes = (id: string) => {
        nodesToDelete.add(id);
        const node = conversation.nodes.find((n) => n.id === id);
        if (node) {
          node.childIds.forEach((childId) => collectChildNodes(childId));
        }
      };

      collectChildNodes(nodeId);

      const updatedNodes = conversation.nodes
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

      onUpdateConversation({
        ...conversation,
        nodes: updatedNodes,
      });
    },
    [conversation, onUpdateConversation],
  );

  const addChildNode = useCallback(
    (parentId: string, x: number, y: number) => {
      if (!conversation) return;

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

      const updatedNodes = conversation.nodes.map((node) =>
        node.id === parentId
          ? { ...node, childIds: [...node.childIds, newNode.id] }
          : node,
      );

      onUpdateConversation({
        ...conversation,
        nodes: [...updatedNodes, newNode],
      });
    },
    [conversation, onUpdateConversation],
  );

  const branchNode = useCallback(
    (nodeId: string) => {
      if (!conversation) return;

      const nodeIndex = conversation.nodes.findIndex((n) => n.id === nodeId);
      if (nodeIndex === -1) return;

      const originalNode = conversation.nodes[nodeIndex];
      const conversationHistory: ChatNode[] = [];

      let currentNode: ChatNode | undefined = originalNode;
      while (currentNode) {
        conversationHistory.unshift(currentNode);
        currentNode = currentNode.parentId
          ? conversation.nodes.find((n) => n.id === currentNode!.parentId)
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

      onUpdateConversation({
        ...conversation,
        nodes: [...conversation.nodes, ...newNodes],
      });
    },
    [conversation, onUpdateConversation],
  );

  const handleTextSelection = useCallback(
    (nodeId: string, text: string, x: number, y: number) => {
      if (text.trim()) {
        setSelectedText({ text, nodeId, x, y });
      }
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

  return (
    <div
      ref={canvasRef}
      className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing relative"
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
      <div
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
                zoom={zoom}
              />
            ))}

            {conversation.nodes.map((node) =>
              node.childIds.map((childId) => {
                const childNode = conversation.nodes.find(
                  (n) => n.id === childId,
                );
                if (!childNode) return null;

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
                    <line
                      x1={node.x - Math.min(node.x, childNode.x) + 10}
                      y1={node.y - Math.min(node.y, childNode.y) + 10}
                      x2={childNode.x - Math.min(node.x, childNode.x) + 10}
                      y2={childNode.y - Math.min(node.y, childNode.y) + 10}
                      stroke="rgba(156, 163, 175, 0.5)"
                      strokeWidth="2"
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
    </div>
  );
}
