import { getOsSession, type OsSession } from "./session";

/**
 * Wraps a server-side function so it always runs with a verified clientId
 * resolved from the session. Throws if no session — never let a /os query
 * run without a tenant scope.
 */
export async function withClient<T>(fn: (ctx: { session: OsSession; clientId: number }) => Promise<T>): Promise<T> {
  const session = await getOsSession();
  if (!session) throw new Error("no os session");
  if (!session.clientId || typeof session.clientId !== "number") {
    throw new Error("session missing clientId — refusing query");
  }
  return fn({ session, clientId: session.clientId });
}
