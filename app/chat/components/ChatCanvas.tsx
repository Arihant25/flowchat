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
  const [deletingNodes, setDeletingNodes] = useState<Map<string, number>>(new Map());
  const [pendingNodePosition, setPendingNodePosition] = useState<{ x: number; y: number } | null>(null);
  const isSelectingRef = useRef(false);

  // Node positioning constants
  const NODE_WIDTH = 384;
  const NODE_HEIGHT = 120; // Minimum height
  const VERTICAL_SPACING = 100;
  const HORIZONTAL_SPACING = 200;

  // Estimate the actual height of a node based on its content
  const estimateNodeHeight = useCallback((node: ChatNode): number => {
    const baseHeight = NODE_HEIGHT;
    const contentLength = node.content.length;

    if (contentLength <= 100) {
      return baseHeight;
    } else if (contentLength <= 500) {
      return baseHeight + 60;
    } else if (contentLength <= 1000) {
      return baseHeight + 120;
    } else {
      // For very long content, estimate based on character count
      const extraLines = Math.ceil((contentLength - 1000) / 80); // ~80 chars per line
      return baseHeight + 120 + (extraLines * 20);
    }
  }, []);

  // Use ref to avoid recreating callbacks when conversation changes
  const conversationRef = useRef<ChatConversation | null>(conversation);
  const onUpdateConversationRef = useRef(onUpdateConversation);

  // Keep refs in sync
  useEffect(() => {
    conversationRef.current = conversation;
    onUpdateConversationRef.current = onUpdateConversation;
  }, [conversation, onUpdateConversation]);

  // Handle pending node creation when conversation becomes available
  useEffect(() => {
    if (conversation && pendingNodePosition) {
      const newNode: ChatNode = {
        id: `node-${Date.now()}`,
        content: "",
        isUser: true,
        x: pendingNodePosition.x,
        y: pendingNodePosition.y,
        childIds: [],
        isEditing: true,
      };

      const updatedConversation: ChatConversation = {
        ...conversation,
        nodes: [...conversation.nodes, newNode],
      };

      onUpdateConversation(updatedConversation);
      setPendingNodePosition(null);
    }
  }, [conversation, pendingNodePosition, onUpdateConversation]);

  // Calculate optimal position for a new child node
  const calculateChildPosition = useCallback((parentNode: ChatNode, existingNodes: ChatNode[], isLeafNode: boolean): { x: number; y: number } => {
    // Find all existing children of this parent
    const siblingNodes = existingNodes.filter(node => node.parentId === parentNode.id);

    if (isLeafNode || siblingNodes.length === 0) {
      // For leaf nodes or first child: position directly below parent
      // Use the estimated height of the parent node for better spacing
      const parentHeight = estimateNodeHeight(parentNode);
      const baseY = parentNode.y + parentHeight + VERTICAL_SPACING;
      return { x: parentNode.x, y: baseY };
    }

    // For nodes in the middle of a tree: position to the side of existing children
    // Find the rightmost child position
    const rightmostChild = siblingNodes.reduce((rightmost, child) =>
      child.x > rightmost.x ? child : rightmost
    );

    // Position new node to the right of the rightmost child
    const newX = rightmostChild.x + NODE_WIDTH + HORIZONTAL_SPACING;
    const newY = rightmostChild.y; // Same Y level as siblings

    return { x: newX, y: newY };
  }, [estimateNodeHeight]);

  // Check if a node is a leaf (has no children)
  const isNodeLeaf = useCallback((nodeId: string, existingNodes: ChatNode[]): boolean => {
    const node = existingNodes.find(n => n.id === nodeId);
    return !node || node.childIds.length === 0;
  }, []);

  // Calculate optimal position for a branched conversation
  const calculateBranchPosition = useCallback((originalNode: ChatNode, existingNodes: ChatNode[]): { x: number; y: number } => {
    // Find the rightmost node at this Y level
    const nodesAtSameLevel = existingNodes.filter(node =>
      Math.abs(node.y - originalNode.y) < NODE_HEIGHT / 2
    );

    const rightmostX = Math.max(...nodesAtSameLevel.map(node => node.x));
    const branchX = rightmostX + NODE_WIDTH + HORIZONTAL_SPACING * 2;

    return { x: branchX, y: originalNode.y };
  }, []);

  const handleCanvasDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      // Check if double-click is on canvas area and not on a node or interactive element
      const target = e.target as HTMLElement;
      const isOnCanvas = target === canvasRef.current ||
        (target.getAttribute('data-canvas') === 'true') ||
        (target.closest('[data-canvas="true"]') && !target.closest('[data-node="true"]') && !target.closest('button') && !target.closest('textarea') && !target.closest('[data-interactive="true"]'));

      if (isOnCanvas && !isPanning) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;

        if (!conversation) {
          // Set pending node position and create new conversation
          setPendingNodePosition({ x, y });
          onCreateNewConversation();
          return;
        }

        const newNode: ChatNode = {
          id: `node-${Date.now()}`,
          content: "",
          isUser: true,
          x,
          y,
          childIds: [],
          isEditing: true,
        };

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
    // Allow panning when clicking on canvas area, but not on interactive elements or draggable nodes
    const target = e.target as HTMLElement;
    const isOnCanvas = target === canvasRef.current ||
      (target.getAttribute('data-canvas') === 'true') ||
      (target.closest('[data-canvas="true"]') && !target.closest('[data-node="true"]') && !target.closest('button') && !target.closest('textarea') && !target.closest('[data-interactive="true"]'));

    if (isOnCanvas) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      e.preventDefault(); // Prevent text selection while panning
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const deltaX = e.clientX - lastPanPoint.x;
        const deltaY = e.clientY - lastPanPoint.y;
        setPan((prev: { x: number; y: number }) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
        setLastPanPoint({ x: e.clientX, y: e.clientY });
      }
    },
    [isPanning, lastPanPoint],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Check if the wheel event is happening over interactive elements like dropdowns
    const target = e.target as HTMLElement;

    // Don't zoom if scrolling over select dropdowns, buttons, or other interactive elements
    if (
      // Radix UI Select components
      target.closest('[data-radix-select-content]') ||
      target.closest('[data-radix-select-viewport]') ||
      target.closest('[data-slot="select-content"]') ||
      target.closest('[data-slot="select-viewport"]') ||
      target.closest('[role="listbox"]') ||
      target.closest('[role="option"]') ||
      // Standard form elements
      target.closest('select') ||
      target.closest('button') ||
      target.closest('textarea') ||
      target.closest('input') ||
      // Custom interactive elements
      target.closest('[data-interactive="true"]') ||
      // Any scrollable content areas
      target.closest('[data-scrollable="true"]')
    ) {
      return; // Allow default scroll behavior for interactive elements
    }

    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev: number) => Math.max(0.1, Math.min(3, prev * delta)));
  }, []);

  const updateNode = useCallback(
    (nodeId: string, updates: Partial<ChatNode>) => {
      // Avoid state churn that might clear highlight while user is actively selecting text
      // But allow content updates for streaming responses
      if (isSelectingRef.current && !updates.content) return;

      const currentConversation = conversationRef.current;
      if (!currentConversation) return;

      const updatedNodes = currentConversation.nodes.map((node: ChatNode) =>
        node.id === nodeId ? { ...node, ...updates } : node,
      );

      const newConversation = {
        ...currentConversation,
        nodes: updatedNodes,
      };
      conversationRef.current = newConversation;

      onUpdateConversationRef.current(newConversation);
    },
    [], // No dependencies - uses refs
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      const currentConversation = conversationRef.current;
      if (!currentConversation) return;

      const nodeToDelete = currentConversation.nodes.find((n: ChatNode) => n.id === nodeId);
      if (!nodeToDelete) return;

      // Build tree structure to determine animation order
      const nodesToDelete = new Set<string>();
      const nodeDepths = new Map<string, number>();

      const collectChildNodes = (id: string, depth = 0) => {
        nodesToDelete.add(id);
        nodeDepths.set(id, depth);
        const node = currentConversation.nodes.find((n: ChatNode) => n.id === id);
        if (node) {
          node.childIds.forEach((childId: string) => collectChildNodes(childId, depth + 1));
        }
      };

      collectChildNodes(nodeId);

      // Schedule cascading deletion with staggered timing
      const maxDepth = Math.max(...nodeDepths.values());
      const animationDuration = 400; // Slightly longer for the enhanced animation
      const staggerDelay = 80; // Faster cascade for more dynamic feel

      // Start the cascading animation
      for (let depth = 0; depth <= maxDepth; depth++) {
        const delay = depth * staggerDelay;

        setTimeout(() => {
          // Mark nodes at this depth for deletion
          const deletionMap = new Map<string, number>();
          nodeDepths.forEach((nodeDepth, nodeId) => {
            if (nodeDepth === depth) {
              deletionMap.set(nodeId, nodeDepth);
            }
          });
          setDeletingNodes(prev => new Map([...prev, ...deletionMap]));

          // After animation completes for this level, remove the nodes
          setTimeout(() => {
            const currentConv = conversationRef.current;
            if (!currentConv) return;

            // Only remove nodes at this specific depth
            const nodesToRemoveAtThisDepth = Array.from(nodeDepths.entries())
              .filter(([_, nodeDepth]) => nodeDepth === depth)
              .map(([nodeId]) => nodeId);

            const updatedNodes = currentConv.nodes
              .filter((node: ChatNode) => !nodesToRemoveAtThisDepth.includes(node.id))
              .map((node: ChatNode) => ({
                ...node,
                childIds: node.childIds.filter(
                  (childId: string) => !nodesToRemoveAtThisDepth.includes(childId),
                ),
              }));

            // Update parent connections if needed
            if (depth === 0 && nodeToDelete.parentId) {
              const parentIndex = updatedNodes.findIndex(
                (n: ChatNode) => n.id === nodeToDelete.parentId,
              );
              if (parentIndex !== -1) {
                updatedNodes[parentIndex] = {
                  ...updatedNodes[parentIndex],
                  childIds: updatedNodes[parentIndex].childIds.filter(
                    (id: string) => id !== nodeId,
                  ),
                };
              }
            }

            const newConversation = {
              ...currentConv,
              nodes: updatedNodes,
            };
            conversationRef.current = newConversation;

            // Clear deletion markers for removed nodes
            setDeletingNodes(prev => {
              const newMap = new Map(prev);
              nodesToRemoveAtThisDepth.forEach(id => newMap.delete(id));
              return newMap;
            });

            onUpdateConversationRef.current(newConversation);
          }, animationDuration);

        }, delay);
      }
    },
    [], // No dependencies - uses refs
  );

  const addChildNode = useCallback(
    (parentId: string, x: number, y: number, aiResponse?: ChatNode, initialUserContent?: string) => {
      const currentConversation = conversationRef.current;
      if (!currentConversation) return;

      if (aiResponse) {
        // Add the provided AI response node with parentId set and optimal positioning
        const parentNode = currentConversation.nodes.find((n: ChatNode) => n.id === parentId);
        if (!parentNode) return;

        // AI responses should always be positioned directly below the user input
        // Use the estimated height of the parent node for accurate spacing
        const parentHeight = estimateNodeHeight(parentNode);
        const responseY = parentNode.y + parentHeight + VERTICAL_SPACING;
        const responseX = parentNode.x;

        const aiResponseWithParent = {
          ...aiResponse,
          parentId,
          x: responseX,
          y: responseY
        };

        const updatedNodes = currentConversation.nodes.map((node: ChatNode) =>
          node.id === parentId
            ? { ...node, childIds: [...node.childIds, aiResponse.id] }
            : node,
        );

        const newConversation = {
          ...currentConversation,
          nodes: [...updatedNodes, aiResponseWithParent],
        };
        conversationRef.current = newConversation;
        onUpdateConversationRef.current(newConversation);
      } else {
        // Create a new user input node
        const parentNode = currentConversation.nodes.find((n: ChatNode) => n.id === parentId);
        if (!parentNode) return;

        // Check if parent is a leaf node
        const parentIsLeaf = isNodeLeaf(parentId, currentConversation.nodes);

        // Calculate optimal position for the new child
        const optimalPosition = calculateChildPosition(parentNode, currentConversation.nodes, parentIsLeaf);

        const newNode: ChatNode = {
          id: `node-${Date.now()}`,
          content: initialUserContent ?? "",
          isUser: true,
          x: optimalPosition.x,
          y: optimalPosition.y,
          parentId,
          childIds: [],
          isEditing: true,
        };

        // For leaf nodes, no need to rearrange siblings
        // For non-leaf nodes, just add to the side
        const updatedNodes = currentConversation.nodes.map((node: ChatNode) =>
          node.id === parentId
            ? { ...node, childIds: [...node.childIds, newNode.id] }
            : node,
        );

        const newConversation = {
          ...currentConversation,
          nodes: [...updatedNodes, newNode],
        };
        conversationRef.current = newConversation;
        onUpdateConversationRef.current(newConversation);
      }
    },
    [calculateChildPosition, isNodeLeaf, estimateNodeHeight],
  );

  const branchNode = useCallback(
    (nodeId: string) => {
      const currentConversation = conversationRef.current;
      if (!currentConversation) return;

      const nodeIndex = currentConversation.nodes.findIndex((n: ChatNode) => n.id === nodeId);
      if (nodeIndex === -1) return;

      const originalNode = currentConversation.nodes[nodeIndex];
      const conversationHistory: ChatNode[] = [];

      let currentNode: ChatNode | undefined = originalNode;
      while (currentNode) {
        conversationHistory.unshift(currentNode);
        currentNode = currentNode.parentId
          ? currentConversation.nodes.find((n: ChatNode) => n.id === currentNode!.parentId)
          : undefined;
      }

      const newNodes: ChatNode[] = [];
      let previousNewNode: ChatNode | null = null;

      // Calculate branch starting position
      const branchPosition = calculateBranchPosition(originalNode, currentConversation.nodes);

      conversationHistory.forEach((node, index) => {
        const newNode: ChatNode = {
          id: `node-${Date.now()}-${index}`,
          content: node.content,
          isUser: node.isUser,
          x: branchPosition.x,
          y: branchPosition.y + index * (NODE_HEIGHT + VERTICAL_SPACING),
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

      const newConversation = {
        ...currentConversation,
        nodes: [...currentConversation.nodes, ...newNodes],
      };
      conversationRef.current = newConversation;
      onUpdateConversationRef.current(newConversation);
    },
    [calculateBranchPosition],
  );

  const handleTextSelection = useCallback(
    (nodeId: string, text: string, x: number, y: number) => {
      if (text.trim()) {
        // Ensure we're not in a selecting state when setting the selected text
        isSelectingRef.current = false;
        setSelectedText({ text, nodeId, x, y });
      }
    },
    [],
  );

  const moveNode = useCallback(
    (nodeId: string, x: number, y: number) => {
      const currentConversation = conversationRef.current;
      if (!currentConversation) return;

      const updatedNodes = currentConversation.nodes.map((node: ChatNode) =>
        node.id === nodeId ? { ...node, x, y } : node,
      );

      const newConversation = {
        ...currentConversation,
        nodes: updatedNodes,
      };
      conversationRef.current = newConversation;
      onUpdateConversationRef.current(newConversation);
    },
    [],
  );

  const handleNodeClick = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      // Connection mode functionality removed
    },
    [],
  );

  const getNodeById = useCallback(
    (id: string) => {
      const currentConversation = conversationRef.current;
      if (!currentConversation) return undefined;
      return currentConversation.nodes.find((node: ChatNode) => node.id === id);
    },
    [], // No dependencies - uses refs
  );

  const handleReplyToSelection = useCallback(() => {
    if (!selectedText) return;

    // Build a markdown blockquote of the selected text (limit length to prevent overly large quotes)
    const MAX_QUOTE_CHARS = 1200;
    const raw = selectedText.text.length > MAX_QUOTE_CHARS
      ? selectedText.text.slice(0, MAX_QUOTE_CHARS) + '…'
      : selectedText.text;
    const quoted = raw
      .split(/\r?\n/)
      .map((line: string) => line.trim() ? `> ${line}` : '>')
      .join('\n');
    const initialContent = `${quoted}\n\n`; // Leave space for user prompt continuation

    addChildNode(selectedText.nodeId, selectedText.x + 200, selectedText.y, undefined, initialContent);
    setSelectedText(null);
  }, [selectedText, addChildNode]);

  useEffect(() => {
    let mouseDownTarget: EventTarget | null = null;
    const handleMouseDown = (e: MouseEvent) => {
      mouseDownTarget = e.target;
      const target = e.target as HTMLElement;
      if (target.closest('[data-selectable-content="true"]')) {
        isSelectingRef.current = true;
      }
    };
    const handleMouseUp = () => {
      // Give browser time to finalize selection highlight and handle onTextSelection
      setTimeout(() => {
        isSelectingRef.current = false;
      }, 100);
    };
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-selectable-content="true"]')) return;
      if (target.closest('[data-reply-button="true"]')) return;
      const sel = window.getSelection();
      if (sel && sel.toString().trim()) return; // keep selection

      // Clear selection when clicking outside selectable content or reply button
      setSelectedText(null);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('click', handleClick);
    };
  }, [selectedText]);

  const dotPattern = `radial-gradient(circle, rgba(156, 163, 175, 0.3) 1px, transparent 1px)`;
  const dotSize = 20 * zoom;

  return (
    <div
      ref={canvasRef}
      data-canvas="true"
      className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing relative"
      style={{
        backgroundImage: dotPattern,
        backgroundSize: `${dotSize}px ${dotSize}px`,
        backgroundPosition: `${pan.x % dotSize}px ${pan.y % dotSize}px`,
      }}
      onDoubleClick={handleCanvasDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      <div
        data-canvas="true"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
        className="absolute inset-0"
      >
        {!conversation || conversation.nodes.length === 0 ? (
          <div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-muted-foreground text-xl pointer-events-none"
            data-canvas="true"
          >
            Double-click anywhere to start chatting!
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
                getNodeById={getNodeById}
                zoom={zoom}
                isMarkedForDeletion={deletingNodes.has(node.id)}
                deletionDepth={deletingNodes.get(node.id)}
              />
            ))}

            {/* Render connections between nodes */}
            {conversation.nodes.map((node) =>
              node.childIds.map((childId) => {
                const childNode = conversation.nodes.find(
                  (n) => n.id === childId,
                );
                if (!childNode) return null;

                const nodeWidth = NODE_WIDTH;
                const nodeHeight = NODE_HEIGHT;

                // Calculate centers of both nodes
                const parentCenterX = node.x + nodeWidth / 2;
                const parentCenterY = node.y + nodeHeight / 2;
                const childCenterX = childNode.x + nodeWidth / 2;
                const childCenterY = childNode.y + nodeHeight / 2;

                // Calculate the angle between nodes
                const dx = childCenterX - parentCenterX;
                const dy = childCenterY - parentCenterY;
                const angle = Math.atan2(dy, dx);

                // Calculate connection points on the edges of the nodes
                // We need to find where the line from center to center intersects the node rectangles

                // For parent: find exit point on the rectangle edge
                let parentExitX, parentExitY;
                const parentLeft = node.x;
                const parentRight = node.x + nodeWidth;
                const parentTop = node.y;
                const parentBottom = node.y + nodeHeight;

                // Determine which edge the line exits from
                const parentSlope = dy / dx;
                if (Math.abs(dx) > Math.abs(dy)) {
                  // Exit from left or right edge
                  if (dx > 0) {
                    // Exit from right edge
                    parentExitX = parentRight;
                    parentExitY = parentCenterY + (parentRight - parentCenterX) * parentSlope;
                  } else {
                    // Exit from left edge
                    parentExitX = parentLeft;
                    parentExitY = parentCenterY + (parentLeft - parentCenterX) * parentSlope;
                  }
                } else {
                  // Exit from top or bottom edge
                  if (dy > 0) {
                    // Exit from bottom edge
                    parentExitY = parentBottom;
                    parentExitX = parentCenterX + (parentBottom - parentCenterY) / parentSlope;
                  } else {
                    // Exit from top edge
                    parentExitY = parentTop;
                    parentExitX = parentCenterX + (parentTop - parentCenterY) / parentSlope;
                  }
                }

                // For child: find entry point on the rectangle edge
                let childEntryX, childEntryY;
                const childLeft = childNode.x;
                const childRight = childNode.x + nodeWidth;
                const childTop = childNode.y;
                const childBottom = childNode.y + nodeHeight;

                // Determine which edge the line enters from (opposite direction)
                if (Math.abs(dx) > Math.abs(dy)) {
                  // Enter from left or right edge
                  if (dx > 0) {
                    // Enter from left edge
                    childEntryX = childLeft;
                    childEntryY = childCenterY + (childLeft - childCenterX) * parentSlope;
                  } else {
                    // Enter from right edge
                    childEntryX = childRight;
                    childEntryY = childCenterY + (childRight - childCenterX) * parentSlope;
                  }
                } else {
                  // Enter from top or bottom edge
                  if (dy > 0) {
                    // Enter from top edge
                    childEntryY = childTop;
                    childEntryX = childCenterX + (childTop - childCenterY) / parentSlope;
                  } else {
                    // Enter from bottom edge
                    childEntryY = childBottom;
                    childEntryX = childCenterX + (childBottom - childCenterY) / parentSlope;
                  }
                }

                // Calculate control points for a smooth curve
                const controlOffset = 50; // Distance for control points
                const controlX1 = parentExitX + Math.cos(angle) * controlOffset;
                const controlY1 = parentExitY + Math.sin(angle) * controlOffset;
                const controlX2 = childEntryX - Math.cos(angle) * controlOffset;
                const controlY2 = childEntryY - Math.sin(angle) * controlOffset;

                // Calculate bounding box for the SVG
                const allX = [parentExitX, childEntryX, controlX1, controlX2];
                const allY = [parentExitY, childEntryY, controlY1, controlY2];
                const minX = Math.min(...allX) - 10;
                const minY = Math.min(...allY) - 10;
                const maxX = Math.max(...allX) + 10;
                const maxY = Math.max(...allY) + 10;

                // Create path data with proper curve
                const pathData = `M ${parentExitX - minX} ${parentExitY - minY} 
                                   C ${controlX1 - minX} ${controlY1 - minY} 
                                     ${controlX2 - minX} ${controlY2 - minY} 
                                     ${childEntryX - minX} ${childEntryY - minY}`;

                return (
                  <svg
                    key={`edge-${node.id}-${childId}`}
                    className="absolute pointer-events-none z-10"
                    style={{
                      left: minX,
                      top: minY,
                      width: maxX - minX,
                      height: maxY - minY,
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
                        markerUnits="strokeWidth"
                      >
                        <polygon
                          points="0 0, 10 3.5, 0 7"
                          fill="var(--foreground)"
                        />
                      </marker>
                    </defs>
                    <path
                      d={pathData}
                      stroke="var(--foreground)"
                      strokeWidth={"2"}
                      fill="none"
                      markerEnd={`url(#arrowhead-${node.id}-${childId})`}
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
            // Use viewport based coordinates relative to canvas without re-applying pan/zoom (selection rect already in viewport coords)
            left: selectedText.x - (canvasRef.current?.getBoundingClientRect().left || 0),
            top: selectedText.y - (canvasRef.current?.getBoundingClientRect().top || 0) - 40,
          }}
        >
          <button
            data-reply-button="true"
            onClick={handleReplyToSelection}
            className="bg-primary text-primary-foreground px-2 py-1 rounded text-sm hover:bg-primary/90 shadow"
          >
            Reply
          </button>
        </div>
      )}
    </div>
  );
}
