import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("chat", "routes/chat.tsx"),
  route("corpus", "routes/corpus.tsx"),
  route("corpus/:slug", "routes/corpus.$slug.tsx"),
] satisfies RouteConfig;
