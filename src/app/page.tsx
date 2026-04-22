import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { Role } from "@prisma/client";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (session.user.role === Role.EMPLOYEE) redirect("/punch");
  redirect("/dashboard");
}
