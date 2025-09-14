import { Variants, Transition } from "framer-motion";

// Common easing curves
export const easings = {
    spring: {
        type: "spring" as const,
        damping: 25,
        stiffness: 120,
    },
    smooth: {
        type: "tween" as const,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
        duration: 0.3,
    },
    bouncy: {
        type: "spring" as const,
        damping: 12,
        stiffness: 200,
    },
    slow: {
        type: "tween" as const,
        ease: "easeInOut" as const,
        duration: 0.6,
    },
    fast: {
        type: "tween" as const,
        ease: "easeOut" as const,
        duration: 0.15,
    },
};

// Slide animations
export const slideVariants: Variants = {
    hidden: { x: -100, opacity: 0 },
    visible: { x: 0, opacity: 1 },
    exit: { x: -100, opacity: 0 },
};

export const slideRightVariants: Variants = {
    hidden: { x: 100, opacity: 0 },
    visible: { x: 0, opacity: 1 },
    exit: { x: 100, opacity: 0 },
};

export const slideUpVariants: Variants = {
    hidden: { y: 100, opacity: 0 },
    visible: { y: 0, opacity: 1 },
    exit: { y: 100, opacity: 0 },
};

export const slideDownVariants: Variants = {
    hidden: { y: -100, opacity: 0 },
    visible: { y: 0, opacity: 1 },
    exit: { y: -100, opacity: 0 },
};

// Fade animations
export const fadeVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
};

export const fadeUpVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
};

export const fadeDownVariants: Variants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
};

export const fadeScaleVariants: Variants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
};

// Scale animations
export const scaleVariants: Variants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { scale: 1, opacity: 1 },
    exit: { scale: 0, opacity: 0 },
};

export const scaleCenterVariants: Variants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: { scale: 1, opacity: 1 },
    exit: { scale: 0.8, opacity: 0 },
};

export const popVariants: Variants = {
    hidden: { scale: 0 },
    visible: { scale: 1 },
    exit: { scale: 0 },
};

// Hover and interaction animations
export const hoverVariants = {
    lift: {
        rest: { y: 0 },
        hover: { y: -4, transition: easings.fast },
        tap: { scale: 0.98 },
    },
    scale: {
        rest: { scale: 1 },
        hover: { scale: 1.05, transition: easings.fast },
        tap: { scale: 0.95 },
    },
    glow: {
        rest: { boxShadow: "0 0 0 rgba(0, 0, 0, 0)" },
        hover: {
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
            transition: easings.smooth
        },
    },
};

// Stagger animations for lists
export const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1,
        },
    },
};

export const staggerItem: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: easings.spring,
    },
};

// Page transition animations
export const pageVariants: Variants = {
    initial: {
        opacity: 0,
        scale: 0.96,
    },
    in: {
        opacity: 1,
        scale: 1,
    },
    out: {
        opacity: 0,
        scale: 1.04,
    },
};

export const pageTransition: Transition = {
    type: "tween",
    ease: "anticipate",
    duration: 0.4,
};

// Sidebar animations
export const sidebarVariants: Variants = {
    closed: {
        x: "-100%",
    },
    open: {
        x: "0%",
    },
};

// Modal/Dialog animations
export const modalVariants: Variants = {
    hidden: {
        opacity: 0,
        scale: 0.8,
        y: 20,
    },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: easings.spring,
    },
    exit: {
        opacity: 0,
        scale: 0.8,
        y: 20,
    },
};

// Loading animations
export const loadingVariants: Variants = {
    pulse: {
        scale: [1, 1.1, 1],
        transition: {
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut",
        },
    },
    spin: {
        rotate: 360,
        transition: {
            duration: 1,
            repeat: Infinity,
            ease: "linear",
        },
    },
    bounce: {
        y: [0, -10, 0],
        transition: {
            duration: 0.6,
            repeat: Infinity,
            ease: "easeInOut",
        },
    },
};

// Chat-specific animations
export const chatNodeVariants: Variants = {
    hidden: {
        scale: 0.8,
        opacity: 0,
        y: 20,
    },
    visible: {
        scale: 1,
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            damping: 20,
            stiffness: 300,
            duration: 0.4,
        },
    },
    exit: {
        scale: 0.8,
        opacity: 0,
        y: -20,
    },
};

// Notification/Toast animations
export const toastVariants: Variants = {
    hidden: {
        opacity: 0,
        y: 50,
        scale: 0.3,
    },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: easings.bouncy,
    },
    exit: {
        opacity: 0,
        y: 50,
        scale: 0.5,
    },
};

// Theme toggle animation
export const themeToggleVariants: Variants = {
    light: {
        rotate: 0,
        scale: 1,
        transition: easings.spring,
    },
    dark: {
        rotate: 180,
        scale: 1.1,
        transition: easings.spring,
    },
};

// Typing indicator animation
export const typingVariants: Variants = {
    typing: {
        scale: [1, 1.2, 1],
        transition: {
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut",
        },
    },
};

// Utility functions for creating custom animations
export const createSlideIn = (direction: "left" | "right" | "top" | "bottom", distance = 100) => {
    const directions = {
        left: { x: -distance },
        right: { x: distance },
        top: { y: -distance },
        bottom: { y: distance },
    };

    return {
        hidden: { ...directions[direction], opacity: 0 },
        visible: { x: 0, y: 0, opacity: 1 },
        exit: { ...directions[direction], opacity: 0 },
    };
};

export const createFadeIn = (delay = 0) => ({
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { delay } },
    exit: { opacity: 0 },
});

export const createBounceIn = (delay = 0) => ({
    hidden: { scale: 0, opacity: 0 },
    visible: {
        scale: 1,
        opacity: 1,
        transition: {
            delay,
            type: "spring",
            damping: 10,
            stiffness: 200,
        }
    },
    exit: { scale: 0, opacity: 0 },
});