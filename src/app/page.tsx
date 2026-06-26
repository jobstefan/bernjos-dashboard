import { currentUser } from "@clerk/nextjs/server";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { getOrCreateUser } from "@/lib/user";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default async function Home() {
  const clerkUser = await currentUser();

  // When signed in, sync the Clerk user into the DB. Wrapped so the page still
  // renders if the database isn't reachable yet (e.g. migration not run).
  let dbUser: Awaited<ReturnType<typeof getOrCreateUser>> = null;
  let dbError: string | null = null;
  if (clerkUser) {
    try {
      dbUser = await getOrCreateUser();
    } catch (err) {
      dbError = err instanceof Error ? err.message : "Unknown database error";
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-8 p-6 md:p-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bernjos Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Clerk auth + Prisma/Supabase test
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <SignInButton>
              <Button variant="ghost">Sign in</Button>
            </SignInButton>
            <SignUpButton>
              <Button>Sign up</Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </header>

      <Show when="signed-out">
        <Card>
          <CardHeader>
            <CardTitle>You&apos;re signed out</CardTitle>
            <CardDescription>
              Sign in or create an account to test the Clerk &rarr; database link.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <SignInButton>
              <Button variant="outline">Sign in</Button>
            </SignInButton>
            <SignUpButton>
              <Button>Create account</Button>
            </SignUpButton>
          </CardContent>
        </Card>
      </Show>

      {clerkUser && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="size-12">
                <AvatarImage src={clerkUser.imageUrl} alt="" />
                <AvatarFallback>
                  {(
                    clerkUser.firstName?.[0] ??
                    clerkUser.primaryEmailAddress?.emailAddress?.[0] ??
                    "?"
                  ).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle>
                  {clerkUser.firstName ??
                    clerkUser.primaryEmailAddress?.emailAddress ??
                    "Signed in"}
                </CardTitle>
                <CardDescription>Clerk ID: {clerkUser.id}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <h3 className="text-sm font-medium">Database link</h3>
            {dbUser && (
              <div className="text-muted-foreground space-y-1 text-sm">
                <p>
                  <Badge variant="secondary">synced</Badge> row id:{" "}
                  <code>{dbUser.id}</code>
                </p>
                <p>email: {dbUser.email || "—"}</p>
                <p>created: {dbUser.createdAt.toLocaleString()}</p>
              </div>
            )}
            {!dbUser && dbError && (
              <div className="text-sm">
                <p className="text-destructive">Could not reach the database.</p>
                <pre className="bg-muted mt-1 overflow-auto rounded p-2 text-xs">
                  {dbError}
                </pre>
                <p className="text-muted-foreground mt-1">
                  Set <code>DATABASE_URL</code> in <code>.env</code> and run{" "}
                  <code>pnpm db:migrate</code>.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
