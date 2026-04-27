import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type SearchParams = { error?: string; next?: string };

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const error = searchParams.error;
  const next = searchParams.next || "/os";

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-cream">
      <Card className="w-full max-w-md">
        <CardBody className="p-8">
          <div className="text-xs uppercase tracking-wide text-navy/50">Tagglefish OS</div>
          <h1 className="text-2xl font-bold text-navy mt-1">Sign in</h1>
          <p className="text-sm text-navy/60 mt-2">
            Enter your email and password.
          </p>

          <form action="/api/os/auth/login" method="post" className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next} />
            <div>
              <Label htmlFor="email">Email</Label>
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
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-1"
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" size="lg" className="w-full">Sign in</Button>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}
