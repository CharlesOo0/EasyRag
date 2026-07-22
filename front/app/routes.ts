import {type RouteConfig, index, route} from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    // Auth
    route("auth", "routes/auth/index.tsx", [
        route("login", "routes/auth/login.tsx"),
        route("register", "routes/auth/register.tsx"),
        route("verify-email/:key?", "routes/auth/verify-email.tsx"),
        route("verify-code", "routes/auth/verify-code.tsx"),
        route("forgot-password", "routes/auth/forgot-password.tsx"),
        route("reset-password/:uid/:token", "routes/auth/reset-password.tsx"),
    ]),
] satisfies RouteConfig;
