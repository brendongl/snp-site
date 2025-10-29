import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dice6, Calendar, Users, MessageCircle, Gamepad2 } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold mb-4">
            Welcome to Sip n Play Cafe
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Your central hub for board games, video games, and great times with friends.
            Open for 3 years and counting!
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/games">
              <Button size="lg">
                <Dice6 className="mr-2 h-5 w-5" />
                Browse Board Games
              </Button>
            </Link>
            <Link href="/video-games">
              <Button size="lg" variant="outline">
                <Gamepad2 className="mr-2 h-5 w-5" />
                Browse Video Games
              </Button>
            </Link>
            <Button size="lg" variant="outline" disabled>
              <Calendar className="mr-2 h-5 w-5" />
              Make a Booking
            </Button>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href="/games" className="group">
            <div className="border rounded-lg p-6 transition-all hover:shadow-lg hover:border-primary">
              <Dice6 className="h-12 w-12 mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Board Game Collection</h3>
              <p className="text-sm text-muted-foreground">
                Browse our collection of 330+ board games with search and filters
              </p>
            </div>
          </Link>

          <Link href="/video-games" className="group">
            <div className="border rounded-lg p-6 transition-all hover:shadow-lg hover:border-primary">
              <Gamepad2 className="h-12 w-12 mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Video Game Collection</h3>
              <p className="text-sm text-muted-foreground">
                Browse our Nintendo Switch game library with screenshots and details
              </p>
            </div>
          </Link>

          <div className="border rounded-lg p-6 opacity-60 cursor-not-allowed">
            <Users className="h-12 w-12 mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Events</h3>
            <p className="text-sm text-muted-foreground">
              Join our community events and tournaments (Coming Soon)
            </p>
          </div>

          <div className="border rounded-lg p-6 opacity-60 cursor-not-allowed">
            <MessageCircle className="h-12 w-12 mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Chat Support</h3>
            <p className="text-sm text-muted-foreground">
              Get instant help with our AI assistant (Coming Soon)
            </p>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="container mx-auto px-4 py-12">
        <div className="bg-primary rounded-lg p-8 text-center text-primary-foreground">
          <h2 className="text-3xl font-bold mb-4">Ready to Play?</h2>
          <p className="mb-6 opacity-90">
            Explore our board games and video game collections
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/games">
              <Button size="lg" variant="secondary">
                View Board Games
              </Button>
            </Link>
            <Link href="/video-games">
              <Button size="lg" variant="secondary">
                View Video Games
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2024 Sip n Play Cafe. All rights reserved.</p>
            <p className="mt-2">The central hub for expats and locals to enjoy board games and video games.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
