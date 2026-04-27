import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type SearchParams = { sent?: string; error?: string; next?: string };

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sent = searchParams.sent === "1";
  const error = searchParams.error;
  const next = searchParams.next || "/os";

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-cream">
      <Card className="w-full max-w-md">
        <CardBody className="p-8">
          <div className="text-xs uppercase tracking-wide text-navy/50">Tagglefish OS</div>
          <h1 className="text-2xl font-bold text-navy mt-1">Sign in</h1>
          <p className="text-sm text-navy/60 mt-2">
            Enter your email and we'll send you a one-time sign-in link.
          </p>

          {sent ? (
            <div className="mt-6 rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
              Check your email — a sign-in link is on its way. It expires in 15 minutes.
            </div>
          ) : (
            <form action="/api/os/auth/request" method="post" className="mt-6 space-y-4">
              <input type="hidden" name="next" value={next} />
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@yourcompany.com"
                  className="mt-1"
                />
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit" size="lg" className="w-full">Send sign-in link</Button>
            </form>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
