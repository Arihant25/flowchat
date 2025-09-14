"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Moon, Sun, Github } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { slideDownVariants, hoverVariants, easings } from "@/lib/animations";

export default function NavBar() {
  const { setTheme, theme } = useTheme();

  return (
    <motion.nav
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      variants={slideDownVariants}
      initial="hidden"
      animate="visible"
      transition={easings.smooth}
    >
      <div className="flex h-16 items-center px-4">
        <motion.div
          whileHover={{ scale: 1.05 }}
          transition={easings.fast}
        >
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold">Flow Chat</span>
          </Link>
        </motion.div>

        <div className="flex-1" />

        <div className="flex items-center space-x-2">
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <motion.div
                  whileHover={hoverVariants.lift.hover}
                  whileTap={{ scale: 0.95 }}
                  transition={easings.fast}
                >
                  <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                    <Link href="/chat">
                      Chat
                    </Link>
                  </NavigationMenuLink>
                </motion.div>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <motion.div
                  whileHover={hoverVariants.lift.hover}
                  whileTap={{ scale: 0.95 }}
                  transition={easings.fast}
                >
                  <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                    <Link href="/settings">
                      Settings
                    </Link>
                  </NavigationMenuLink>
                </motion.div>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <motion.div
            whileHover={hoverVariants.scale.hover}
            whileTap={{ scale: 0.9 }}
            transition={easings.fast}
          >
            <Button variant="ghost" size="icon" asChild>
              <Link href="https://github.com/Arihant25/flowchat" target="_blank" rel="noopener noreferrer">
                <Github className="h-5 w-5" />
                <span className="sr-only">GitHub</span>
              </Link>
            </Button>
          </motion.div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.div
                whileHover={hoverVariants.scale.hover}
                whileTap={{ scale: 0.9 }}
                transition={easings.fast}
              >
                <Button variant="ghost" size="icon">
                  <AnimatePresence mode="wait">
                    {theme !== "dark" ? (
                      <motion.div
                        key="sun"
                        initial={{ rotate: -90, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        exit={{ rotate: 90, scale: 0 }}
                        transition={easings.spring}
                      >
                        <Sun className="h-5 w-5" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="moon"
                        initial={{ rotate: 90, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        exit={{ rotate: -90, scale: 0 }}
                        transition={easings.spring}
                      >
                        <Moon className="h-5 w-5" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </motion.div>
            </DropdownMenuTrigger>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={easings.fast}
            >
              <DropdownMenuContent align="end">
                <motion.div
                  whileHover={{ backgroundColor: "var(--accent)" }}
                  transition={easings.fast}
                >
                  <DropdownMenuItem onClick={() => setTheme("light")}>
                    Light
                  </DropdownMenuItem>
                </motion.div>
                <motion.div
                  whileHover={{ backgroundColor: "var(--accent)" }}
                  transition={easings.fast}
                >
                  <DropdownMenuItem onClick={() => setTheme("dark")}>
                    Dark
                  </DropdownMenuItem>
                </motion.div>
                <motion.div
                  whileHover={{ backgroundColor: "var(--accent)" }}
                  transition={easings.fast}
                >
                  <DropdownMenuItem onClick={() => setTheme("system")}>
                    System
                  </DropdownMenuItem>
                </motion.div>
              </DropdownMenuContent>
            </motion.div>
          </DropdownMenu>
        </div>
      </div>
    </motion.nav>
  );
}