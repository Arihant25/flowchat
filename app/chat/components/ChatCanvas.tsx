"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import * as d3 from "d3";
import { ChatConversation, ChatNode } from "../page";
import ChatNodeComponent from "./ChatNode";
import { getLastUsedProviderAndModel, getUserPreferences } from "@/lib/storage";

interface ChatCanvasProps {
  conversation: ChatConversation | null;
  onUpdateConversation: (conversation: ChatConversation) => void;
  onCreateNewConversation: (initialNodePosition?: {
    x: number;
    y: number;
  }) => void;
}

// D3 Force Simulation types
interface SimulationNode extends d3.SimulationNodeDatum {
  id: string;
  isUser: boolean;
  content: string;
  childIds: string[];
  parentId?: string;
  isEditing?: boolean;
  thinking?: string;
  thinkingTime?: number;
  fx?: number | null; // Fixed position
  fy?: number | null; // Fixed position
  x?: number; // d3 will mutate
  y?: number; // d3 will mutate
}

interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  source: string | SimulationNode;
  target: string | SimulationNode;
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
  const isSelectingRef = useRef(false);

  // D3 Force Simulation
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);
  const nodesRef = useRef<SimulationNode[]>([]);
  const linksRef = useRef<SimulationLink[]>([]);
  const fixedNodesRef = useRef<Set<string>>(new Set());

  // Use ref to avoid recreating callbacks when conversation changes
  const conversationRef = useRef<ChatConversation | null>(conversation);
  const onUpdateConversationRef = useRef(onUpdateConversation);

  // Keep refs in sync
  useEffect(() => {
    conversationRef.current = conversation;
    onUpdateConversationRef.current = onUpdateConversation;
  }, [conversation, onUpdateConversation]);

  // Convert ChatNode to SimulationNode
  const chatNodeToSimulationNode = useCallback((node: ChatNode): SimulationNode => ({
    id: node.id,
    x: node.x,
    y: node.y,
    isUser: node.isUser,
    content: node.content,
    childIds: node.childIds,
    parentId: node.parentId,
    isEditing: node.isEditing,
    thinking: node.thinking,
    thinkingTime: node.thinkingTime,
    fx: fixedNodesRef.current.has(node.id) ? node.x : null, // Keep fixed if manually moved
    fy: fixedNodesRef.current.has(node.id) ? node.y : null, // Keep fixed if manually moved
  }), []);

  // Create links from parent-child relationships
  const createLinks = useCallback((nodes: ChatNode[]): SimulationLink[] => {
    const links: SimulationLink[] = [];
    nodes.forEach(node => {
      node.childIds.forEach(childId => {
        links.push({
          source: node.id,
          target: childId,
        });
      });
    });
    return links;
  }, []);

  // Track last position update to throttle conversation updates
  const lastTickUpdateRef = useRef<number>(0);
  const lastPositionsRef = useRef<Map<string, { x: number, y: number }>>(new Map());

  // Initialize or update force simulation (only when structure changes, not every position update)
  const updateForceSimulation = useCallback(() => {
    if (!conversation || conversation.nodes.length === 0) {
      return;
    }

    // Convert nodes and create links
    const simNodes: SimulationNode[] = conversation.nodes.map(chatNodeToSimulationNode);
    const simLinks = createLinks(conversation.nodes);

    nodesRef.current = simNodes;
    linksRef.current = simLinks;

    // Stop existing simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // Create new simulation with improved settings for quick settling
    const simulation = d3.forceSimulation<SimulationNode>(simNodes)
      .force("link", d3.forceLink<SimulationNode, SimulationLink>(simLinks)
        .id((d: SimulationNode) => d.id)
        .distance(250)
        .strength(0.3)
      )
      .force("charge", d3.forceManyBody()
        .strength(-6000)
        .distanceMax(10000)
      )
      .force("center", d3.forceCenter(0, 0).strength(0.1))
      .force("collision", d3.forceCollide()
        .radius(310)
        .strength(2.0)
      )
      .alphaDecay(0.1)
      .velocityDecay(0.4)
      .alphaMin(0.001);

    // Update node positions on each tick - throttled and change-detected
    simulation.on("tick", () => {
      if (!conversationRef.current) return;

      const now = performance.now();
      // Throttle updates to at most ~20fps (50ms)
      if (now - lastTickUpdateRef.current < 50) {
        return;
      }

      const updatedNodes = conversationRef.current.nodes.map((node: ChatNode) => {
        const simNode = (simNodes as SimulationNode[]).find(n => n.id === node.id);
        if (simNode && simNode.x !== undefined && simNode.y !== undefined) {
          if (!fixedNodesRef.current.has(node.id)) {
            return { ...node, x: simNode.x, y: simNode.y };
          }
        }
        return node;
      });

      // Detect if positions actually changed meaningfully
      let changed = false;
      for (const n of updatedNodes) {
        const prev = lastPositionsRef.current.get(n.id);
        const dx = prev ? Math.abs(prev.x - n.x) : Infinity;
        const dy = prev ? Math.abs(prev.y - n.y) : Infinity;
        if (dx > 0.5 || dy > 0.5) { // ignore sub-pixel jitter
          changed = true;
          break;
        }
      }
      if (!changed) return;

      // Update cache
      lastPositionsRef.current.clear();
      updatedNodes.forEach((n: ChatNode) => lastPositionsRef.current.set(n.id, { x: n.x, y: n.y }));
      lastTickUpdateRef.current = now;

      // Push minimal update upstream without triggering simulation recreation (structure unchanged)
      onUpdateConversationRef.current({
        ...conversationRef.current,
        nodes: updatedNodes,
      });
    });

    simulation.on("end", () => {
      // Final update to ensure latest settled positions persisted
      if (!conversationRef.current) return;
      const settledNodes = conversationRef.current.nodes.map((node: ChatNode) => {
        const simNode = (simNodes as SimulationNode[]).find(n => n.id === node.id);
        if (simNode && simNode.x !== undefined && simNode.y !== undefined && !fixedNodesRef.current.has(node.id)) {
          return { ...node, x: simNode.x, y: simNode.y };
        }
        return node;
      });
      onUpdateConversationRef.current({
        ...conversationRef.current,
        nodes: settledNodes,
      });
    });

    simulationRef.current = simulation;
  }, [conversation, chatNodeToSimulationNode, createLinks]);

  // Build a structural signature (ids + child relationships) to decide when to rebuild simulation
  const structureSignature = useMemo(() => {
    if (!conversation) return "none";
    // Only include stable structural info, not positions/content
    return conversation.nodes
      .map(n => `${n.id}:${n.childIds.join(',')}`)
      .sort()
      .join('|');
  }, [conversation]);

  // Rebuild simulation only when structure (not positions) changes
  useEffect(() => {
    updateForceSimulation();
  }, [structureSignature, updateForceSimulation]);

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
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
      // Avoid state churn that might clear highlight while user is dragging selection
      if (isSelectingRef.current) return;
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

      // Group nodes by depth for cascading animation
      const nodesByDepth = new Map<number, string[]>();
      nodeDepths.forEach((depth, nodeId) => {
        if (!nodesByDepth.has(depth)) {
          nodesByDepth.set(depth, []);
        }
        nodesByDepth.get(depth)!.push(nodeId);
      });

      // Start cascading deletion animation
      const deletionMap = new Map<string, number>();
      nodeDepths.forEach((depth, nodeId) => {
        deletionMap.set(nodeId, depth);
      });
      setDeletingNodes(deletionMap);

      // Schedule animations with delays based on depth
      const maxDepth = Math.max(...nodeDepths.values());
      for (let depth = 0; depth <= maxDepth; depth++) {
        const nodesAtDepth = nodesByDepth.get(depth) || [];
        // Delay increases with depth for chain reaction effect
        const delay = depth * 150; // 150ms delay between levels

        setTimeout(() => {
          // Don't need to do anything here as nodes are already marked as deleting
          // The actual deletion happens after all animations complete
        }, delay);
      }

      // After all animations complete, actually delete the nodes
      const totalAnimationTime = maxDepth * 150 + 300; // depth delays + animation duration
      setTimeout(() => {
        const updatedNodes = currentConversation.nodes
          .filter((node: ChatNode) => !nodesToDelete.has(node.id))
          .map((node: ChatNode) => ({
            ...node,
            childIds: node.childIds.filter(
              (childId: string) => !nodesToDelete.has(childId),
            ),
          }));

        if (nodeToDelete.parentId) {
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
          ...currentConversation,
          nodes: updatedNodes,
        };
        conversationRef.current = newConversation;

        // Clear deleting nodes state
        setDeletingNodes(new Map());

        onUpdateConversationRef.current(newConversation);
      }, totalAnimationTime);
    },
    [], // No dependencies - uses refs
  );

  const addChildNode = useCallback(
    (parentId: string, x: number, y: number, aiResponse?: ChatNode, initialUserContent?: string) => {
      const currentConversation = conversationRef.current;
      if (!currentConversation) return;

      if (aiResponse) {
        // Add the provided AI response node with parentId set
        const aiResponseWithParent = { ...aiResponse, parentId };
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
        // If force simulation is enabled, position near parent but let simulation handle final positioning
        const parentNode = currentConversation.nodes.find((n: ChatNode) => n.id === parentId);
        let nodeX = x;
        let nodeY = y;

        if (parentNode) {
          // Position slightly offset from parent, simulation will adjust
          nodeX = parentNode.x + 50;
          nodeY = parentNode.y + 150;
        }

        const newNode: ChatNode = {
          id: `node-${Date.now()}`,
          content: initialUserContent ?? "",
          isUser: true,
          x: nodeX,
          y: nodeY,
          parentId,
          childIds: [],
          isEditing: true,
        };

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
    [], // Add dependency on force simulation state
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

      const newConversation = {
        ...currentConversation,
        nodes: [...currentConversation.nodes, ...newNodes],
      };
      conversationRef.current = newConversation;
      onUpdateConversationRef.current(newConversation);
    },
    [], // No dependencies - uses refs
  );

  const handleTextSelection = useCallback(
    (nodeId: string, text: string, x: number, y: number) => {
      if (text.trim()) {
        setSelectedText({ text, nodeId, x, y });
        // Freeze node in simulation to stop position jitter while selecting
        if (simulationRef.current) {
          const simNode = nodesRef.current.find((n: SimulationNode) => n.id === nodeId);
          if (simNode) {
            simNode.fx = simNode.x;
            simNode.fy = simNode.y;
          }
        }
      }
    },
    [],
  );

  const moveNode = useCallback(
    (nodeId: string, x: number, y: number) => {
      const currentConversation = conversationRef.current;
      if (!currentConversation) return;

      // Track this node as manually fixed
      fixedNodesRef.current.add(nodeId);

      // Update the force simulation node if simulation is enabled
      if (simulationRef.current) {
        const simNode = nodesRef.current.find((n: SimulationNode) => n.id === nodeId);
        if (simNode) {
          // Fix the node position to prevent simulation from moving it
          simNode.fx = x;
          simNode.fy = y;
          simNode.x = x;
          simNode.y = y;

          // Don't restart the simulation - just let it continue with the fixed position
          // The simulation will naturally settle without forcing movement
        }
      }

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
    [], // Add dependency on force simulation state
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
      // Give browser a tick to finalize selection highlight
      setTimeout(() => {
        isSelectingRef.current = false;
        // Don't clear selectedText just because browser selection is lost
        // The force simulation can cause DOM changes that clear browser selection
        // Only clear when user explicitly clicks elsewhere
      }, 20);
    };
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-selectable-content="true"]')) return;
      if (target.closest('[data-reply-button="true"]')) return;
      const sel = window.getSelection();
      if (sel && sel.toString().trim()) return; // keep selection

      // Clear selection when clicking outside selectable content or reply button
      setSelectedText(null);
      // Release frozen node if any
      if (simulationRef.current && selectedText?.nodeId) {
        const simNode = nodesRef.current.find((n: SimulationNode) => n.id === selectedText.nodeId);
        if (simNode && !fixedNodesRef.current.has(selectedText.nodeId)) {
          simNode.fx = null;
          simNode.fy = null;
          // Nudge simulation slightly to settle others
          simulationRef.current.alpha(0.3).restart();
        }
      }
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
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-muted-foreground text-xl pointer-events-none" data-canvas="true">
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

            {/* Render connections using force simulation data when available */}
            {linksRef.current.length > 0
              ? linksRef.current.map((link: SimulationLink, index: number) => {
                const sourceNode = typeof link.source === 'string'
                  ? nodesRef.current.find((n: SimulationNode) => n.id === link.source)
                  : link.source as SimulationNode;
                const targetNode = typeof link.target === 'string'
                  ? nodesRef.current.find((n: SimulationNode) => n.id === link.target)
                  : link.target as SimulationNode;

                if (!sourceNode || !targetNode ||
                  sourceNode.x === undefined || sourceNode.y === undefined ||
                  targetNode.x === undefined || targetNode.y === undefined) {
                  return null;
                }

                const nodeWidth = 384;
                const nodeHeight = 120;

                const sourceCenterX = sourceNode.x + nodeWidth / 2;
                const sourceBottomY = sourceNode.y + nodeHeight + 10;
                const targetCenterX = targetNode.x + nodeWidth / 2;
                const targetTopY = targetNode.y - 10;

                const minX = Math.min(sourceCenterX, targetCenterX) - 60;
                const minY = Math.min(sourceBottomY, targetTopY) - 20;
                const maxX = Math.max(sourceCenterX, targetCenterX) + 60;
                const maxY = Math.max(sourceBottomY, targetTopY) + 20;

                const midY = (sourceBottomY + targetTopY) / 2;
                const pathData = `M ${sourceCenterX - minX} ${sourceBottomY - minY} 
                                   C ${sourceCenterX - minX} ${midY - minY} 
                                     ${targetCenterX - minX} ${midY - minY} 
                                     ${targetCenterX - minX} ${targetTopY - minY}`;

                return (
                  <svg
                    key={`force-edge-${index}`}
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
                        id={`force-arrowhead-${index}`}
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
                      strokeWidth="3"
                      fill="none"
                      markerEnd={`url(#force-arrowhead-${index})`}
                      className="transition-all duration-200"
                    />
                  </svg>
                );
              })
              : conversation.nodes.map((node) =>
                node.childIds.map((childId) => {
                  const childNode = conversation.nodes.find(
                    (n) => n.id === childId,
                  );
                  if (!childNode) return null;

                  const nodeWidth = 384;
                  const nodeHeight = 120;

                  const parentCenterX = node.x + nodeWidth / 2;
                  const parentBottomY = node.y + nodeHeight + 10;
                  const childCenterX = childNode.x + nodeWidth / 2;
                  const childTopY = childNode.y - 10;

                  const minX = Math.min(parentCenterX, childCenterX) - 60;
                  const minY = Math.min(parentBottomY, childTopY) - 20;
                  const maxX = Math.max(parentCenterX, childCenterX) + 60;
                  const maxY = Math.max(parentBottomY, childTopY) + 20;

                  const midY = (parentBottomY + childTopY) / 2;
                  const pathData = `M ${parentCenterX - minX} ${parentBottomY - minY} 
                                     C ${parentCenterX - minX} ${midY - minY} 
                                       ${childCenterX - minX} ${midY - minY} 
                                       ${childCenterX - minX} ${childTopY - minY}`;

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
                        className="transition-all duration-200"
                      />
                    </svg>
                  );
                }),
              )
            }
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
            className="bg-primary text-primary-foreground px-3 py-1 rounded text-sm hover:bg-primary/90 shadow"
          >
            Reply
          </button>
        </div>
      )}
    </div>
  );
}
