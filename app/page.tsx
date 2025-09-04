import Link from "next/link";
import NavBar from "./components/NavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-background">
        <main className="pt-20">
          <section className="container mx-auto px-6 py-20 text-center">
            <h1 className="text-6xl font-bold tracking-tight mb-6">
              The Next Generation
              <br />
              Chat Interface for AI
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Experience conversations like never before with our revolutionary graph-based UI. 
              Branch, explore, and visualize your AI interactions in a whole new dimension.
            </p>
            <Button size="lg" asChild>
              <Link href="/chat">Start Chatting</Link>
            </Button>
          </section>

          <section className="container mx-auto px-6 py-20">
            <h2 className="text-4xl font-bold text-center mb-16">Key Features</h2>
            <div className="space-y-20">
              <div className="flex flex-col md:flex-row items-center gap-12">
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold mb-4">Graph-Based Conversations</h3>
                  <p className="text-muted-foreground">
                    Visualize your conversations as interconnected nodes on a canvas. 
                    See the flow of dialogue, branch conversations, and explore multiple paths simultaneously.
                  </p>
                </div>
                <Card className="flex-1 h-48">
                  <CardContent className="h-full bg-muted/50" />
                </Card>
              </div>

              <div className="flex flex-col md:flex-row-reverse items-center gap-12">
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold mb-4">Selective Text Responses</h3>
                  <p className="text-muted-foreground">
                    Select any portion of text and get targeted AI responses. 
                    Perfect for diving deeper into specific topics or clarifying particular points.
                  </p>
                </div>
                <Card className="flex-1 h-48">
                  <CardContent className="h-full bg-muted/50" />
                </Card>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-12">
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold mb-4">Multiple LLM Support</h3>
                  <p className="text-muted-foreground">
                    Connect to various AI providers including OpenAI, Anthropic, Google, 
                    and local models through Ollama and LM Studio. Switch seamlessly between models.
                  </p>
                </div>
                <Card className="flex-1 h-48">
                  <CardContent className="h-full bg-muted/50" />
                </Card>
              </div>

              <div className="flex flex-col md:flex-row-reverse items-center gap-12">
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold mb-4">Local-First Storage</h3>
                  <p className="text-muted-foreground">
                    Your conversations stay on your device using IndexedDB. 
                    No account needed, complete privacy, and full control over your data.
                  </p>
                </div>
                <Card className="flex-1 h-48">
                  <CardContent className="h-full bg-muted/50" />
                </Card>
              </div>
            </div>
          </section>

          <section className="container mx-auto px-6 py-20 text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to Transform Your AI Conversations?</h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Join thousands of users who are already experiencing the future of AI chat interfaces.
            </p>
            <Button size="lg" asChild>
              <Link href="/chat">Get Started Free</Link>
            </Button>
          </section>
        </main>

        <footer className="border-t">
          <div className="container mx-auto px-6 py-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-2xl font-bold">Flow Chat</div>
              <div className="flex items-center gap-6">
                <Link
                  href="https://github.com/Arihant25/flowchat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  GitHub
                </Link>
                <span className="text-muted-foreground">
                  Made with ❤️ in Hyderabad
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}