"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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

  // D3 Force Simulation
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);
  const nodesRef = useRef<SimulationNode[]>([]);
  const linksRef = useRef<SimulationLink[]>([]);

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
    fx: null, // Allow movement by default
    fy: null, // Allow movement by default
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

  // Initialize or update force simulation
  const updateForceSimulation = useCallback(() => {
    if (!conversation || conversation.nodes.length === 0) {
      return;
    }

    // Convert nodes and create links
    const simNodes = conversation.nodes.map(chatNodeToSimulationNode);
    const simLinks = createLinks(conversation.nodes);

    nodesRef.current = simNodes;
    linksRef.current = simLinks;

    // Stop existing simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // Create new simulation with improved settings
    const simulation = d3.forceSimulation<SimulationNode>(simNodes)
      .force("link", d3.forceLink<SimulationNode, SimulationLink>(simLinks)
        .id(d => d.id)
        .distance(250) // Increased distance between connected nodes
        .strength(0.6) // Slightly stronger link force
      )
      .force("charge", d3.forceManyBody()
        .strength(-400) // Stronger repulsion between nodes
        .distanceMax(500) // Increased max distance for repulsion
      )
      .force("center", d3.forceCenter(0, 0)) // Center the graph
      .force("collision", d3.forceCollide()
        .radius(120) // Increased minimum distance between nodes
        .strength(0.8) // Stronger collision force
      )
      .alphaDecay(0.015) // Even slower decay for smoother animation
      .velocityDecay(0.5); // Increased friction for more stability

    // Update node positions on each tick
    simulation.on("tick", () => {
      if (!conversationRef.current) return;

      const updatedNodes = conversationRef.current.nodes.map(node => {
        const simNode = simNodes.find(n => n.id === node.id);
        if (simNode && simNode.x !== undefined && simNode.y !== undefined) {
          return {
            ...node,
            x: simNode.x,
            y: simNode.y,
          };
        }
        return node;
      });

      onUpdateConversationRef.current({
        ...conversationRef.current,
        nodes: updatedNodes,
      });
    });

    simulationRef.current = simulation;
  }, [conversation, chatNodeToSimulationNode, createLinks]);

  // Update simulation when conversation changes
  useEffect(() => {
    updateForceSimulation();
  }, [conversation?.nodes, updateForceSimulation]);

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

      const newConversation = {
        ...currentConversation,
        nodes: updatedNodes,
      };
      conversationRef.current = newConversation;

      onUpdateConversationRef.current(newConversation);
    },
    [], // No dependencies - uses refs
  );

  const addChildNode = useCallback(
    (parentId: string, x: number, y: number, aiResponse?: ChatNode) => {
      const currentConversation = conversationRef.current;
      if (!currentConversation) return;

      if (aiResponse) {
        // Add the provided AI response node with parentId set
        const aiResponseWithParent = { ...aiResponse, parentId };
        const updatedNodes = currentConversation.nodes.map((node) =>
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
        const parentNode = currentConversation.nodes.find(n => n.id === parentId);
        let nodeX = x;
        let nodeY = y;

        if (parentNode) {
          // Position slightly offset from parent, simulation will adjust
          nodeX = parentNode.x + 50;
          nodeY = parentNode.y + 150;
        }

        const newNode: ChatNode = {
          id: `node-${Date.now()}`,
          content: "",
          isUser: true,
          x: nodeX,
          y: nodeY,
          parentId,
          childIds: [],
          isEditing: true,
        };

        const updatedNodes = currentConversation.nodes.map((node) =>
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
      }
    },
    [],
  );

  const moveNode = useCallback(
    (nodeId: string, x: number, y: number) => {
      const currentConversation = conversationRef.current;
      if (!currentConversation) return;

      console.log('Moving node:', { nodeId, x, y });

      // Update the force simulation node if simulation is enabled
      if (simulationRef.current) {
        const simNode = nodesRef.current.find(n => n.id === nodeId);
        if (simNode) {
          // Do not fix the node position; allow simulation to continue
          simNode.x = x;
          simNode.y = y;

          // Restart simulation with a low alpha to settle other nodes
          simulationRef.current.alpha(0.1).restart();
        }
      }

      const updatedNodes = currentConversation.nodes.map((node) =>
        node.id === nodeId ? { ...node, x, y } : node,
      );

      console.log('Updated nodes:', updatedNodes.find(n => n.id === nodeId));

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
      return currentConversation.nodes.find((node) => node.id === id);
    },
    [], // No dependencies - uses refs
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
              />
            ))}

            {/* Render connections using force simulation data when available */}
            {linksRef.current.length > 0
              ? linksRef.current.map((link, index) => {
                const sourceNode = typeof link.source === 'string'
                  ? nodesRef.current.find(n => n.id === link.source)
                  : link.source;
                const targetNode = typeof link.target === 'string'
                  ? nodesRef.current.find(n => n.id === link.target)
                  : link.target;

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
                          fill="rgba(59, 130, 246, 0.8)"
                        />
                      </marker>
                    </defs>
                    <path
                      d={pathData}
                      stroke="rgba(59, 130, 246, 0.8)"
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
                            fill={"rgba(100, 116, 139, 0.7)"}
                          />
                        </marker>
                      </defs>
                      <path
                        d={pathData}
                        stroke={"rgba(100, 116, 139, 0.7)"}
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
