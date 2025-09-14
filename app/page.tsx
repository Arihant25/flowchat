"use client";

import Link from "next/link";
import Image from "next/image";
import NavBar from "./components/NavBar";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  fadeUpVariants,
  staggerContainer,
  staggerItem,
  hoverVariants,
  easings
} from "@/lib/animations";
import PageTransition from "@/components/PageTransition";

export default function Home() {
  return (
    <PageTransition>
      <NavBar />
      <div className="min-h-screen bg-background">
        <main className="pt-20">
          <motion.section
            className="container mx-auto px-6 py-20 text-center"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.h1
              variants={staggerItem}
              className="text-6xl font-bold tracking-tight mb-6"
            >
              The Next Generation
              <br />
              Chat Interface for AI
            </motion.h1>
            <motion.p
              variants={staggerItem}
              className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
            >
              Experience conversations like never before with our revolutionary graph-based UI.
              Branch, explore, and visualize your AI interactions in a whole new dimension.
            </motion.p>
            <motion.div variants={staggerItem}>
              <motion.div
                whileHover={hoverVariants.scale.hover}
                whileTap={hoverVariants.scale.tap}
              >
                <Button size="lg" asChild>
                  <Link href="/chat">Start Chatting</Link>
                </Button>
              </motion.div>
            </motion.div>
          </motion.section>

          <motion.section
            className="container mx-auto px-6 py-20"
            variants={fadeUpVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <motion.h2
              className="text-4xl font-bold text-center mb-16"
              variants={fadeUpVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              Key Features
            </motion.h2>
            <motion.div
              className="space-y-20"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
            >
              <motion.div
                variants={staggerItem}
                className="flex flex-col md:flex-row items-center gap-12"
              >
                <motion.div className="flex-1">
                  <h3 className="text-2xl font-semibold mb-4">Graph-Based Conversations</h3>
                  <p className="text-muted-foreground">
                    Visualize your conversations as interconnected nodes on a canvas.
                    See the flow of dialogue, branch conversations, and explore multiple paths simultaneously.
                  </p>
                </motion.div>
                <motion.div
                  whileHover={hoverVariants.lift.hover}
                  transition={easings.smooth}
                >
                  <div className="flex-1 h-64 overflow-hidden rounded-lg">
                    <Image
                      src="/graph.png"
                      alt="Graph-based conversation visualization"
                      width={400}
                      height={200}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </motion.div>
              </motion.div>

              <motion.div
                variants={staggerItem}
                className="flex flex-col md:flex-row-reverse items-center gap-12"
              >
                <motion.div className="flex-1">
                  <h3 className="text-2xl font-semibold mb-4">Selective Text Responses</h3>
                  <p className="text-muted-foreground">
                    Select any portion of text and get targeted AI responses.
                    Perfect for diving deeper into specific topics or clarifying particular points.
                  </p>
                </motion.div>
                <motion.div
                  whileHover={hoverVariants.lift.hover}
                  transition={easings.smooth}
                >
                  <div className="flex-1 h-64 overflow-hidden rounded-lg">
                    <Image
                      src="/reply.png"
                      alt="Selective text response feature"
                      width={400}
                      height={200}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </motion.div>
              </motion.div>

              <motion.div
                variants={staggerItem}
                className="flex flex-col md:flex-row items-center gap-12"
              >
                <motion.div className="flex-1">
                  <h3 className="text-2xl font-semibold mb-4">Multiple LLM Support</h3>
                  <p className="text-muted-foreground">
                    Connect to various AI providers including OpenAI, Anthropic, Google,
                    and local models through Ollama and LM Studio. Switch seamlessly between models.
                  </p>
                </motion.div>
                <motion.div
                  whileHover={hoverVariants.lift.hover}
                  transition={easings.smooth}
                >
                  <div className="flex-1 h-64 overflow-hidden rounded-lg">
                    <Image
                      src="/providers.png"
                      alt="Multiple AI provider support"
                      width={400}
                      height={200}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </motion.div>
              </motion.div>

              <motion.div
                variants={staggerItem}
                className="flex flex-col md:flex-row-reverse items-center gap-12"
              >
                <motion.div className="flex-1">
                  <h3 className="text-2xl font-semibold mb-4">Local-First Storage</h3>
                  <p className="text-muted-foreground">
                    Your conversations stay on your device using IndexedDB.
                    No account needed, complete privacy, and full control over your data.
                  </p>
                </motion.div>
                <motion.div
                  whileHover={hoverVariants.lift.hover}
                  transition={easings.smooth}
                >
                  <div className="flex-1 h-64 overflow-hidden rounded-lg">
                    <Image
                      src="/storage.png"
                      alt="Local-first storage with IndexedDB"
                      width={400}
                      height={200}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.section>

          <motion.section
            className="container mx-auto px-6 py-20 text-center"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <motion.h2
              variants={staggerItem}
              className="text-4xl font-bold mb-6"
            >
              Ready to Transform Your AI Conversations?
            </motion.h2>
            <motion.p
              variants={staggerItem}
              className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
            >
              Join thousands of users who are already experiencing the future of AI chat interfaces.
            </motion.p>
            <motion.div variants={staggerItem}>
              <motion.div
                whileHover={hoverVariants.scale.hover}
                whileTap={hoverVariants.scale.tap}
              >
                <Button size="lg" asChild>
                  <Link href="/chat">Get Started Free</Link>
                </Button>
              </motion.div>
            </motion.div>
          </motion.section>
        </main>

        <motion.footer
          className="border-t"
          variants={fadeUpVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <div className="container mx-auto px-6 py-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <motion.div
                className="text-2xl font-bold"
                whileHover={{ scale: 1.05 }}
                transition={easings.fast}
              >
                Flow Chat
              </motion.div>
              <div className="flex items-center gap-6">
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={easings.fast}
                >
                  <Link
                    href="https://github.com/Arihant25/flowchat"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    GitHub
                  </Link>
                </motion.div>
                <span className="text-muted-foreground">
                  Made with ❤️ in Hyderabad
                </span>
              </div>
            </div>
          </div>
        </motion.footer>
      </div>
    </PageTransition>
  );
}