import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Optimistic check only: pages still authorize through requireViewer().
export const proxy = auth((req) => {
  if (!req.auth) return NextResponse.redirect(new URL("/sign-in", req.nextUrl));
});

export const config = {
  matcher: ["/((?!api/auth|sign-in|_next/static|_next/image|favicon.ico).*)"],
};
