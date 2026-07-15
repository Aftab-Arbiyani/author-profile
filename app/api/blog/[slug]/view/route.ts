import { NextResponse } from "next/server";
import { incrementBlogPostViews } from "@/lib/firestore";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function POST(_req: Request, { params }: RouteContext) {
  const { slug } = await params;
  await incrementBlogPostViews(slug);
  return NextResponse.json({ ok: true });
}
