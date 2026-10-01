import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import { useTranslation } from "react-i18next";

import type { Route } from "./+types/root";
import "./app.css";
import "./i18n";

// Unset outside a real prod build (front/Dockerfile only bakes this in when
// GA_MEASUREMENT_ID is present in .env.prod - see docs/DEPLOYMENT.md), so
// local dev and PR previews never send traffic to GA.
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as
  | string
  | undefined;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// Runtime-only, unlike VITE_GA_MEASUREMENT_ID above: this must never be baked
// into a bundle (client or server), so it's read from process.env directly
// rather than import.meta.env - a real secret, passed to the running
// container (docker-compose.prod.yml), not a Docker build arg.
const GA_MP_API_SECRET: string | undefined =
  typeof process !== "undefined" ? process.env.GA_MP_API_SECRET : undefined;

// A server-side counterpart to the client gtag.js page_view above - fires
// even when the visitor's browser blocks googletagmanager.com/
// google-analytics.com (adblockers, tracking protection), unlike the client
// script. Its own event name ("page_request") on purpose: it's a raw count
// of page requests, not a replacement for the client event's richer
// session/engagement data, which only a real browser can compute - the two
// are meant to be compared, not merged.
async function trackServerPageRequest(request: Request) {
  if (!GA_MEASUREMENT_ID || !GA_MP_API_SECRET) return;
  // docker-compose.prod.yml's frontend healthcheck (`wget --spider
  // http://localhost:3000`, every 10s) hits this same loader directly on
  // the container's loopback - it never goes through the guardian, so
  // that layer's own User-Agent filter never sees it. Caddy genuinely
  // needs this healthcheck (depends_on: service_healthy), so skip just
  // the GA side-effect here rather than touching the healthcheck itself.
  const userAgent = request.headers.get("user-agent") ?? "";
  if (userAgent.includes("Wget")) return;
  const url = new URL(request.url);
  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_MP_API_SECRET}`,
      {
        method: "POST",
        body: JSON.stringify({
          // This event only ever counts requests, it doesn't attribute them
          // to a returning visitor - a fresh id per request is fine, no
          // tracking cookie needed for that.
          client_id: crypto.randomUUID(),
          events: [
            {
              name: "page_request",
              params: { page_location: url.href, page_path: url.pathname },
            },
          ],
        }),
      },
    );
  } catch {
    // Best-effort - a GA outage or network hiccup must never break the page.
  }
}

// The root loader re-runs on every navigation (React Router revalidates
// parent-route loaders by default), including the initial SSR render - so
// this covers every page view, not just the first one.
export function loader({ request }: Route.LoaderArgs) {
  // Not awaited on purpose: awaiting would add GA's network latency to every
  // page load, and the fetch must never delay or fail the actual response.
  void trackServerPageRequest(request);
  return null;
}

// gtag.js's own auto page_view only fires once, on the script's initial
// load - client-side navigations via React Router's <Link> never reload the
// page, so without this hook every route after the first would go unseen.
function useGoogleAnalyticsPageViews() {
  const location = useLocation();

  useEffect(() => {
    if (!GA_MEASUREMENT_ID || typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
      page_path: location.pathname + location.search,
    });
  }, [location]);
}

export const links: Route.LinksFunction = () => [
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,400..700,0..100,0..1;1,9..144,400..600,0..100,0..1&family=IBM+Plex+Mono:wght@400;500;600&family=Spectral:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();

  return (
    <html lang={i18n.language || "fr"}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {GA_MEASUREMENT_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            />
            <script
              // send_page_view: false - useGoogleAnalyticsPageViews sends every
              // page_view itself, including the first, so it's not double-counted.
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{send_page_view:false});window.gtag=gtag;`,
              }}
            />
          </>
        )}
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  useGoogleAnalyticsPageViews();
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
