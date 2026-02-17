import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const cookieStore = await cookies();
  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof cookieStore.set>[2];
  };

  // E2E auth bypass for tests only
  if (process.env.E2E_AUTH_BYPASS === "1") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
      // shim auth.getUser()
      (client as unknown as { auth: { getUser: () => Promise<{ data: { user: { id: string } }; error: null }> } }).auth = {
        getUser: async () => ({ data: { user: { id: "e2e-bypass-user" } }, error: null })
      };
      return client as unknown as ReturnType<typeof createServerClient>;
    }
    // Fallback stub client (no external calls) for test-only environments without Supabase env
    type StubResponse<T> = { data: T; error: null; count?: number };
    type Chainable = StubResponse<unknown[]> & {
      select: () => Chainable;
      insert: () => StubResponse<unknown[]>;
      update: () => StubResponse<unknown[]>;
      order: () => Chainable;
      eq: () => Chainable;
      gte: () => Chainable;
      in: () => Chainable;
      limit: () => Chainable;
      range: () => Chainable;
      single: () => StubResponse<unknown | null>;
      maybeSingle: () => StubResponse<unknown | null>;
    };
    const chain = (): Chainable => {
      const obj = {
        data: [],
        error: null,
        count: 0,
        select: () => obj as Chainable,
        insert: () => ({ data: [], error: null } as StubResponse<unknown[]>),
        update: () => ({ data: [], error: null } as StubResponse<unknown[]>),
        order: () => obj as Chainable,
        eq: () => obj as Chainable,
        gte: () => obj as Chainable,
        in: () => obj as Chainable,
        limit: () => obj as Chainable,
        range: () => obj as Chainable,
        single: () => ({ data: null, error: null } as StubResponse<unknown | null>),
        maybeSingle: () => ({ data: null, error: null } as StubResponse<unknown | null>)
      } as Chainable;
      return obj;
    };
    const stub = {
      auth: { getUser: async () => ({ data: { user: { id: "e2e-bypass-user" } }, error: null }) },
      from: () => chain()
    };
    return stub as unknown as ReturnType<typeof createServerClient>;
  }

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            if (options) cookieStore.set(name, value, options);
            else cookieStore.set(name, value);
          });
        } catch {
          // server components may ignore cookie writes
        }
      }
    }
  });
}
