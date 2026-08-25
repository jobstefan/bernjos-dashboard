"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function TodayRedirect() {
  const router = useRouter();
  useEffect(() => {
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    router.replace(`/schedule?date=${iso}`);
  }, [router]);
  return null;
}
