"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";

interface ThinkingIndicatorProps {
    thinking?: string;
    thinkingTime?: number;
    isThinking: boolean;
}

export default function ThinkingIndicator({ thinking, thinkingTime, isThinking }: ThinkingIndicatorProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isThinking) {
            interval = setInterval(() => {
                setCurrentTime(prev => prev + 1);
            }, 1000);
        } else {
            setCurrentTime(thinkingTime || 0);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isThinking, thinkingTime]);

    if (!thinking && !isThinking) {
        return null;
    }

    const formatTime = (seconds: number) => {
        if (seconds < 60) {
            return `${seconds}s`;
        }
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    return (
        <Card className="mb-2 border-gray-200 bg-gray-50">
            <CardContent className="p-3">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between p-0 h-auto text-sm text-gray-600 hover:bg-transparent"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        <span>
                            {isThinking
                                ? `Thinking for ${formatTime(currentTime)}...`
                                : `Thought for ${formatTime(currentTime)}`
                            }
                        </span>
                    </div>
                    {(thinking || isThinking) && (
                        isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                    )}
                </Button>

                {isExpanded && (thinking || isThinking) && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="text-sm text-gray-500 whitespace-pre-wrap font-mono leading-relaxed">
                            {thinking || "Thinking..."}
                            {isThinking && (
                                <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse" />
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
